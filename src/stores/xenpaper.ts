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
  createHtmlTitle,
  escapeHtmlAttribute,
  getTimeAtLine,
  isApplePlatform,
  parseAndProcessSourceCode,
} from '../utils'

const DEFAULT_LOCATION_HREF = 'http://localhost/'
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

  return {
    id,
    soundEngine,
    sourceCode,
    sourceHistory,
    scoreLoaded,
    muted,
    soloed,
    selectedLine,
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

  swSeqTransport.onended = () => {
    swSeqBank.stop()
    resetPlaybackState()
  }

  const isPlaying = ref(false)
  const isLooping = ref(false)
  const playbackPositionTime = ref(-1)
  const scoreEngines = shallowRef<ScoreEngine[]>([useScoreEngine(1, swSeqTransport, swSeqBank)])
  const activeScoreEngineIndex = ref(0)
  const isEmbedMode = ref(false)
  const sidebarMode = ref<SidebarMode>('info')
  const locationHref = ref(DEFAULT_LOCATION_HREF)
  const appBaseUrl = computed(() => {
    const url = new URL(locationHref.value)
    url.pathname = url.pathname.replace(/\/(?:about|embed)\/?$/, '/')
    url.search = ''
    url.hash = ''

    return url.toString()
  })
  const embedBaseUrl = computed(() => new URL('embed/', appBaseUrl.value).toString())
  const deadScoreEngines = shallowRef<ScoreEngine[]>([])
  let nextScoreEngineId = 2
  let shouldApplyInitialSidebarMode = true
  const cancelOnEndByEngine = new Map<number, () => void>()
  const cancelOnNoteByEngine = new Map<ScoreEngine, () => void>()
  let activeNoteHandler: ((note: MoscNote, on: boolean) => void) | undefined

  const activeScoreEngine = computed(() => scoreEngines.value[activeScoreEngineIndex.value]!)

  const sourceTabs = computed<SourceTab[]>(() => [
    ...scoreEngines.value.map((engine, index) => ({
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
  const sourceCodes = computed(() => scoreEngines.value.map((engine) => engine.sourceCode.value))

  const htmlTitle = computed(() => createHtmlTitle(sourceCode.value))

  const shareHash = computed(() => getShareHash(sourceCodes.value))
  const routeHash = computed(() => shareHash.value)
  const shareUrl = computed(() =>
    new URL(encodeShareHashForUrl(shareHash.value), appBaseUrl.value).toString(),
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
    const hasSoloedScoreEngine = scoreEngines.value.some((scoreEngine) => scoreEngine.soloed.value)

    if (hasSoloedScoreEngine) return engine.soloed.value ? 1 : 0

    return engine.muted.value ? 0 : 1
  }

  const syncScoreEngineGains = (): void => {
    scoreEngines.value.forEach((engine) => {
      engine.soundEngine.setOutputGain(getScoreEngineGain(engine))
    })
  }

  const getPlayableScoreEngines = (): ScoreEngine[] =>
    scoreEngines.value.filter((engine) => engine.scoreLoaded.value)

  const getSharedLoopEndTime = (engines: ScoreEngine[]): number =>
    Math.max(0, ...engines.map((engine) => engine.soundEngine.endPosition()))

  const applySharedTransportLoop = (engines: ScoreEngine[] = getPlayableScoreEngines()): void => {
    swSeqTransport.loopEnd = getSharedLoopEndTime(engines)
    swSeqTransport.endTime = swSeqTransport.loopEnd + 1
  }

  const preparePlayableScoreEngines = (): ScoreEngine[] => {
    syncScoreEngineGains()
    for (const engine of scoreEngines.value) {
      engine.preparePlayableScore()
    }
    const engines = getPlayableScoreEngines()
    applySharedTransportLoop(engines)
    return engines
  }

  const pauseAllSoundEngines = () => {
    swSeqTransport.stop()
  }

  const clearScoreEngine = async (engine: ScoreEngine): Promise<void> => {
    engine.soundEngine.cutActiveNotes()
    engine.soundEngine.setScore(EMPTY_SCORE)
    engine.scoreLoaded.value = false
  }

  const clearScoreEngines = async (engines: ScoreEngine[]): Promise<void> => {
    await Promise.all(engines.map((engine) => clearScoreEngine(engine)))
  }

  const disposeScoreEngines = (engines: ScoreEngine[]): void => {
    engines.forEach((engine) => engine.soundEngine.dispose())
  }

  const clearAndDisposeScoreEngines = async (engines: ScoreEngine[]): Promise<void> => {
    try {
      await clearScoreEngines(engines)
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

  const trimDeadScoreEngines = (): void => {
    const enginesToRemove = deadScoreEngines.value.slice(MAX_DEAD_SOURCE_TABS)
    deadScoreEngines.value = deadScoreEngines.value.slice(0, MAX_DEAD_SOURCE_TABS)
    void clearAndDisposeScoreEngines(enginesToRemove)
  }

  const rememberDeadScoreEngines = (engines: ScoreEngine[]): void => {
    const rememberedIds = new Set([
      ...scoreEngines.value.map((engine) => engine.id),
      ...deadScoreEngines.value.map((engine) => engine.id),
    ])
    const enginesToRemember = engines.filter((engine) => {
      if (rememberedIds.has(engine.id)) return false

      rememberedIds.add(engine.id)
      return true
    })
    if (!enginesToRemember.length) return

    enginesToRemember.forEach((engine) => {
      cancelOnEndByEngine.get(engine.id)?.()
      cancelOnEndByEngine.delete(engine.id)
      cancelOnNoteByEngine.get(engine)?.()
      cancelOnNoteByEngine.delete(engine)
    })

    deadScoreEngines.value = [...enginesToRemember, ...deadScoreEngines.value]
    trimDeadScoreEngines()
  }

  const clearDeadScoreEngines = (): void => {
    const enginesToRemove = deadScoreEngines.value
    deadScoreEngines.value = []
    void clearAndDisposeScoreEngines(enginesToRemove)
  }

  const replaceScoreEnginesWithSources = (sources: string[]): void => {
    void clearAndDisposeScoreEngines(scoreEngines.value)
    const nextSources = sources.length ? sources : ['']
    scoreEngines.value = nextSources.map((source, index) =>
      createScoreEngineFromSource(source, index + 1),
    )
    activeScoreEngineIndex.value = 0
    nextScoreEngineId =
      Math.max(
        ...scoreEngines.value.map((engine) => engine.id),
        ...deadScoreEngines.value.map((engine) => engine.id),
        0,
      ) + 1
    syncScoreEngineGains()
  }

  const restoreDeadSourceCodeTab = (id: number): void => {
    const restored = deadScoreEngines.value.find((engine) => engine.id === id)
    if (!restored) return

    if (isPlaying.value) {
      resetPlaybackState()
      void pauseAllSoundEngines()
    }

    deadScoreEngines.value = deadScoreEngines.value.filter((engine) => engine.id !== id)
    scoreEngines.value = [...scoreEngines.value, restored]
    activeScoreEngineIndex.value = scoreEngines.value.length - 1
    syncScoreEngineGains()
  }

  const updateParsedSourceCode = (): void => {
    scoreEngines.value.forEach((engine) => engine.soundEngine.cutActiveNotes())
    const engine = activeScoreEngine.value
    engine.updateParsedSourceCode()
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

    applySharedTransportLoop()

    if (!engine.scoreLoaded) {
      return
    }

    playbackPositionTime.value = -1
  }

  const initializeSourceCode = (sharedHash: string, embedMode = false): void => {
    replaceScoreEnginesWithSources(getSavedSourceCodes(sharedHash))
    clearDeadScoreEngines()
    isEmbedMode.value = embedMode
    shouldApplyInitialSidebarMode = true
  }

  const initializeLocation = (href: string): void => {
    locationHref.value = href
  }

  const saveSourceCodeToBrowser = (): void => {
    saveSourceCodes(sourceCodes.value)
  }

  const applySharedHash = (sharedHash: string, embedMode = false): void => {
    const sharedSourceCodes = getSharedSourceCodes(sharedHash)
    isEmbedMode.value = embedMode

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

  const importSourceCodes = async (sources: string[]): Promise<void> => {
    if (isPlaying.value) {
      resetPlaybackState()
      await pauseAllSoundEngines()
    }

    clearDeadScoreEngines()
    replaceScoreEnginesWithSources(sources)
    applySharedTransportLoop()
  }

  const addSourceCodeTab = async (): Promise<void> => {
    if (isPlaying.value) {
      resetPlaybackState()
      await pauseAllSoundEngines()
    }

    scoreEngines.value = [
      ...scoreEngines.value,
      useScoreEngine(nextScoreEngineId++, swSeqTransport, swSeqBank),
    ]
    activeScoreEngineIndex.value = scoreEngines.value.length - 1
    syncScoreEngineGains()
  }

  const toggleSourceCodeTabMute = (id: number): void => {
    const engine = scoreEngines.value.find((scoreEngine) => scoreEngine.id === id)
    if (!engine) return

    engine.muted.value = !engine.muted.value
    syncScoreEngineGains()
  }

  const toggleSourceCodeTabSolo = (id: number, preserveOtherSolos = false): void => {
    const engine = scoreEngines.value.find((scoreEngine) => scoreEngine.id === id)
    if (!engine) return

    if (preserveOtherSolos) {
      engine.soloed.value = !engine.soloed.value
      syncScoreEngineGains()
      return
    }

    const hasOtherSoloedEngine = scoreEngines.value.some(
      (scoreEngine) => scoreEngine !== engine && scoreEngine.soloed.value,
    )
    const shouldSolo = !engine.soloed.value || hasOtherSoloedEngine
    scoreEngines.value.forEach((scoreEngine) => {
      scoreEngine.soloed.value = false
    })
    engine.soloed.value = shouldSolo
    syncScoreEngineGains()
  }

  const selectSourceCodeTab = (id: number): void => {
    const aliveIndex = scoreEngines.value.findIndex((engine) => engine.id === id)
    if (aliveIndex >= 0) {
      activeScoreEngineIndex.value = aliveIndex
      return
    }

    restoreDeadSourceCodeTab(id)
  }

  const closeSourceCodeTab = async (id: number): Promise<void> => {
    const index = scoreEngines.value.findIndex((engine) => engine.id === id)
    if (scoreEngines.value.length <= 1 || index < 0) return

    const nextScoreEngines = scoreEngines.value.slice()
    const [removed] = nextScoreEngines.splice(index, 1)
    if (!removed) return

    scoreEngines.value = nextScoreEngines

    if (activeScoreEngineIndex.value >= scoreEngines.value.length) {
      activeScoreEngineIndex.value = scoreEngines.value.length - 1
    } else if (activeScoreEngineIndex.value > index) {
      activeScoreEngineIndex.value--
    }

    if (isPlaying.value) {
      resetPlaybackState()
      await pauseAllSoundEngines()
    }
    await clearScoreEngine(removed)
    rememberDeadScoreEngines([removed])
    applySharedTransportLoop()
  }

  const setDemoTune = async (source: DemoTune): Promise<void> => {
    await pauseAllSoundEngines()
    const previousScoreEngines = scoreEngines.value
    resetPlaybackState()
    await clearScoreEngines(previousScoreEngines)

    const demoSources = Array.isArray(source) ? (source.length ? source : ['']) : [source]
    const engines = demoSources.map((demoSource) =>
      createScoreEngineFromSource(demoSource, nextScoreEngineId++),
    )

    await Promise.all(engines.map((engine) => engine.updateParsedSourceCode()))
    scoreEngines.value = engines
    activeScoreEngineIndex.value = 0
    rememberDeadScoreEngines(previousScoreEngines)
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
    await audioContext.resume()
    swSeqTransport.start(startTime)
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
    const aliveEngines = new Set(scoreEngines.value)

    cancelOnNoteByEngine.forEach((cancel, engine) => {
      if (aliveEngines.has(engine)) return

      cancel()
      cancelOnNoteByEngine.delete(engine)
    })

    scoreEngines.value.forEach((engine) => {
      if (cancelOnNoteByEngine.has(engine)) return

      cancelOnNoteByEngine.set(
        engine,
        engine.soundEngine.onNote((note: MoscNote, on: boolean) => {
          activeNoteHandler?.(note, on)
        }),
      )
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
    disposeScoreEngines([...scoreEngines.value, ...deadScoreEngines.value])
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
    isEmbedMode,
    sidebarMode,
    updateParsedSourceCode,
    initializeSourceCode,
    initializeLocation,
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
