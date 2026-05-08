import { defineStore } from 'pinia'
import { computed, ref, watch, type ComponentPublicInstance, type WatchStopHandle } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PitchRuler from '../components/PitchRuler.vue'
import { parse } from '../grammars/grammar.generated.js'
import { grammarToChars, type CharData } from '../grammars/grammar-to-chars'
import { processGrammar, type InitialRulerState } from '../grammars/process-grammar'
import { scoreToMs, type MoscNoteMs, type MoscScoreMs } from '../mosc'
import {
  canRedoSourceChange,
  canUndoSourceChange,
  createSourceHistory,
  recordSourceChange,
  redoSourceChange,
  undoSourceChange,
} from '../source-history'
import { SoundEngineTonejs } from '../sound-engine-tonejs'
import type { XenpaperAST } from '../grammars/grammar.generated'
import {
  getEmbedShareHash,
  getSavedSourceCode,
  getShareHash,
  getSharedSourceCode,
  hasSharedSourceCode,
  isEmbedHash,
  saveSourceCode,
} from '../share-link'

type ParsedSource = {
  ast?: XenpaperAST
  chars: CharData[]
  error: string
  playable: boolean
  initialRulerState?: InitialRulerState
  scoreMs?: MoscScoreMs
}

type ParseErrorLocation = {
  start?: {
    offset?: number
    line?: number
    column?: number
  }
}

type ParseError = Error & {
  location?: ParseErrorLocation
}

