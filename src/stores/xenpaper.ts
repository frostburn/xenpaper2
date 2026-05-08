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
  getSavedSourceCodes,
  getShareHash,
  hasSharedSourceCode,
  isEmbedHash,
  saveSourceCodes,
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

export const useXenpaperStore = defineStore('xenpaper', () => {
  const soundEngines: SoundEngineTonejs[] = [new SoundEngineTonejs(false)]
  const sourceHistories = ref([createSourceHistory('')])
  const activeSourceCodeIndex = ref(0)
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const selectedLines = ref([0])
  const scoreLoaded = ref([false])
  const playbackPositionMs = ref(-1)
  const isEmbedMode = ref(false)
  const sidebarMode = ref<SidebarMode>('info')
  const locationHref = ref(DEFAULT_LOCATION_HREF)
  let parseVersion = 0
  let shouldApplyInitialSidebarMode = true
  let cancelOnEnd: (() => void) | undefined
  let cancelOnNote: (() => void) | undefined
  let activeNoteHandler: ((note: MoscNoteMs, on: boolean) => void) | undefined

  const sourceCodes = computed(() => sourceHistories.value.map((history) => history.present))
  const sourceCode = computed(() => sourceCodes.value[activeSourceCodeIndex.value] || '')
  const selectedLine = computed(() => selectedLines.value[activeSourceCodeIndex.value] || 0)
  const parsedSources = computed(() => sourceCodes.value.map(parseAndProcessSourceCode))
  const parsedSource = computed(() => parsedSources.value[activeSourceCodeIndex.value]!)
  const chars = computed(() => parsedSource.value.chars)
  const lastError = computed(() => parsedSource.value.error)
  const initialRulerState = computed(() =>
    'initialRulerState' in parsedSource.value ? parsedSource.value.initialRulerState : undefined,
  )
  const htmlTitle = computed(() => createHtmlTitle(sourceCodes.value.join('\n')))
  const sourceDisplayTokens = computed<SourceDisplayToken[]>(() =>
    createSourceDisplayTokens(sourceCode.value),
  )
  const activeSourceHistory = computed(() => sourceHistories.value[activeSourceCodeIndex.value]!)
  const canUndoSourceCode = computed(() => canUndoSourceChange(activeSourceHistory.value))
  const canRedoSourceCode = computed(() => canRedoSourceChange(activeSourceHistory.value))
  const shareHash = computed(() => getShareHash(sourceCodes.value))
  const embedHash = computed(() => getEmbedShareHash(sourceCodes.value))
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

  const ensureSourceState = (sourceCount: number): void => {
    const count = Math.max(1, sourceCount)

    while (soundEngines.length < count) soundEngines.push(new SoundEngineTonejs(false))
    while (soundEngines.length > count) void soundEngines.pop()?.pause()

    selectedLines.value = Array.from(
      { length: count },
      (_, index) => selectedLines.value[index] ?? 0,
    )
    scoreLoaded.value = Array.from(
      { length: count },
      (_, index) => scoreLoaded.value[index] ?? false,
    )

    if (activeSourceCodeIndex.value >= count) activeSourceCodeIndex.value = count - 1
  }

  const setSourceCodes = (sources: readonly string[], recordHistory = false): void => {
    const normalized = sources.length > 0 ? [...sources] : ['']
    const shouldRestartListeners = !!(cancelOnEnd || cancelOnNote)
    if (shouldRestartListeners) stopSoundEngineListeners()

    ensureSourceState(normalized.length)
    sourceHistories.value = normalized.map((source, index) => {
      const existingHistory = sourceHistories.value[index]
      if (!existingHistory) return createSourceHistory(source)
      if (recordHistory) return recordSourceChange(existingHistory, source)
      if (existingHistory.present === source) return existingHistory

      return createSourceHistory(source)
    })
    ensureSourceState(normalized.length)

    if (shouldRestartListeners) startSoundEngineListeners()
  }

  const activeSoundEngine = (): SoundEngineTonejs => soundEngines[activeSourceCodeIndex.value]!

  const playableSourceIndexes = (): number[] =>
    parsedSources.value
      .map((source, index) =>
        sourceCodes.value[index]?.trim() !== '' && source.playable ? index : -1,
      )
      .filter((index) => index >= 0)

  const maxEndPosition = (): number =>
    Math.max(0, ...playableSourceIndexes().map((index) => soundEngines[index]!.endPosition()))

  const getSelectedLineStartMs = (): number =>
    getMsAtLine(sourceCode.value, chars.value, selectedLine.value)

  const updateParsedSourceCode = async (): Promise<void> => {
    const version = ++parseVersion
    const sources = parsedSources.value

    if (shouldApplyInitialSidebarMode) {
      shouldApplyInitialSidebarMode = false
      const source = parsedSource.value

      if (
        'initialRulerState' in source &&
        source.initialRulerState.lowHz !== undefined &&
        !isEmbedMode.value
      ) {
        sidebarMode.value = 'ruler'
      }
    }

    ensureSourceState(sources.length)

    await Promise.all(
      sources.map(async (source, index) => {
        if (sourceCodes.value[index]?.trim() === '' || !source.playable) {
          scoreLoaded.value[index] = false
          return
        }

        await soundEngines[index]!.setScore(source.scoreMs)
        scoreLoaded.value[index] = true
      }),
    )
    if (version !== parseVersion) return

    soundEngines.forEach((engine) => {
      engine.setLoopActive(isLooping.value)
      if ('setLoopEnd' in engine && typeof engine.setLoopEnd === 'function') {
        engine.setLoopEnd(maxEndPosition())
      }
    })
    await activeSoundEngine().gotoMs(0)
    playbackPositionMs.value = -1
  }

  const applySourceCode = (source: string, recordHistory = true): void => {
    if (source === sourceCode.value) return

    sourceHistories.value[activeSourceCodeIndex.value] = recordHistory
      ? recordSourceChange(activeSourceHistory.value, source)
      : createSourceHistory(source)
  }

  const initializeSourceCode = (sharedHash: string): void => {
    const sources = getSavedSourceCodes(sharedHash)
    setSourceCodes(sources)
    isEmbedMode.value = isEmbedHash(sharedHash)
    shouldApplyInitialSidebarMode = true
  }

  const initializeLocation = (href: string): void => {
    locationHref.value = href
  }

  const saveSourceCodeToBrowser = (): void => {
    saveSourceCodes(sourceCodes.value)
  }

  const applySharedHash = (sharedHash: string): void => {
    if (hasSharedSourceCode(sharedHash)) {
      isEmbedMode.value = isEmbedHash(sharedHash)
    }

    if (hasSharedSourceCode(sharedHash)) {
      const sharedSourceCodes = getSavedSourceCodes(sharedHash)
      if (JSON.stringify(sharedSourceCodes) !== JSON.stringify(sourceCodes.value)) {
        setSourceCodes(sharedSourceCodes)
      }
    }
  }

  const setSourceCode = (source: string): void => {
    applySourceCode(source)
  }

  const setDemoTune = async (source: string): Promise<void> => {
    const sourceChanged = source !== sourceCode.value || sourceCodes.value.length !== 1
    setSourceCodes([source])

    if (
      sourceChanged ||
      !scoreLoaded.value.some(Boolean) ||
      activeSoundEngine().position() >= maxEndPosition()
    ) {
      await updateParsedSourceCode()
      if (!scoreLoaded.value.some(Boolean)) return
    }

    await activeSoundEngine().gotoMs(0)
    await Promise.all(soundEngines.map((engine) => engine.play()))
    isPlaying.value = true
  }

  const undoSourceCode = (): void => {
    sourceHistories.value[activeSourceCodeIndex.value] = undoSourceChange(activeSourceHistory.value)
  }

  const redoSourceCode = (): void => {
    sourceHistories.value[activeSourceCodeIndex.value] = redoSourceChange(activeSourceHistory.value)
  }

  const setSelectedLine = (line: number): void => {
    selectedLines.value[activeSourceCodeIndex.value] = line
  }

  const updateLoopStart = (): void => {
    soundEngines.forEach((engine) => engine.setLoopStart(getSelectedLineStartMs()))
  }

  const preparePlayableScore = async (): Promise<boolean> => {
    if (!scoreLoaded.value.some(Boolean) || activeSoundEngine().position() >= maxEndPosition()) {
      await updateParsedSourceCode()
    }

    return scoreLoaded.value.some(Boolean)
  }

  const restartPlaybackFromSelectedLine = async (): Promise<void> => {
    if (!(await preparePlayableScore())) return

    await activeSoundEngine().gotoMs(getSelectedLineStartMs())
    await Promise.all(soundEngines.map((engine) => engine.play()))
    isPlaying.value = true
  }

  const restartPlaybackFromLine = async (line: number): Promise<void> => {
    selectedLines.value[activeSourceCodeIndex.value] = line
    await restartPlaybackFromSelectedLine()
  }

  const restartPlaybackFromStart = async (): Promise<void> => {
    await restartPlaybackFromLine(0)
  }

  const togglePlayback = async (): Promise<void> => {
    if (isPlaying.value) {
      await Promise.all(soundEngines.map((engine) => engine.pause()))
      isPlaying.value = false
      playbackPositionMs.value = -1
      return
    }

    await restartPlaybackFromSelectedLine()
  }

  const toggleLoop = (): void => {
    isLooping.value = !isLooping.value
    soundEngines.forEach((engine) => engine.setLoopActive(isLooping.value))
  }

  const syncPlaybackPosition = (): void => {
    const position = activeSoundEngine().playing() ? activeSoundEngine().position() : -1
    if (!isLooping.value && position >= maxEndPosition() && maxEndPosition() > 0) {
      void Promise.all(soundEngines.map((engine) => engine.pause()))
      isPlaying.value = false
      playbackPositionMs.value = -1
      return
    }

    playbackPositionMs.value = position
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

    const cancelEndListeners = soundEngines.map((engine) =>
      engine.onEnd(() => {
        if (activeSoundEngine().position() >= maxEndPosition()) isPlaying.value = false
      }),
    )
    cancelOnEnd = () => cancelEndListeners.forEach((cancel) => cancel())

    const cancelNoteListeners = soundEngines.map((engine) =>
      engine.onNote((note: MoscNoteMs, on: boolean) => {
        activeNoteHandler?.(note, on)
      }),
    )
    cancelOnNote = () => cancelNoteListeners.forEach((cancel) => cancel())
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

  const addSourceCode = (): void => {
    const nextSources = [...sourceCodes.value, '']
    setSourceCodes(nextSources)
    activeSourceCodeIndex.value = nextSources.length - 1
  }

  const removeSourceCode = (index: number): void => {
    if (sourceCodes.value.length <= 1) return

    const nextSources = sourceCodes.value.filter((_, sourceIndex) => sourceIndex !== index)
    setSourceCodes(nextSources)
    if (activeSourceCodeIndex.value >= nextSources.length) {
      activeSourceCodeIndex.value = nextSources.length - 1
    }
  }

  const setActiveSourceCodeIndex = (index: number): void => {
    if (index < 0 || index >= sourceCodes.value.length) return

    activeSourceCodeIndex.value = index
  }

  return {
    sourceCodes,
    sourceCode,
    activeSourceCodeIndex,
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
    addSourceCode,
    removeSourceCode,
    setActiveSourceCodeIndex,
    setSelectedLine,
    setDemoTune,
    undoSourceCode,
    redoSourceCode,
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
