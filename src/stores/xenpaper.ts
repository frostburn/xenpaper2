import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

import { type CharData } from '../grammars/grammar-to-chars'
import { type MoscNoteMs } from '../mosc'
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
import { ScoreEngine } from '../score-engine'
import { SoundEngineTonejs } from '../sound-engine-tonejs'
import { createSourceDisplayTokens } from '../source-display'
import type { OpenSidebarMode, SidebarMode, SourceDisplayToken } from '../types'
import { createHtmlTitle, escapeHtmlAttribute } from '../utils'

const DEFAULT_LOCATION_HREF = 'http://localhost/'

export const useXenpaperStore = defineStore('xenpaper', () => {
  const scoreEngine = reactive(new ScoreEngine(new SoundEngineTonejs()))
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const selectedLine = ref(0)
  const playbackPositionMs = ref(-1)
  const isEmbedMode = ref(false)
  const sidebarMode = ref<SidebarMode>('info')
  const locationHref = ref(DEFAULT_LOCATION_HREF)
  let shouldApplyInitialSidebarMode = true
  let cancelOnEnd: (() => void) | undefined
  let cancelOnNote: (() => void) | undefined
  let activeNoteHandler: ((note: MoscNoteMs, on: boolean) => void) | undefined

  const sourceCode = computed(() => scoreEngine.sourceCode)
  const chars = computed(() => scoreEngine.chars)
  const lastError = computed(() => scoreEngine.lastError)
  const initialRulerState = computed(() =>
    'initialRulerState' in scoreEngine.parsedSource
      ? scoreEngine.parsedSource.initialRulerState
      : undefined,
  )
  const htmlTitle = computed(() => createHtmlTitle(sourceCode.value))
  const sourceDisplayTokens = computed<SourceDisplayToken[]>(() =>
    createSourceDisplayTokens(sourceCode.value),
  )
  const canUndoSourceCode = computed(() => scoreEngine.canUndoSourceCode)
  const canRedoSourceCode = computed(() => scoreEngine.canRedoSourceCode)
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

  const updateParsedSourceCode = async (): Promise<void> => {
    const source = scoreEngine.parsedSource

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

    if (await scoreEngine.updateParsedSourceCode(isLooping.value)) {
      playbackPositionMs.value = -1
    }
  }

  const applySourceCode = (source: string, recordHistory = true): boolean =>
    scoreEngine.setSourceCode(source, recordHistory)

  const initializeSourceCode = (sharedHash: string): void => {
    const source = getSavedSourceCode(sharedHash)
    scoreEngine.resetSourceCode(source)
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
      scoreEngine.resetSourceCode(sharedSourceCode)
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
      !scoreEngine.scoreLoaded ||
      scoreEngine.position() >= scoreEngine.endPosition()
    ) {
      await updateParsedSourceCode()
      if (!scoreEngine.scoreLoaded) return
    }

    await scoreEngine.gotoMs(0)
    await scoreEngine.play()
    isPlaying.value = true
  }

  const undoSourceCode = (): void => {
    scoreEngine.undoSourceCode()
  }

  const redoSourceCode = (): void => {
    scoreEngine.redoSourceCode()
  }

  const setSelectedLine = (line: number): void => {
    selectedLine.value = line
  }

  const updateLoopStart = (): void => {
    scoreEngine.setLoopStart(selectedLine.value)
  }

  const restartPlaybackFromSelectedLine = async (): Promise<void> => {
    const didStart = await scoreEngine.restartPlaybackFromLine(selectedLine.value, isLooping.value)
    if (didStart) isPlaying.value = true
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
      await scoreEngine.pause()
      isPlaying.value = false
      playbackPositionMs.value = -1
      return
    }

    await restartPlaybackFromSelectedLine()
  }

  const toggleLoop = (): void => {
    isLooping.value = !isLooping.value
    scoreEngine.setLoopActive(isLooping.value)
  }

  const syncPlaybackPosition = (): void => {
    playbackPositionMs.value = scoreEngine.playing() ? scoreEngine.position() : -1
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

    cancelOnEnd = scoreEngine.onEnd(() => {
      isPlaying.value = false
    })

    cancelOnNote = scoreEngine.onNote((note: MoscNoteMs, on: boolean) => {
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
