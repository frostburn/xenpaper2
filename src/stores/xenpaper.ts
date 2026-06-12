import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef, watch } from 'vue'

import { type CharData } from '../grammars/grammar-to-chars'
import type { MoscNote } from '../mosc'
import {
  canRedoSourceChange,
  canUndoSourceChange,
  createSourceHistory,
  recordSourceChange,
  redoSourceChange,
  resetSourceHistory,
  undoSourceChange,
} from '../source-history'
import {
  encodeShareHashForUrl,
  getSavedSourceCodes,
  getShareHash,
  getSharedSourceCodes,
  hasSharedSourceCode,
  saveSourceCodes,
} from '../share-link'
import { SoundEngineSwSeq } from '../sound-engine-sw-seq'
import { Bank } from '../sw-seq/bank'
import { Transport } from '../sw-seq/transport'
import { createSourceDisplayTokens } from '../source-display'
import type {
  DemoTune,
  OpenSidebarMode,
  SidebarMode,
  SourceDisplayToken,
  SourceTab,
} from '../types'
import {
  APP_BASE_URL,
  createHtmlTitle,
  escapeHtmlAttribute,
  getTimeAtLine,
  isApplePlatform,
  parseAndProcessSourceCode,
} from '../utils'

const EMPTY_SCORE = Object.freeze({ sequence: [], lengthTime: 0 })
const TAB_TITLE_LENGTH = 18
const MAX_DEAD_SOURCE_TABS = 10

type ScoreEngine = ReturnType<typeof useScoreEngine>

// Coupling of a sound engine to a source code with history
function useScoreEngine(id: number, transport: Transport, bank: Bank) {
  const soundEngine = new SoundEngineSwSeq(transport, bank)
  const sourceCode = ref('')
  const sourceHistory = reactive(createSourceHistory(''))
  const scoreLoaded = ref(false)
  const muted = ref(false)
  const soloed = ref(false)
  const selectedLine = ref(0)
  const engineError = ref('')
  const alive = ref(true)
  const deadOrder = ref(0)
  let parseVersion = 0

  const parsedSource = computed(() => parseAndProcessSourceCode(sourceCode.value))
  const chars = computed(() => parsedSource.value.chars)
  const lastError = computed(() => parsedSource.value.error || engineError.value)
  const initialRulerState = computed(() =>
    'initialRulerState' in parsedSource.value ? parsedSource.value.initialRulerState : undefined,
  )
  const sourceDisplayTokens = computed<SourceDisplayToken[]>(() =>
    createSourceDisplayTokens(sourceCode.value),
  )

  const getSelectedLineStartTime = (): number =>
    getTimeAtLine(sourceCode.value, chars.value, selectedLine.value)

  const updateParsedSourceCode = (): void => {
    const version = ++parseVersion
    const source = parsedSource.value
    scoreLoaded.value = false

    if (!source.playable) {
      soundEngine.clearScheduledEvents()
      return
    }

    try {
      engineError.value = ''
      soundEngine.setScore(source.score)
    } catch (e) {
      soundEngine.clearScheduledEvents()
      engineError.value = e instanceof Error ? e.message : 'Unable to set score for sound engine.'
      return
    }
    if (version !== parseVersion) return

    scoreLoaded.value = true
  }

  const applySourceCode = (source: string, recordHistory = true): void => {
    if (source === sourceCode.value) return

    if (recordHistory) {
      recordSourceChange(sourceHistory, source)
    } else {
      resetSourceHistory(sourceHistory, source)
    }
    sourceCode.value = sourceHistory.present
  }

  const undoSourceCode = (): void => {
    undoSourceChange(sourceHistory)
    sourceCode.value = sourceHistory.present
  }

  const redoSourceCode = (): void => {
    redoSourceChange(sourceHistory)
    sourceCode.value = sourceHistory.present
  }

  const setSelectedLine = (line: number): void => {
    selectedLine.value = line
  }

  const preparePlayableScore = (): boolean => {
    if (!scoreLoaded.value || transport.position >= soundEngine.endPosition()) {
      updateParsedSourceCode()
    }

    return scoreLoaded.value
  }

  const kill = (order: number): void => {
    alive.value = false
    deadOrder.value = order
    soundEngine.cutActiveNotes()
    soundEngine.setScore(EMPTY_SCORE)
    scoreLoaded.value = false
  }

  return {
    id,
    soundEngine,
    sourceCode,
    sourceHistory,
    scoreLoaded,
    muted,
    soloed,
    selectedLine,
    alive,
    deadOrder,
    parsedSource,
    chars,
    lastError,
    initialRulerState,
    sourceDisplayTokens,
    getSelectedLineStartTime,
    updateParsedSourceCode,
    applySourceCode,
    setSelectedLine,
    undoSourceCode,
    redoSourceCode,
    preparePlayableScore,
    kill,
  }
}

const sourceCodesEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((sourceCode, index) => sourceCode === b[index])

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
  const audioContext = new AudioContext()
  const swSeqTransport = new Transport(audioContext, { useSetTimeoutFallback: isApplePlatform() })
  const swSeqBank = new Bank(audioContext)

  swSeqTransport.addEventListener('ended', () => {
    swSeqBank.stop()
    resetPlaybackState()
  })

  const isPlaying = ref(false)
  const isLooping = ref(false)
  const playbackPositionTime = ref(-1)
  const scoreEngines = shallowRef<ScoreEngine[]>([useScoreEngine(1, swSeqTransport, swSeqBank)])
  const activeScoreEngineIndex = ref(0)
  const sidebarMode = ref<SidebarMode>('info')
  const embedBaseUrl = computed(() => new URL('embed/', APP_BASE_URL).toString())
  let nextScoreEngineId = 2
  let shouldApplyInitialSidebarMode = true
  let nextDeadScoreEngineOrder = 1
  const scoreEnginesWithNoteListeners = new WeakSet<ScoreEngine>()
  let activeNoteHandler: ((note: MoscNote, on: boolean) => void) | undefined

  const liveScoreEngines = computed(() => scoreEngines.value.filter((engine) => engine.alive.value))
  const deadScoreEngines = computed(() =>
    scoreEngines.value
      .filter((engine) => !engine.alive.value)
      .sort((a, b) => b.deadOrder.value - a.deadOrder.value),
  )
  const activeScoreEngine = computed(() => liveScoreEngines.value[activeScoreEngineIndex.value]!)

  const sourceTabs = computed<SourceTab[]>(() => [
    ...liveScoreEngines.value.map((engine, index) => ({
      id: engine.id,
      title: getSourceTabTitle(engine.sourceCode.value, index),
      active: index === activeScoreEngineIndex.value,
      alive: true,
      muted: engine.muted.value,
      soloed: engine.soloed.value,
    })),
    ...deadScoreEngines.value.map((engine, index) => ({
      id: engine.id,
      title: getSourceTabTitle(engine.sourceCode.value, index),
      active: false,
      alive: false,
      muted: engine.muted.value,
      soloed: engine.soloed.value,
    })),
  ])

  const sourceCode = computed({
    get: () => activeScoreEngine.value.sourceCode.value,
    set: (source: string) => activeScoreEngine.value.applySourceCode(source),
  })
  const sourceCodes = computed(() =>
    liveScoreEngines.value.map((engine) => engine.sourceCode.value),
  )

  const htmlTitle = computed(() => createHtmlTitle(sourceCode.value))

  const shareHash = computed(() => getShareHash(sourceCodes.value))
  const routeHash = computed(() => shareHash.value)
  const shareUrl = computed(() =>
    new URL(encodeShareHashForUrl(shareHash.value), APP_BASE_URL).toString(),
  )
  const embedUrl = computed(() =>
    new URL(encodeShareHashForUrl(shareHash.value), embedBaseUrl.value).toString(),
  )
  const embedCode = computed(
    () =>
      `<iframe width="560" height="315" src="${escapeHtmlAttribute(
        embedUrl.value,
      )}" title="Xenpaper 2" frameborder="0"></iframe>`,
  )

  const canUndoSourceCode = computed(() =>
    canUndoSourceChange(activeScoreEngine.value.sourceHistory),
  )
  const canRedoSourceCode = computed(() =>
    canRedoSourceChange(activeScoreEngine.value.sourceHistory),
  )
  const getScoreEngineGain = (engine: ScoreEngine): number => {
    const hasSoloedScoreEngine = liveScoreEngines.value.some(
      (scoreEngine) => scoreEngine.soloed.value,
    )

    if (hasSoloedScoreEngine) return engine.soloed.value ? 1 : 0

    return engine.muted.value ? 0 : 1
  }

  const syncScoreEngineGains = (): void => {
    liveScoreEngines.value.forEach((engine) => {
      engine.soundEngine.setOutputGain(getScoreEngineGain(engine))
    })
  }

  const getPlayableScoreEngines = (): ScoreEngine[] =>
    liveScoreEngines.value.filter((engine) => engine.scoreLoaded.value)

  const getSharedLoopEndTime = (engines: ScoreEngine[]): number =>
    Math.max(0, ...engines.map((engine) => engine.soundEngine.endPosition()))

  const applySharedTransportLoop = (engines: ScoreEngine[] = getPlayableScoreEngines()): void => {
    swSeqTransport.loopEnd = getSharedLoopEndTime(engines)
    swSeqTransport.endTime = swSeqTransport.loopEnd + 1
  }

  const preparePlayableScoreEngines = (): ScoreEngine[] => {
    syncScoreEngineGains()
    for (const engine of liveScoreEngines.value) {
      engine.preparePlayableScore()
    }
    const engines = getPlayableScoreEngines()
    applySharedTransportLoop(engines)
    return engines
  }

  const pauseAllSoundEngines = (): void => {
    swSeqTransport.stop()
  }

  const clearScoreEngine = (engine: ScoreEngine): void => {
    engine.soundEngine.cutActiveNotes()
    engine.soundEngine.setScore(EMPTY_SCORE)
    engine.scoreLoaded.value = false
  }

  const clearScoreEngines = (engines: ScoreEngine[]): void => {
    engines.forEach(clearScoreEngine)
  }

  const disposeScoreEngines = (engines: ScoreEngine[]): void => {
    engines.forEach((engine) => engine.soundEngine.dispose())
  }

  const clearAndDisposeScoreEngines = (engines: ScoreEngine[]): void => {
    try {
      clearScoreEngines(engines)
    } finally {
      disposeScoreEngines(engines)
    }
  }

  const resetPlaybackState = (): void => {
    isPlaying.value = false
    playbackPositionTime.value = -1
  }

  const createScoreEngineFromSource = (source: string, id: number): ScoreEngine => {
    const engine = useScoreEngine(id, swSeqTransport, swSeqBank)
    resetSourceHistory(engine.sourceHistory, source)
    engine.sourceCode.value = source

    return engine
  }

  const removeScoreEngines = (enginesToRemove: ScoreEngine[]): void => {
    const idsToRemove = new Set(enginesToRemove.map((engine) => engine.id))
    scoreEngines.value = scoreEngines.value.filter((engine) => !idsToRemove.has(engine.id))
  }

  const killScoreEngine = (engine: ScoreEngine): void => {
    engine.kill(nextDeadScoreEngineOrder++)
  }

  const trimDeadScoreEngines = (): void => {
    const enginesToRemove = deadScoreEngines.value.slice(MAX_DEAD_SOURCE_TABS)
    removeScoreEngines(enginesToRemove)
    clearAndDisposeScoreEngines(enginesToRemove)
  }

  const clearDeadScoreEngines = (): void => {
    const enginesToRemove = deadScoreEngines.value
    removeScoreEngines(enginesToRemove)
    clearAndDisposeScoreEngines(enginesToRemove)
  }

  const replaceScoreEnginesWithSources = (sources: string[]): void => {
    const enginesToReplace = liveScoreEngines.value
    clearAndDisposeScoreEngines(enginesToReplace)
    removeScoreEngines(enginesToReplace)
    const nextSources = sources.length ? sources : ['']
    const nextScoreEngines = nextSources.map((source, index) =>
      createScoreEngineFromSource(source, index + 1),
    )
    scoreEngines.value = [...scoreEngines.value, ...nextScoreEngines]
    activeScoreEngineIndex.value = 0
    nextScoreEngineId = Math.max(...scoreEngines.value.map((engine) => engine.id), 0) + 1
    syncScoreEngineGains()
  }

  const restoreDeadSourceCodeTab = (id: number): void => {
    const restored = deadScoreEngines.value.find((engine) => engine.id === id)
    if (!restored) return

    if (isPlaying.value) {
      resetPlaybackState()
      pauseAllSoundEngines()
    }

    restored.alive.value = true
    restored.deadOrder.value = 0
    scoreEngines.value = [...scoreEngines.value.filter((engine) => engine !== restored), restored]
    activeScoreEngineIndex.value = liveScoreEngines.value.length - 1
    syncScoreEngineGains()
  }

  const updateParsedSourceCode = (): void => {
    liveScoreEngines.value.forEach((engine) => engine.soundEngine.cutActiveNotes())
    const engine = activeScoreEngine.value
    engine.updateParsedSourceCode()
    const source = engine.parsedSource.value

    if (shouldApplyInitialSidebarMode) {
      shouldApplyInitialSidebarMode = false

      if ('initialRulerState' in source && source.initialRulerState.lowHz !== undefined) {
        sidebarMode.value = 'ruler'
      }
    }

    applySharedTransportLoop()

    if (!engine.scoreLoaded.value) {
      return
    }

    playbackPositionTime.value = -1
  }

  const initializeSourceCode = (sharedHash: string): void => {
    replaceScoreEnginesWithSources(getSavedSourceCodes(sharedHash))
    clearDeadScoreEngines()
    shouldApplyInitialSidebarMode = true
  }

  const saveSourceCodeToBrowser = (): void => {
    saveSourceCodes(sourceCodes.value)
  }

  const applySharedHash = (sharedHash: string): void => {
    const sharedSourceCodes = getSharedSourceCodes(sharedHash)

    if (
      hasSharedSourceCode(sharedHash) &&
      !sourceCodesEqual(sharedSourceCodes, sourceCodes.value)
    ) {
      clearDeadScoreEngines()
      replaceScoreEnginesWithSources(sharedSourceCodes)
    }
  }

  const setSourceCode = (source: string): void => {
    activeScoreEngine.value.applySourceCode(source)
  }

  const importSourceCodes = (sources: string[]): void => {
    if (isPlaying.value) {
      resetPlaybackState()
      pauseAllSoundEngines()
    }

    clearDeadScoreEngines()
    replaceScoreEnginesWithSources(sources)
    applySharedTransportLoop()
  }

  const addSourceCodeTab = (): void => {
    if (isPlaying.value) {
      resetPlaybackState()
      pauseAllSoundEngines()
    }

    const engine = useScoreEngine(nextScoreEngineId++, swSeqTransport, swSeqBank)
    activeScoreEngineIndex.value = liveScoreEngines.value.length
    scoreEngines.value = [...scoreEngines.value, engine]
    syncScoreEngineGains()
  }

  const toggleSourceCodeTabMute = (id: number): void => {
    const engine = liveScoreEngines.value.find((scoreEngine) => scoreEngine.id === id)
    if (!engine) return

    engine.muted.value = !engine.muted.value
    syncScoreEngineGains()
  }

  const toggleSourceCodeTabSolo = (id: number, preserveOtherSolos = false): void => {
    const engine = liveScoreEngines.value.find((scoreEngine) => scoreEngine.id === id)
    if (!engine) return

    if (preserveOtherSolos) {
      engine.soloed.value = !engine.soloed.value
      syncScoreEngineGains()
      return
    }

    const hasOtherSoloedEngine = liveScoreEngines.value.some(
      (scoreEngine) => scoreEngine !== engine && scoreEngine.soloed.value,
    )
    const shouldSolo = !engine.soloed.value || hasOtherSoloedEngine
    liveScoreEngines.value.forEach((scoreEngine) => {
      scoreEngine.soloed.value = false
    })
    engine.soloed.value = shouldSolo
    syncScoreEngineGains()
  }

  const selectSourceCodeTab = (id: number): void => {
    const aliveIndex = liveScoreEngines.value.findIndex((engine) => engine.id === id)
    if (aliveIndex >= 0) {
      activeScoreEngineIndex.value = aliveIndex
      return
    }

    restoreDeadSourceCodeTab(id)
  }

  const closeSourceCodeTab = (id: number): void => {
    const index = liveScoreEngines.value.findIndex((engine) => engine.id === id)
    if (liveScoreEngines.value.length <= 1 || index < 0) return

    const liveEngines = liveScoreEngines.value
    const removed = liveEngines[index]
    if (!removed) return

    killScoreEngine(removed)
    const nextLiveScoreEngineCount = liveEngines.length - 1

    if (activeScoreEngineIndex.value >= nextLiveScoreEngineCount) {
      activeScoreEngineIndex.value = nextLiveScoreEngineCount - 1
    } else if (activeScoreEngineIndex.value > index) {
      activeScoreEngineIndex.value--
    }

    if (isPlaying.value) {
      resetPlaybackState()
      pauseAllSoundEngines()
    }
    trimDeadScoreEngines()
    applySharedTransportLoop()
  }

  const setDemoTune = async (source: DemoTune): Promise<void> => {
    pauseAllSoundEngines()
    const previousScoreEngines = liveScoreEngines.value
    resetPlaybackState()

    const demoSources = Array.isArray(source) ? (source.length ? source : ['']) : [source]
    const engines = demoSources.map((demoSource) =>
      createScoreEngineFromSource(demoSource, nextScoreEngineId++),
    )

    engines.forEach((engine) => engine.updateParsedSourceCode())
    previousScoreEngines.slice().reverse().forEach(killScoreEngine)
    scoreEngines.value = [...scoreEngines.value, ...engines]
    activeScoreEngineIndex.value = 0
    trimDeadScoreEngines()
    syncScoreEngineGains()

    if (!engines.some((engine) => engine.scoreLoaded.value)) return

    swSeqTransport.loopStart = 0
    await restartPlaybackFromStart()
  }

  const updateLoopStart = (): void => {
    const loopStartTime = activeScoreEngine.value.getSelectedLineStartTime()
    swSeqTransport.loopStart = loopStartTime
  }

  const restartPlaybackFromSelectedLine = async (): Promise<void> => {
    const playableEngines = preparePlayableScoreEngines()
    if (!playableEngines.length) return

    const startTime = activeScoreEngine.value.getSelectedLineStartTime()
    await Promise.all(playableEngines.map((engine) => engine.soundEngine.preparePlayback()))
    await audioContext.resume()
    swSeqTransport.start(startTime)
    isPlaying.value = true
  }

  const restartPlaybackFromLine = (line: number): Promise<void> => {
    activeScoreEngine.value.selectedLine.value = line
    return restartPlaybackFromSelectedLine()
  }

  const restartPlaybackFromStart = (): Promise<void> => restartPlaybackFromLine(0)

  const togglePlayback = async (): Promise<void> => {
    if (isPlaying.value) {
      resetPlaybackState()
      pauseAllSoundEngines()
      return
    }

    await restartPlaybackFromSelectedLine()
  }

  const toggleLoop = (): void => {
    isLooping.value = !isLooping.value
  }

  const syncPlaybackPosition = (): void => {
    playbackPositionTime.value = swSeqTransport.active
      ? swSeqTransport.position - swSeqTransport.lookAhead
      : -1
  }

  const resetPlaybackPosition = (): void => {
    playbackPositionTime.value = -1
  }

  const setActiveNoteHandler = (handler?: (note: MoscNote, on: boolean) => void): void => {
    activeNoteHandler = handler
  }

  const syncSoundEngineNoteListeners = (): void => {
    liveScoreEngines.value.forEach((engine) => {
      if (scoreEnginesWithNoteListeners.has(engine)) return

      engine.soundEngine.onNote((note: MoscNote, on: boolean) => {
        activeNoteHandler?.(note, on)
      })
      scoreEnginesWithNoteListeners.add(engine)
    })
  }

  const isCharacterActive = (charData?: CharData): boolean => {
    const [start, end] = charData?.playTime ?? []
    return (
      isPlaying.value &&
      start !== undefined &&
      end !== undefined &&
      playbackPositionTime.value >= start &&
      playbackPositionTime.value < end
    )
  }

  const disposeSoundEngines = (): void => {
    disposeScoreEngines(scoreEngines.value)
  }

  const showSidebar = (mode: OpenSidebarMode): void => {
    sidebarMode.value = sidebarMode.value === mode ? 'none' : mode
  }

  const closeSidebar = (): void => {
    sidebarMode.value = 'none'
  }

  watch(isLooping, (newValue) => (swSeqTransport.loop = newValue), { immediate: true })
  watch(scoreEngines, syncSoundEngineNoteListeners, { immediate: true })

  return {
    sourceCode,
    sourceCodes,
    sourceTabs,
    activeSourceCodeTabIndex: activeScoreEngineIndex,
    sourceDisplayTokens: computed(() => activeScoreEngine.value.sourceDisplayTokens.value),
    canUndoSourceCode,
    canRedoSourceCode,
    htmlTitle,
    shareHash,
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
    playbackPositionTime,
    sidebarMode,
    updateParsedSourceCode,
    initializeSourceCode,
    saveSourceCodeToBrowser,
    applySharedHash,
    setSourceCode,
    importSourceCodes,
    addSourceCodeTab,
    selectSourceCodeTab,
    closeSourceCodeTab,
    toggleSourceCodeTabMute,
    toggleSourceCodeTabSolo,
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
    disposeSoundEngines,
    showSidebar,
    closeSidebar,
    setSelectedLine: (line: number) => activeScoreEngine.value.setSelectedLine(line),
    undoSourceCode: () => activeScoreEngine.value.undoSourceCode(),
    redoSourceCode: () => activeScoreEngine.value.redoSourceCode(),
  }
})