export const useXenpaperStore = defineStore('xenpaper', () => {
  const router = useRouter()
  const route = useRoute()

  const decodeBrowserHash = (hash: string): string => {
    try {
      return decodeURIComponent(hash)
    } catch {
      return hash
    }
  }

  const getInitialRouteHash = (): string => {
    if (route.hash) return route.hash
    if (typeof window !== 'undefined' && window.location.hash)
      return decodeBrowserHash(window.location.hash)

    return ''
  }

  const initialRouteHash = getInitialRouteHash()
  const soundEngine = new SoundEngineTonejs()
  const sourceCode = ref(getSavedSourceCode(initialRouteHash))
  const sourceHistory = ref(createSourceHistory(sourceCode.value))
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const selectedLine = ref(0)
  const scoreLoaded = ref(false)
  const lastError = ref('')
  const chars = ref<CharData[]>([])
  const initialRulerState = ref<InitialRulerState>()
  const pitchRuler = ref<InstanceType<typeof PitchRuler>>()
  const playbackPositionMs = ref(-1)
  const copiedShareLink = ref(false)
  const copiedEmbedCode = ref(false)
  const isEmbedMode = ref(isEmbedHash(initialRouteHash))
  type SidebarMode = 'info' | 'share' | 'ruler' | 'none'
  type OpenSidebarMode = Exclude<SidebarMode, 'none'>
  const sidebarMode = ref<SidebarMode>('info')
  let parseVersion = 0
  let shouldApplyInitialSidebarMode = true
  let playbackAnimationFrame: number | undefined
  let stopTitleWatcher: WatchStopHandle | undefined

  const htmlTitle = computed(() => {
    const titleLimit = 20
    const source = sourceCode.value

    if (source.length === 0) return 'Xenpaper 2'

    return source.length > titleLimit
      ? `Xenpaper 2: ${source.slice(0, titleLimit)}...`
      : `Xenpaper 2: ${source}`
  })
  const sourceCharacters = computed(() => sourceCode.value.split(''))
  const hasPlayStartMarkers = computed(() => sourceCode.value.includes('\n'))

  type SourceDisplayToken =
    | {
        type: 'playStart'
        key: string
        line: number
      }
    | {
        type: 'character'
        key: string
        character: string
        index: number
      }

  const sourceDisplayTokens = computed<SourceDisplayToken[]>(() => {
    const tokens: SourceDisplayToken[] = []
    let playStartLine = 0

    const addPlayStart = (): void => {
      tokens.push({
        type: 'playStart',
        key: `play-start-${playStartLine}`,
        line: playStartLine,
      })
      playStartLine++
    }

    if (hasPlayStartMarkers.value) addPlayStart()

    sourceCharacters.value.forEach((character, index) => {
      tokens.push({
        type: 'character',
        key: `character-${index}`,
        character,
        index,
      })

      if (hasPlayStartMarkers.value && character === '\n') addPlayStart()
    })

    return tokens
  })
  const canUndoSourceCode = computed(() => canUndoSourceChange(sourceHistory.value))
  const canRedoSourceCode = computed(() => canRedoSourceChange(sourceHistory.value))
  const shareRoute = computed(() =>
    router.resolve({
      path: route.path,
      query: route.query,
      hash: getShareHash(sourceCode.value),
    }),
  )
  const shareUrl = computed(() => new URL(shareRoute.value.href, window.location.href).toString())
  const embedRoute = computed(() =>
    router.resolve({
      path: route.path,
      query: route.query,
      hash: getEmbedShareHash(sourceCode.value),
    }),
  )
  const embedUrl = computed(() => new URL(embedRoute.value.href, window.location.href).toString())
  const escapeHtmlAttribute = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const embedCode = computed(
    () =>
      `<iframe width="560" height="315" src="${escapeHtmlAttribute(
        embedUrl.value,
      )}" title="Xenpaper 2" frameborder="0"></iframe>`,
  )

  const parseSourceCode = (): XenpaperAST =>
    parse(sourceCode.value, { grammarSource: 'source-code' })

  const getMsAtLine = (tune: string, charData: CharData[] | undefined, line: number): number => {
    if (line === 0) return 0

    let ms = 0
    let counted = 0
    const tuneCharacters = tune.split('')

    for (let i = 0; i < tuneCharacters.length; i++) {
      const character = tuneCharacters[i]
      const [, end] = charData?.[i]?.playTime ?? []

      if (end !== undefined) ms = end

      if (character === '\n') {
        counted++
        if (counted === line) return ms
      }
    }

    return 0
  }

  const getSelectedLineStartMs = (): number =>
    getMsAtLine(sourceCode.value, chars.value, selectedLine.value)

  const getSourceLineAtOffset = (offset: number): number =>
    sourceCode.value.slice(0, offset).split('\n').length - 1

  const getEventSourceLine = (event: KeyboardEvent): number => {
    const target = event.target

    if (!(target instanceof HTMLTextAreaElement)) return selectedLine.value

    return getSourceLineAtOffset(target.selectionStart)
  }

  const findOffsetFromLineColumn = (line: number, column: number): number | undefined => {
    let currentLine = 1
    let currentColumn = 1

    for (let offset = 0; offset < sourceCode.value.length; offset++) {
      if (currentLine === line && currentColumn === column) return offset

      if (sourceCode.value[offset] === '\n') {
        currentLine++
        currentColumn = 1
      } else {
        currentColumn++
      }
    }

    return currentLine === line && currentColumn === column ? sourceCode.value.length : undefined
  }

  const getErrorOffset = (error: unknown): number | undefined => {
    const parseError = error as Partial<ParseError>
    const start = parseError.location?.start

    if (typeof start?.offset === 'number') return start.offset
    if (typeof start?.line === 'number' && typeof start?.column === 'number') {
      return findOffsetFromLineColumn(start.line, start.column)
    }

    const match = error instanceof Error ? error.message.match(/(\d+):(\d+)/) : undefined
    if (!match) return undefined

    return findOffsetFromLineColumn(Number(match[1]), Number(match[2]))
  }

  const parseAndProcessSourceCode = (): ParsedSource => {
    try {
      const ast = parseSourceCode()
      const { score, initialRulerState: processedInitialRulerState } = processGrammar(ast)
      const highlightedChars = grammarToChars(ast)

      if (!score) {
        return {
          ast,
          chars: highlightedChars,
          error: 'There is no playable score yet.',
          playable: false,
          initialRulerState: processedInitialRulerState,
        }
      }

      return {
        ast,
        chars: highlightedChars,
        error: '',
        playable: true,
        initialRulerState: processedInitialRulerState,
        scoreMs: scoreToMs(score),
      }
    } catch (error) {
      const highlightedChars: CharData[] = []
      const offset = getErrorOffset(error)

      if (typeof offset === 'number') {
        highlightedChars[offset] = { color: 'error' }
      }

      return {
        chars: highlightedChars,
        error: error instanceof Error ? error.message : 'Unable to parse Xenpaper 2 source code.',
        playable: false,
      }
    }
  }

  const updateParsedSourceCode = async (): Promise<void> => {
    const version = ++parseVersion
    const parsedSource = parseAndProcessSourceCode()
    chars.value = parsedSource.chars
    lastError.value = parsedSource.error
    initialRulerState.value = parsedSource.initialRulerState

    if (shouldApplyInitialSidebarMode) {
      shouldApplyInitialSidebarMode = false

      if (parsedSource.initialRulerState?.lowHz !== undefined && !isEmbedMode.value) {
        sidebarMode.value = 'ruler'
      }
    }

    if (!parsedSource.playable || !parsedSource.scoreMs) {
      scoreLoaded.value = false
      return
    }

    await soundEngine.setScore(parsedSource.scoreMs)
    if (version !== parseVersion) return

    soundEngine.setLoopActive(isLooping.value)
    await soundEngine.gotoMs(0)
    scoreLoaded.value = true
    playbackPositionMs.value = -1
  }

  const applySourceCode = (tune: string, recordHistory = true): void => {
    if (tune === sourceCode.value) return

    sourceHistory.value = recordHistory
      ? recordSourceChange(sourceHistory.value, tune)
      : createSourceHistory(tune)
    sourceCode.value = sourceHistory.value.present
  }

  const setSourceCode = (tune: string): void => {
    applySourceCode(tune)
  }

  const setDemoTune = async (tune: string): Promise<void> => {
    const sourceChanged = tune !== sourceCode.value
    applySourceCode(tune)

    if (
      sourceChanged ||
      !scoreLoaded.value ||
      soundEngine.position() >= soundEngine.endPosition()
    ) {
      await updateParsedSourceCode()
      if (!scoreLoaded.value) return
    }

    await soundEngine.gotoMs(0)
    await soundEngine.play()
    isPlaying.value = true
  }

  const handleSourceInput = (event: Event): void => {
    setSourceCode((event.target as HTMLTextAreaElement).value)
  }

  const undoSourceCode = (): void => {
    sourceHistory.value = undoSourceChange(sourceHistory.value)
    sourceCode.value = sourceHistory.value.present
  }

  const redoSourceCode = (): void => {
    sourceHistory.value = redoSourceChange(sourceHistory.value)
    sourceCode.value = sourceHistory.value.present
  }

  const setSelectedLine = (line: number): void => {
    selectedLine.value = line
  }

  const handleSourceKeydown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey)) return

    if (event.key === 'Enter') {
      event.preventDefault()
      void restartPlaybackFromStart()
      return
    }

    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault()
      selectedLine.value = getEventSourceLine(event)
      void restartPlaybackFromSelectedLine()
      return
    }

    const key = event.key.toLowerCase()

    if (key === 'z' && event.shiftKey) {
      event.preventDefault()
      redoSourceCode()
      return
    }

    if (key === 'z') {
      event.preventDefault()
      undoSourceCode()
      return
    }

    if (key === 'y') {
      event.preventDefault()
      redoSourceCode()
    }
  }

  const startTitleWatcher = (): void => {
    if (stopTitleWatcher) return

    stopTitleWatcher = watch(
      htmlTitle,
      (title) => {
        document.title = title

        let openGraphTitle = document.head.querySelector<HTMLMetaElement>(
          'meta[property="og:title"]',
        )
        if (!openGraphTitle) {
          openGraphTitle = document.createElement('meta')
          openGraphTitle.setAttribute('property', 'og:title')
          document.head.append(openGraphTitle)
        }

        openGraphTitle.setAttribute('content', title)
      },
      { immediate: true },
    )
  }

  watch(sourceCode, () => {
    copiedShareLink.value = false
    copiedEmbedCode.value = false
    void replaceShareRoute()
    void updateParsedSourceCode()
  })

  watch([selectedLine, chars], () => {
    soundEngine.setLoopStart(getSelectedLineStartMs())
  })

  const replaceShareRoute = async (): Promise<void> => {
    saveSourceCode(sourceCode.value)

    const shareHash = isEmbedMode.value
      ? getEmbedShareHash(sourceCode.value)
      : getShareHash(sourceCode.value)
    if (route.hash === shareHash) return

    await router.replace({
      path: route.path,
      query: route.query,
      hash: shareHash,
    })
  }

  const copyText = async (text: string): Promise<boolean> => {
    if (!text) return false

    const writeClipboardText = navigator.clipboard?.writeText

    if (writeClipboardText) {
      try {
        await writeClipboardText.call(navigator.clipboard, text)
        return true
      } catch {
        // Fall back for browsers that do not expose Clipboard API outside secure contexts.
      }
    }

    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.append(textArea)
    textArea.select()
    const copied = document.execCommand('copy')
    textArea.remove()
    return copied
  }

  const copyShareLink = async (): Promise<void> => {
    copiedShareLink.value = await copyText(shareUrl.value)
  }

  const copyEmbedCode = async (): Promise<void> => {
    copiedEmbedCode.value = await copyText(embedCode.value)
  }

  watch(
    () => route.hash,
    (sharedHash) => {
      const sharedSourceCode = getSharedSourceCode(sharedHash)

      if (hasSharedSourceCode(sharedHash)) {
        isEmbedMode.value = isEmbedHash(sharedHash)
      }

      if (hasSharedSourceCode(sharedHash) && sharedSourceCode !== sourceCode.value) {
        applySourceCode(sharedSourceCode, false)
      }
    },
  )

  const showSidebar = (mode: OpenSidebarMode): void => {
    sidebarMode.value = sidebarMode.value === mode ? 'none' : mode
  }

  const closeSidebar = (): void => {
    sidebarMode.value = 'none'
  }

  const preparePlayableScore = async (): Promise<boolean> => {
    if (!scoreLoaded.value || soundEngine.position() >= soundEngine.endPosition()) {
      await updateParsedSourceCode()
    }

    return scoreLoaded.value
  }

  const restartPlaybackFromSelectedLine = async (): Promise<void> => {
    if (!(await preparePlayableScore())) return

    await soundEngine.gotoMs(getSelectedLineStartMs())
    await soundEngine.play()
    isPlaying.value = true
  }

  const restartPlaybackFromStart = async (): Promise<void> => {
    selectedLine.value = 0
    await restartPlaybackFromSelectedLine()
  }

  const togglePlayback = async (): Promise<void> => {
    if (isPlaying.value) {
      await soundEngine.pause()
      isPlaying.value = false
      playbackPositionMs.value = -1
      return
    }

    await restartPlaybackFromSelectedLine()
  }

  const toggleLoop = (): void => {
    isLooping.value = !isLooping.value
    soundEngine.setLoopActive(isLooping.value)
  }

  const startPlaybackAnimation = (): void => {
    const tick = (): void => {
      playbackPositionMs.value = soundEngine.playing() ? soundEngine.position() : -1
      playbackAnimationFrame = window.requestAnimationFrame(tick)
    }

    if (playbackAnimationFrame === undefined) tick()
  }

  const stopPlaybackAnimation = (): void => {
    if (playbackAnimationFrame !== undefined) {
      window.cancelAnimationFrame(playbackAnimationFrame)
      playbackAnimationFrame = undefined
    }
    playbackPositionMs.value = -1
  }

  const setPitchRuler = (ruler: Element | ComponentPublicInstance | null): void => {
    pitchRuler.value = ruler as InstanceType<typeof PitchRuler> | undefined
  }

  const isCharacterActive = (charData?: CharData): boolean => {
    const [start, end] = charData?.playTime ?? []
    return (
      isPlaying.value &&
      start !== undefined &&
      end !== undefined &&
      playbackPositionMs.value >= start &&
      playbackPositionMs.value < end
    )
  }

  watch(isPlaying, (playing) => {
    if (playing) {
      startPlaybackAnimation()
      return
    }

    stopPlaybackAnimation()
  })

  let cancelOnEnd: (() => void) | undefined
  let cancelOnNote: (() => void) | undefined

  const startSoundEngineListeners = (): void => {
    if (cancelOnEnd || cancelOnNote) return

    cancelOnEnd = soundEngine.onEnd(() => {
      isPlaying.value = false
    })

    cancelOnNote = soundEngine.onNote((note: MoscNoteMs, on: boolean) => {
      pitchRuler.value?.setActiveNote(note, on)
    })
  }

  const initialize = (): void => {
    startSoundEngineListeners()
    startTitleWatcher()
    void replaceShareRoute()
    void updateParsedSourceCode()
  }

  const cleanup = (): void => {
    cancelOnEnd?.()
    cancelOnNote?.()
    cancelOnEnd = undefined
    cancelOnNote = undefined
    stopTitleWatcher?.()
    stopTitleWatcher = undefined
    stopPlaybackAnimation()
  }

  return {
    sourceCode,
    sourceDisplayTokens,
    canUndoSourceCode,
    canRedoSourceCode,
    shareUrl,
    embedUrl,
    embedCode,
    isPlaying,
    isLooping,
    selectedLine,
    lastError,
    chars,
    initialRulerState,
    pitchRuler,
    setPitchRuler,
    copiedShareLink,
    copiedEmbedCode,
    isEmbedMode,
    sidebarMode,
    initialize,
    cleanup,
    handleSourceInput,
    handleSourceKeydown,
    setSelectedLine,
    setDemoTune,
    undoSourceCode,
    redoSourceCode,
    showSidebar,
    closeSidebar,
    copyShareLink,
    copyEmbedCode,
    togglePlayback,
    toggleLoop,
    isCharacterActive,
  }
})
