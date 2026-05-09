import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

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
const TAB_TITLE_LENGTH = 18

type ScoreEngine = ReturnType<typeof useScoreEngine>

type SourceTab = {
  id: number
  title: string
  active: boolean
}

// Coupling of a sound engine to a source code with history
function useScoreEngine(id: number) {
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
    id,
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

const getSourceTabTitle = (source: string, index: number): string => {
  const firstContentLine = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstContentLine) return `Source ${index + 1}`

  return firstContentLine.length > TAB_TITLE_LENGTH
    ? `${firstContentLine.slice(0, TAB_TITLE_LENGTH)}...`
    : firstContentLine
}

export const useXenpaperStore = defineStore('xenpaper', () => {
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const playbackPositionMs = ref(-1)
  const scoreEngines = shallowRef<ScoreEngine[]>([useScoreEngine(1)])
  const activeScoreEngineIndex = ref(0)
  const isEmbedMode = ref(false)
  const sidebarMode = ref<SidebarMode>('info')
  const locationHref = ref(DEFAULT_LOCATION_HREF)
  let nextScoreEngineId = 2
  let shouldApplyInitialSidebarMode = true
  const cancelOnEndByEngine = new Map<number, () => void>()
  const cancelOnNoteByEngine = new Map<number, () => void>()
  let activeNoteHandler: ((note: MoscNoteMs, on: boolean) => void) | undefined

  const activeScoreEngine = computed(() => scoreEngines.value[activeScoreEngineIndex.value]!)

  const sourceTabs = computed<SourceTab[]>(() =>
    scoreEngines.value.map((engine, index) => ({
      id: engine.id,
      title: getSourceTabTitle(engine.sourceCode.value, index),
      active: index === activeScoreEngineIndex.value,
    })),
  )

  const sourceCode = computed({
    get: () => activeScoreEngine.value.sourceCode.value,
    set: (source: string) => activeScoreEngine.value.applySourceCode(source),
  })
  const soundEngine = computed(() => activeScoreEngine.value.soundEngine)

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

  const canUndoSourceCode = computed(() =>
    canUndoSourceChange(activeScoreEngine.value.sourceHistory.value),
  )
  const canRedoSourceCode = computed(() =>
    canRedoSourceChange(activeScoreEngine.value.sourceHistory.value),
  )

  const getPlayableScoreEngines = (): ScoreEngine[] =>
    scoreEngines.value.filter((engine) => engine.scoreLoaded.value)

  const preparePlayableScoreEngines = async (): Promise<ScoreEngine[]> => {
    await Promise.all(scoreEngines.value.map((engine) => engine.preparePlayableScore()))
    return getPlayableScoreEngines()
  }

  const pauseAllSoundEngines = async (): Promise<void> => {
    await Promise.all(scoreEngines.value.map((engine) => engine.soundEngine.pause()))
  }

  const updateParsedSourceCode = async (): Promise<void> => {
    const engine = activeScoreEngine.value
    const sourcePlayable = await engine.updateParsedSourceCode()

    const source = engine.parsedSource.value

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

    engine.soundEngine.setLoopActive(isLooping.value)
    playbackPositionMs.value = -1
  }

  const initializeSourceCode = (sharedHash: string): void => {
    const source = getSavedSourceCode(sharedHash)
    scoreEngines.value = [useScoreEngine(1)]
    activeScoreEngineIndex.value = 0
    nextScoreEngineId = 2
    activeScoreEngine.value.sourceHistory.value = createSourceHistory(source)
    activeScoreEngine.value.sourceCode.value = source
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
      activeScoreEngine.value.applySourceCode(sharedSourceCode, false)
    }
  }

  const setSourceCode = (source: string): void => {
    activeScoreEngine.value.applySourceCode(source)
  }

  const addSourceCodeTab = (): void => {
    scoreEngines.value = [...scoreEngines.value, useScoreEngine(nextScoreEngineId++)]
    activeScoreEngineIndex.value = scoreEngines.value.length - 1
    startSoundEngineListeners()
  }

  const selectSourceCodeTab = (index: number): void => {
    if (index < 0 || index >= scoreEngines.value.length) return
    activeScoreEngineIndex.value = index
  }

  const closeSourceCodeTab = (index: number): void => {
    if (scoreEngines.value.length <= 1 || index < 0 || index >= scoreEngines.value.length) return

    const nextScoreEngines = scoreEngines.value.slice()
    const [removed] = nextScoreEngines.splice(index, 1)
    if (!removed) return

    cancelOnEndByEngine.get(removed.id)?.()
    cancelOnEndByEngine.delete(removed.id)
    cancelOnNoteByEngine.get(removed.id)?.()
    cancelOnNoteByEngine.delete(removed.id)
    void removed.soundEngine.pause()
    void removed.soundEngine.setScore({ sequence: [], lengthMs: 0 })

    scoreEngines.value = nextScoreEngines

    if (activeScoreEngineIndex.value >= scoreEngines.value.length) {
      activeScoreEngineIndex.value = scoreEngines.value.length - 1
    } else if (activeScoreEngineIndex.value > index) {
      activeScoreEngineIndex.value--
    }
  }

  const setDemoTune = async (source: string): Promise<void> => {
    const engine = activeScoreEngine.value
    const sourceChanged = source !== sourceCode.value
    engine.applySourceCode(source)

    if (
      sourceChanged ||
      !engine.scoreLoaded.value ||
      engine.soundEngine.position() >= engine.soundEngine.endPosition()
    ) {
      await engine.updateParsedSourceCode()
      if (!engine.scoreLoaded.value) return
    }

    await Promise.all(scoreEngines.value.map((item) => item.soundEngine.gotoMs(0)))
    await Promise.all(scoreEngines.value.map((item) => item.soundEngine.play()))
    isPlaying.value = true
  }

  const updateLoopStart = (): void => {
    const loopStartMs = activeScoreEngine.value.getSelectedLineStartMs()
    scoreEngines.value.forEach((engine) => engine.soundEngine.setLoopStart(loopStartMs))
  }

  const restartPlaybackFromSelectedLine = async (): Promise<void> => {
    const playableEngines = await preparePlayableScoreEngines()
    if (!playableEngines.length) return

    const startMs = activeScoreEngine.value.getSelectedLineStartMs()
    await Promise.all(playableEngines.map((engine) => engine.soundEngine.gotoMs(startMs)))
    await Promise.all(playableEngines.map((engine) => engine.soundEngine.play()))
    isPlaying.value = true
  }

  const restartPlaybackFromLine = async (line: number): Promise<void> => {
    activeScoreEngine.value.selectedLine.value = line
    await restartPlaybackFromSelectedLine()
  }

  const restartPlaybackFromStart = async (): Promise<void> => {
    await restartPlaybackFromLine(0)
  }

  const togglePlayback = async (): Promise<void> => {
    if (isPlaying.value) {
      await pauseAllSoundEngines()
      isPlaying.value = false
      playbackPositionMs.value = -1
      return
    }

    await restartPlaybackFromSelectedLine()
  }

  const toggleLoop = (): void => {
    isLooping.value = !isLooping.value
    scoreEngines.value.forEach((engine) => engine.soundEngine.setLoopActive(isLooping.value))
  }

  const syncPlaybackPosition = (): void => {
    playbackPositionMs.value = soundEngine.value.playing() ? soundEngine.value.position() : -1
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

  const handleSoundEngineEnd = async (): Promise<void> => {
    const playableEngines = getPlayableScoreEngines()
    if (!playableEngines.length) {
      isPlaying.value = false
      return
    }

    const allEnginesEnded = playableEngines.every(
      (engine) => engine.soundEngine.position() >= engine.soundEngine.endPosition(),
    )

    if (!allEnginesEnded) return

    await pauseAllSoundEngines()
    isPlaying.value = false
  }

  const startSoundEngineListeners = (): void => {
    scoreEngines.value.forEach((engine) => {
      if (!cancelOnEndByEngine.has(engine.id)) {
        cancelOnEndByEngine.set(
          engine.id,
          engine.soundEngine.onEnd(() => {
            void handleSoundEngineEnd()
          }),
        )
      }

      if (!cancelOnNoteByEngine.has(engine.id)) {
        cancelOnNoteByEngine.set(
          engine.id,
          engine.soundEngine.onNote((note: MoscNoteMs, on: boolean) => {
            activeNoteHandler?.(note, on)
          }),
        )
      }
    })
  }

  const stopSoundEngineListeners = (): void => {
    cancelOnEndByEngine.forEach((cancel) => cancel())
    cancelOnNoteByEngine.forEach((cancel) => cancel())
    cancelOnEndByEngine.clear()
    cancelOnNoteByEngine.clear()
  }

  const showSidebar = (mode: OpenSidebarMode): void => {
    sidebarMode.value = sidebarMode.value === mode ? 'none' : mode
  }

  const closeSidebar = (): void => {
    sidebarMode.value = 'none'
  }

  return {
    sourceCode,
    sourceTabs,
    activeSourceCodeTabIndex: activeScoreEngineIndex,
    sourceDisplayTokens: computed(() => activeScoreEngine.value.sourceDisplayTokens.value),
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
    selectedLine: computed(() => activeScoreEngine.value.selectedLine.value),
    lastError: computed(() => activeScoreEngine.value.lastError.value),
    chars: computed(() => activeScoreEngine.value.chars.value),
    initialRulerState: computed(() => activeScoreEngine.value.initialRulerState.value),
    playbackPositionMs,
    isEmbedMode,
    sidebarMode,
    updateParsedSourceCode,
    initializeSourceCode,
    initializeLocation,
    saveSourceCodeToBrowser,
    applySharedHash,
    setSourceCode,
    addSourceCodeTab,
    selectSourceCodeTab,
    closeSourceCodeTab,
    setDemoTune,
    updateLoopStart,
    restartPlaybackFromSelectedLine,
    restartPlaybackFromLine,
    restartPlaybackFromStart,
    togglePlayback,
    toggleLoop,
    syncPlaybackPosition,
    resetPlaybackPosition,
    setActiveNoteHandler,
    isCharacterActive,
    startSoundEngineListeners,
    stopSoundEngineListeners,
    showSidebar,
    closeSidebar,
    setSelectedLine: (line: number) => activeScoreEngine.value.setSelectedLine(line),
    undoSourceCode: () => activeScoreEngine.value.undoSourceCode(),
    redoSourceCode: () => activeScoreEngine.value.redoSourceCode(),
  }
})
