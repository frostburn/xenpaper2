import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { parse } from '../grammars/grammar.generated.js'
import type { XenpaperAST } from '../grammars/grammar.generated'
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
import {
  encodeShareHashForUrl,
  getEmbedShareHash,
  getSavedSourceCode,
  getShareHash,
  getSharedSourceCode,
  hasSharedSourceCode,
  isEmbedHash,
  saveSourceCode,
} from '../share-link'
import { SoundEngineTonejs } from '../sound-engine-tonejs'
import { createSourceDisplayTokens, type SourceDisplayToken } from '../source-display'

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

const DEFAULT_DOCUMENT_TITLE = 'Xenpaper 2'
const TITLE_SOURCE_LIMIT = 20
const DEFAULT_LOCATION_HREF = 'http://localhost/'

const escapeHtmlAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const createHtmlTitle = (source: string): string => {
  if (source.length === 0) return DEFAULT_DOCUMENT_TITLE

  return source.length > TITLE_SOURCE_LIMIT
    ? `${DEFAULT_DOCUMENT_TITLE}: ${source.slice(0, TITLE_SOURCE_LIMIT)}...`
    : `${DEFAULT_DOCUMENT_TITLE}: ${source}`
}

const findOffsetFromLineColumn = (
  source: string,
  line: number,
  column: number,
): number | undefined => {
  let currentLine = 1
  let currentColumn = 1

  for (let offset = 0; offset < source.length; offset++) {
    if (currentLine === line && currentColumn === column) return offset

    if (source[offset] === '\n') {
      currentLine++
      currentColumn = 1
    } else {
      currentColumn++
    }
  }

  return currentLine === line && currentColumn === column ? source.length : undefined
}

const getErrorOffset = (source: string, error: unknown): number | undefined => {
  const parseError = error as Partial<ParseError>
  const start = parseError.location?.start

  if (typeof start?.offset === 'number') return start.offset
  if (typeof start?.line === 'number' && typeof start?.column === 'number') {
    return findOffsetFromLineColumn(source, start.line, start.column)
  }

  const match = error instanceof Error ? error.message.match(/(\d+):(\d+)/) : undefined
  if (!match) return undefined

  return findOffsetFromLineColumn(source, Number(match[1]), Number(match[2]))
}

const parseAndProcessSourceCode = (source: string): ParsedSource => {
  try {
    const ast = parse(source, { grammarSource: 'source-code' })
    const { score, initialRulerState } = processGrammar(ast)
    const chars = grammarToChars(ast)

    if (!score) {
      return {
        ast,
        chars,
        error: 'There is no playable score yet.',
        playable: false,
        initialRulerState,
      }
    }

    return {
      ast,
      chars,
      error: '',
      playable: true,
      initialRulerState,
      scoreMs: scoreToMs(score),
    }
  } catch (error) {
    const chars: CharData[] = []
    const offset = getErrorOffset(source, error)

    if (typeof offset === 'number') {
      chars[offset] = { color: 'error' }
    }

    return {
      chars,
      error: error instanceof Error ? error.message : 'Unable to parse Xenpaper 2 source code.',
      playable: false,
    }
  }
}

const getMsAtLine = (source: string, charData: CharData[] | undefined, line: number): number => {
  if (line === 0) return 0

  let ms = 0
  let counted = 0
  const sourceCharacters = source.split('')

  for (let i = 0; i < sourceCharacters.length; i++) {
    const character = sourceCharacters[i]
    const [, end] = charData?.[i]?.playTime ?? []

    if (end !== undefined) ms = end

    if (character === '\n') {
      counted++
      if (counted === line) return ms
    }
  }

  return 0
}

