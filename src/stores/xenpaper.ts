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

export const useXenpaperStore = defineStore('xenpaper', () => {
  const soundEngine = new SoundEngineTonejs()
  const sourceCode = ref('')
  const sourceHistory = ref(createSourceHistory(''))
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const selectedLine = ref(0)
  const scoreLoaded = ref(false)
  const playbackPositionMs = ref(-1)
  const isEmbedMode = ref(false)
  const sidebarMode = ref<SidebarMode>('info')
  const locationHref = ref(DEFAULT_LOCATION_HREF)
  let parseVersion = 0
  let shouldApplyInitialSidebarMode = true
  let cancelOnEnd: (() => void) | undefined
  let cancelOnNote: (() => void) | undefined
  let activeNoteHandler: ((note: MoscNoteMs, on: boolean) => void) | undefined

  const parsedSource = computed(() => parseAndProcessSourceCode(sourceCode.value))
  const chars = computed(() => parsedSource.value.chars)
  const lastError = computed(() => parsedSource.value.error)
  const initialRulerState = computed(() =>
    'initialRulerState' in parsedSource.value ? parsedSource.value.initialRulerState : undefined,
  )
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
    const source = parsedSource.value

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

    if (!source.playable) {
      scoreLoaded.value = false
      return
    }

    await soundEngine.setScore(source.scoreMs)
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
