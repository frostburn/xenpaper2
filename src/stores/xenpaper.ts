import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { type CharData } from '../grammars/grammar-to-chars'
import { type MoscNoteMs } from '../mosc'
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
import { createSourceDisplayTokens } from '../source-display'
import type { OpenSidebarMode, SidebarMode, SourceDisplayToken } from '../types'
import {
  createHtmlTitle,
  escapeHtmlAttribute,
  getMsAtLine,
  parseAndProcessSourceCode,
} from '../utils'

const DEFAULT_LOCATION_HREF = 'http://localhost/'

// Coupling of a sound engine to a source code with history
function useScoreEngine() {
  const soundEngine = new SoundEngineTonejs()
  const sourceCode = ref('')
  const sourceHistory = ref(createSourceHistory(''))
  const scoreLoaded = ref(false)
  const selectedLine = ref(0)
  let parseVersion = 0

  const parsedSource = computed(() => parseAndProcessSourceCode(sourceCode.value))
  const chars = computed(() => parsedSource.value.chars)
  const lastError = computed(() => parsedSource.value.error)
  const initialRulerState = computed(() =>
    'initialRulerState' in parsedSource.value ? parsedSource.value.initialRulerState : undefined,
  )
  const sourceDisplayTokens = computed<SourceDisplayToken[]>(() =>
    createSourceDisplayTokens(sourceCode.value),
  )

  const getSelectedLineStartMs = (): number =>
    getMsAtLine(sourceCode.value, chars.value, selectedLine.value)

  const updateParsedSourceCode = async (): Promise<boolean> => {
    const version = ++parseVersion
    const source = parsedSource.value

    if (!source.playable) {
      scoreLoaded.value = false
      return false
    }

    await soundEngine.setScore(source.scoreMs)
    if (version !== parseVersion) return false

    await soundEngine.gotoMs(0)
    scoreLoaded.value = true

    return true
  }

  const applySourceCode = (source: string, recordHistory = true): void => {
    if (source === sourceCode.value) return

    sourceHistory.value = recordHistory
      ? recordSourceChange(sourceHistory.value, source)
      : createSourceHistory(source)
    sourceCode.value = sourceHistory.value.present
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

  const preparePlayableScore = async (): Promise<boolean> => {
    if (!scoreLoaded.value || soundEngine.position() >= soundEngine.endPosition()) {
      await updateParsedSourceCode()
    }

    return scoreLoaded.value
  }

  return {
    soundEngine,
    sourceCode,
    sourceHistory,
    scoreLoaded,
    selectedLine,
    parsedSource,
    chars,
    lastError,
    initialRulerState,
    sourceDisplayTokens,
    getSelectedLineStartMs,
    updateParsedSourceCode,
    applySourceCode,
    setSelectedLine,
    undoSourceCode,
    redoSourceCode,
    preparePlayableScore,
  }
}

export const useXenpaperStore = defineStore('xenpaper', () => {
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const playbackPositionMs = ref(-1)
  const scoreEngine = useScoreEngine()
  const isEmbedMode = ref(false)
  const sidebarMode = ref<SidebarMode>('info')
  const locationHref = ref(DEFAULT_LOCATION_HREF)
  let shouldApplyInitialSidebarMode = true
  let cancelOnEnd: (() => void) | undefined
  let cancelOnNote: (() => void) | undefined
  let activeNoteHandler: ((note: MoscNoteMs, on: boolean) => void) | undefined

  // TODO: Combine multiple sources and sound engines appropriately
  const sourceCode = scoreEngine.sourceCode
  const soundEngine = scoreEngine.soundEngine

  const htmlTitle = computed(() => createHtmlTitle(sourceCode.value))

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

  const canUndoSourceCode = computed(() => canUndoSourceChange(scoreEngine.sourceHistory.value))
  const canRedoSourceCode = computed(() => canRedoSourceChange(scoreEngine.sourceHistory.value))

  const updateParsedSourceCode = async (): Promise<void> => {
    const sourcePlayable = await scoreEngine.updateParsedSourceCode()

    const source = scoreEngine.parsedSource.value

    if (shouldApplyInitialSidebarMode) {
      shouldApplyInitialSidebarMode = false

      if (
        'initialRulerState' in source &&
        source.initialRulerState.lowHz !== undefined &&
        !isEmbedMode.value
      ) {
        sidebarMode.value = 'ruler'
      }
    }

    if (!sourcePlayable) {
      return
    }

    soundEngine.setLoopActive(isLooping.value)
    playbackPositionMs.value = -1
  }

  const initializeSourceCode = (sharedHash: string): void => {
    const source = getSavedSourceCode(sharedHash)
    scoreEngine.sourceHistory.value = createSourceHistory(source)
    scoreEngine.sourceCode.value = source
    isEmbedMode.value = isEmbedHash(sharedHash)
    shouldApplyInitialSidebarMode = true
  }

  const initializeLocation = (href: string): void => {
    locationHref.value = href
  }

  const saveSourceCodeToBrowser = (): void => {
    saveSourceCode(sourceCode.value)
  }

  const applySharedHash = (sharedHash: string): void => {
    const sharedSourceCode = getSharedSourceCode(sharedHash)

    if (hasSharedSourceCode(sharedHash)) {
      isEmbedMode.value = isEmbedHash(sharedHash)
    }

    if (hasSharedSourceCode(sharedHash) && sharedSourceCode !== sourceCode.value) {
      scoreEngine.applySourceCode(sharedSourceCode, false)
    }
  }

  const setSourceCode = (source: string): void => {
    scoreEngine.applySourceCode(source)
  }

  const setDemoTune = async (source: string): Promise<void> => {
    const sourceChanged = source !== sourceCode.value
    scoreEngine.applySourceCode(source)

    if (
      sourceChanged ||
      !scoreEngine.scoreLoaded.value ||
      soundEngine.position() >= soundEngine.endPosition()
    ) {
      await scoreEngine.updateParsedSourceCode()
      if (!scoreEngine.scoreLoaded.value) return
    }

    await soundEngine.gotoMs(0)
    await soundEngine.play()
    isPlaying.value = true
  }

  const updateLoopStart = (): void => {
    soundEngine.setLoopStart(scoreEngine.getSelectedLineStartMs())
  }

  const restartPlaybackFromSelectedLine = async (): Promise<void> => {
    if (!(await scoreEngine.preparePlayableScore())) return

    await soundEngine.gotoMs(scoreEngine.getSelectedLineStartMs())
    await soundEngine.play()
    isPlaying.value = true
  }

  const restartPlaybackFromLine = async (line: number): Promise<void> => {
    scoreEngine.selectedLine.value = line
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

  const showSidebar = (mode: OpenSidebarMode): void => {
    sidebarMode.value = sidebarMode.value === mode ? 'none' : mode
  }

  const closeSidebar = (): void => {
    sidebarMode.value = 'none'
  }

  return {
    sourceCode,
    sourceDisplayTokens: scoreEngine.sourceDisplayTokens,
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
    selectedLine: scoreEngine.selectedLine,
    lastError: scoreEngine.lastError,
    chars: scoreEngine.chars,
    initialRulerState: scoreEngine.initialRulerState,
    playbackPositionMs,
    isEmbedMode,
    sidebarMode,
    initializeSourceCode,
    initializeLocation,
    startSoundEngineListeners,
    stopSoundEngineListeners,
    updateParsedSourceCode,
    updateLoopStart,
    saveSourceCodeToBrowser,
    applySharedHash,
    setSourceCode,
    setSelectedLine: scoreEngine.setSelectedLine,
    setDemoTune,
    undoSourceCode: scoreEngine.undoSourceCode,
    redoSourceCode: scoreEngine.redoSourceCode,
    restartPlaybackFromLine,
    restartPlaybackFromStart,
    syncPlaybackPosition,
    resetPlaybackPosition,
    setActiveNoteHandler,
    showSidebar,
    closeSidebar,
    togglePlayback,
    toggleLoop,
    isCharacterActive,
  }
})