export const copyText = async (text: string): Promise<boolean> => {
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

export const useXenpaperStore = defineStore('xenpaper', () => {
  const soundEngine = new SoundEngineTonejs()
  const sourceCode = ref('')
  const sourceHistory = ref(createSourceHistory(''))
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const selectedLine = ref(0)
  const scoreLoaded = ref(false)
  const lastError = ref('')
  const chars = ref<CharData[]>([])
  const initialRulerState = ref<InitialRulerState>()
  const playbackPositionMs = ref(-1)
  const copiedShareLink = ref(false)
  const copiedEmbedCode = ref(false)
  const isEmbedMode = ref(false)
  type SidebarMode = 'info' | 'share' | 'ruler' | 'none'
  type OpenSidebarMode = Exclude<SidebarMode, 'none'>
  const sidebarMode = ref<SidebarMode>('info')
  const locationHref = ref(DEFAULT_LOCATION_HREF)
  let parseVersion = 0
  let shouldApplyInitialSidebarMode = true
  let cancelOnEnd: (() => void) | undefined
  let cancelOnNote: (() => void) | undefined
  let activeNoteHandler: ((note: MoscNoteMs, on: boolean) => void) | undefined

  const htmlTitle = computed(() => createHtmlTitle(sourceCode.value))
  const sourceDisplayTokens = computed<SourceDisplayToken[]>(() =>
    createSourceDisplayTokens(sourceCode.value),
  )
  const canUndoSourceCode = computed(() => canUndoSourceChange(sourceHistory.value))
  const canRedoSourceCode = computed(() => canRedoSourceChange(sourceHistory.value))
  const shareHash = computed(() => getShareHash(sourceCode.value))
  const embedHash = computed(() => getEmbedShareHash(sourceCode.value))
  const routeHash = computed(() => (isEmbedMode.value ? embedHash.value : shareHash.value))
  const shareUrl = computed(() =>
    new URL(encodeShareHashForUrl(shareHash.value), locationHref.value).toString(),
  )
  const embedUrl = computed(() =>
    new URL(encodeShareHashForUrl(embedHash.value), locationHref.value).toString(),
  )
  const embedCode = computed(
    () =>
      `<iframe width="560" height="315" src="${escapeHtmlAttribute(
        embedUrl.value,
      )}" title="Xenpaper 2" frameborder="0"></iframe>`,
  )

  const getSelectedLineStartMs = (): number =>
    getMsAtLine(sourceCode.value, chars.value, selectedLine.value)

  const updateParsedSourceCode = async (): Promise<void> => {
    const version = ++parseVersion
    const parsedSource = parseAndProcessSourceCode(sourceCode.value)
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

  const applySourceCode = (source: string, recordHistory = true): void => {
    if (source === sourceCode.value) return

    sourceHistory.value = recordHistory
      ? recordSourceChange(sourceHistory.value, source)
      : createSourceHistory(source)
    sourceCode.value = sourceHistory.value.present
  }

  const initializeSourceCode = (sharedHash: string): void => {
    const source = getSavedSourceCode(sharedHash)
    sourceHistory.value = createSourceHistory(source)
    sourceCode.value = source
    isEmbedMode.value = isEmbedHash(sharedHash)
    shouldApplyInitialSidebarMode = true
  }

  const initializeLocation = (href: string): void => {
    locationHref.value = href
  }

  const saveSourceCodeToBrowser = (): void => {
    saveSourceCode(sourceCode.value)
  }

  const resetCopiedState = (): void => {
    copiedShareLink.value = false
    copiedEmbedCode.value = false
  }

  const applySharedHash = (sharedHash: string): void => {
    const sharedSourceCode = getSharedSourceCode(sharedHash)

    if (hasSharedSourceCode(sharedHash)) {
      isEmbedMode.value = isEmbedHash(sharedHash)
    }

    if (hasSharedSourceCode(sharedHash) && sharedSourceCode !== sourceCode.value) {
      applySourceCode(sharedSourceCode, false)
    }
  }

  const setSourceCode = (source: string): void => {
    applySourceCode(source)
  }

  const setDemoTune = async (source: string): Promise<void> => {
    const sourceChanged = source !== sourceCode.value
    applySourceCode(source)

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

  const updateLoopStart = (): void => {
    soundEngine.setLoopStart(getSelectedLineStartMs())
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

  const restartPlaybackFromLine = async (line: number): Promise<void> => {
    selectedLine.value = line
    await restartPlaybackFromSelectedLine()
  }

  const restartPlaybackFromStart = async (): Promise<void> => {
    await restartPlaybackFromLine(0)
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

  const syncPlaybackPosition = (): void => {
    playbackPositionMs.value = soundEngine.playing() ? soundEngine.position() : -1
  }

  const resetPlaybackPosition = (): void => {
    playbackPositionMs.value = -1
  }

  const setActiveNoteHandler = (handler?: (note: MoscNoteMs, on: boolean) => void): void => {
    activeNoteHandler = handler
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

  const startSoundEngineListeners = (): void => {
    if (cancelOnEnd || cancelOnNote) return

    cancelOnEnd = soundEngine.onEnd(() => {
      isPlaying.value = false
    })

    cancelOnNote = soundEngine.onNote((note: MoscNoteMs, on: boolean) => {
      activeNoteHandler?.(note, on)
    })
  }

  const stopSoundEngineListeners = (): void => {
    cancelOnEnd?.()
    cancelOnNote?.()
    cancelOnEnd = undefined
    cancelOnNote = undefined
  }

  const setCopiedShareLink = (copied: boolean): void => {
    copiedShareLink.value = copied
  }

  const setCopiedEmbedCode = (copied: boolean): void => {
    copiedEmbedCode.value = copied
  }

  const showSidebar = (mode: OpenSidebarMode): void => {
    sidebarMode.value = sidebarMode.value === mode ? 'none' : mode
  }

  const closeSidebar = (): void => {
    sidebarMode.value = 'none'
  }

  return {
    sourceCode,
    sourceDisplayTokens,
    canUndoSourceCode,
    canRedoSourceCode,
    htmlTitle,
    shareHash,
    embedHash,
    routeHash,
    shareUrl,
    embedUrl,
    embedCode,
    isPlaying,
    isLooping,
    selectedLine,
    lastError,
    chars,
    initialRulerState,
    playbackPositionMs,
    copiedShareLink,
    copiedEmbedCode,
    isEmbedMode,
    sidebarMode,
    initializeSourceCode,
    initializeLocation,
    startSoundEngineListeners,
    stopSoundEngineListeners,
    updateParsedSourceCode,
    updateLoopStart,
    saveSourceCodeToBrowser,
    resetCopiedState,
    applySharedHash,
    setSourceCode,
    setSelectedLine,
    setDemoTune,
    undoSourceCode,
    redoSourceCode,
    restartPlaybackFromLine,
    restartPlaybackFromStart,
    syncPlaybackPosition,
    resetPlaybackPosition,
    setActiveNoteHandler,
    setCopiedShareLink,
    setCopiedEmbedCode,
    showSidebar,
    closeSidebar,
    togglePlayback,
    toggleLoop,
    isCharacterActive,
  }
})
