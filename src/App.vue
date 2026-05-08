<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PlayPauseButton from './components/PlayPauseButton.vue'
import PitchRuler from './components/PitchRuler.vue'
import TutorialSidebar from './components/TutorialSidebar.vue'
import { parse } from './grammars/grammar.generated.js'
import { grammarToChars, type CharData } from './grammars/grammar-to-chars'
import { processGrammar, type InitialRulerState } from './grammars/process-grammar'
import { scoreToMs, type MoscNoteMs, type MoscScoreMs } from './mosc'
import { SoundEngineTonejs } from './sound-engine-tonejs'
import type { XenpaperAST } from './grammars/grammar.generated'
import {
  getSavedSourceCode,
  getShareHash,
  getSharedSourceCode,
  hasSharedSourceCode,
  saveSourceCode,
} from './share-link'

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

const soundEngine = new SoundEngineTonejs()
const sourceCode = ref(getSavedSourceCode(getInitialRouteHash()))
const isPlaying = ref(false)
const isLooping = ref(false)
const scoreLoaded = ref(false)
const lastError = ref('')
const chars = ref<CharData[]>([])
const initialRulerState = ref<InitialRulerState>()
const pitchRuler = ref<InstanceType<typeof PitchRuler>>()
const playbackPositionMs = ref(-1)
const copiedShareLink = ref(false)
let parseVersion = 0
let playbackAnimationFrame: number | undefined

const sourceCharacters = computed(() => sourceCode.value.split(''))
const shareRoute = computed(() =>
  router.resolve({
    path: route.path,
    query: route.query,
    hash: getShareHash(sourceCode.value),
  }),
)
const shareUrl = computed(() => new URL(shareRoute.value.href, window.location.href).toString())

const parseSourceCode = (): XenpaperAST => parse(sourceCode.value, { grammarSource: 'source-code' })

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
      error: error instanceof Error ? error.message : 'Unable to parse Xenpaper source code.',
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

const setSourceCode = (tune: string): void => {
  sourceCode.value = tune
}

watch(sourceCode, () => {
  copiedShareLink.value = false
  void replaceShareRoute()
  void updateParsedSourceCode()
})

const replaceShareRoute = async (): Promise<void> => {
  saveSourceCode(sourceCode.value)

  const shareHash = getShareHash(sourceCode.value)
  if (route.hash === shareHash) return

  await router.replace({
    path: route.path,
    query: route.query,
    hash: shareHash,
  })
}

const copyShareLink = async (): Promise<void> => {
  if (!shareUrl.value) return

  const writeClipboardText = navigator.clipboard?.writeText

  if (writeClipboardText) {
    try {
      await writeClipboardText.call(navigator.clipboard, shareUrl.value)
      copiedShareLink.value = true
      return
    } catch {
      // Fall back for browsers that do not expose Clipboard API outside secure contexts.
    }
  }

  const textArea = document.createElement('textarea')
  textArea.value = shareUrl.value
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.append(textArea)
  textArea.select()
  copiedShareLink.value = document.execCommand('copy')
  textArea.remove()
}

watch(
  () => route.hash,
  (sharedHash) => {
    const sharedSourceCode = getSharedSourceCode(sharedHash)

    if (hasSharedSourceCode(sharedHash) && sharedSourceCode !== sourceCode.value) {
      sourceCode.value = sharedSourceCode
    }
  },
)

const logParsedAst = (): void => {
  console.log('Parsed XenpaperAST:', parseSourceCode())
}

const togglePlayback = async (): Promise<void> => {
  if (isPlaying.value) {
    await soundEngine.pause()
    isPlaying.value = false
    playbackPositionMs.value = -1
    return
  }

  if (!scoreLoaded.value || soundEngine.position() >= soundEngine.endPosition()) {
    await updateParsedSourceCode()
    if (!scoreLoaded.value) return
  }

  await soundEngine.play()
  isPlaying.value = true
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

const cancelOnEnd = soundEngine.onEnd(() => {
  isPlaying.value = false
})

const cancelOnNote = soundEngine.onNote((note: MoscNoteMs, on: boolean) => {
  pitchRuler.value?.setActiveNote(note, on)
})

onMounted(() => {
  void replaceShareRoute()
  void updateParsedSourceCode()
})

onUnmounted(() => {
  cancelOnEnd()
  cancelOnNote()
  stopPlaybackAnimation()
})
</script>

<template>
  <div class="app-layout">
    <div class="actions" aria-label="Playback controls">
      <PlayPauseButton :playing="isPlaying" @toggle="togglePlayback" />
      <button
        class="action-button loop-button"
        :class="{ active: isLooping }"
        type="button"
        :aria-pressed="isLooping"
        @click="toggleLoop"
      >
        Loop
      </button>
      <button class="action-button" type="button" @click="logParsedAst">Log AST</button>
      <label class="share-link">
        <span>Share</span>
        <input
          class="share-link-input"
          :value="shareUrl"
          type="text"
          readonly
          @focus="($event.target as HTMLInputElement).select()"
        />
      </label>
      <button class="action-button" type="button" @click="copyShareLink">
        {{ copiedShareLink ? 'Copied' : 'Copy link' }}
      </button>
    </div>

    <main class="xenpaper-app">
      <label class="source-label" for="source-code">Source code</label>
      <div class="source-editor">
        <textarea
          id="source-code"
          v-model="sourceCode"
          class="source-input"
          placeholder="Enter Xenpaper source code..."
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        />
        <pre class="source-highlights" aria-hidden="true"><span
          v-if="sourceCode === ''"
          class="placeholder-text"
        >Enter Xenpaper source code...</span><template v-else><span
          v-for="(character, index) in sourceCharacters"
          :key="index"
          class="source-character"
          :class="[chars[index]?.color ? `highlight-${chars[index]?.color}` : 'highlight-unknown', { active: isCharacterActive(chars[index]) }]"
        >{{ character }}</span></template><br><br></pre>
      </div>
      <p v-if="lastError" class="playback-error" role="alert">Error: {{ lastError }}</p>
    </main>

    <aside class="sidebar-stack">
      <TutorialSidebar @set-tune="setSourceCode" />
      <section class="ruler-panel" aria-labelledby="pitch-ruler-title">
        <div class="ruler-heading">
          <h2 id="pitch-ruler-title">Pitch ruler</h2>
          <p>Click and drag to pan, use mousewheel to zoom.</p>
        </div>
        <PitchRuler ref="pitchRuler" :initial-state="initialRulerState" />
      </section>
    </aside>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  background: var(--xenpaper-bg);
  color: var(--xenpaper-text);
}

.xenpaper-app {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow: auto;
  padding: 1.5rem 0 0 1rem;
}

.source-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.source-editor {
  position: relative;
  min-height: calc(100vh - 1.5rem);
  line-height: 1.4em;
  font-size: clamp(1.1rem, 1.65vw, 1.4rem);
}

.source-editor::before {
  content: '';
  display: block;
  width: 3px;
  height: 4rem;
  background-color: transparent;
  transition: background-color 0.2s ease-out;
  position: absolute;
  top: 12px;
  left: 0;
}

.source-editor:focus-within::before {
  background-color: var(--xenpaper-focus);
}

.source-input,
.source-highlights {
  box-sizing: border-box;
  min-height: calc(100vh - 1.5rem);
  width: 100%;
  margin: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-family: var(--xenpaper-font-mono);
  line-height: inherit;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: keep-all;
  overflow-wrap: break-word;
  padding: 1rem 1rem 1rem 2rem;
}

.source-input {
  position: absolute;
  inset: 0;
  height: 100%;
  resize: none;
  outline: 0;
  caret-color: var(--xenpaper-text);
  color: inherit;
  overflow: hidden;
  -webkit-text-fill-color: transparent;
}

.source-input::selection {
  background: var(--xenpaper-cyan);
}

.source-highlights {
  position: relative;
  pointer-events: none;
  user-select: none;
}

.placeholder-text {
  color: var(--xenpaper-placeholder);
  font-style: italic;
}

.source-character {
  transition: color 0.2s ease-out;
}

.source-character.active {
  color: #ffffff;
  transition: color 0s linear;
}

.highlight-delimiter {
  color: var(--xenpaper-placeholder);
}

.highlight-pitch,
.highlight-chord {
  color: var(--xenpaper-cyan);
}

.highlight-scaleGroup {
  color: #94472f;
}

.highlight-scale {
  color: #ff541e;
}

.highlight-setterGroup {
  color: #821361;
}

.highlight-setter {
  color: #d61ba4;
}

.highlight-comment {
  color: #ffffff;
}

.highlight-commentStart {
  color: var(--xenpaper-placeholder);
}

.highlight-error,
.highlight-errorMessage {
  color: #cc0000;
}

.highlight-unknown {
  color: #a490b3;
}

.actions {
  flex: 0 0 5rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding-top: 2rem;
  background: var(--xenpaper-bg);
  z-index: 4;
}

.share-link {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  width: 5rem;
  color: #ffffff;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.share-link-input {
  width: 100%;
  min-width: 0;
  border: 1px solid #a490b3;
  color: #ffffff;
  background: var(--xenpaper-bg);
  padding: 0.25rem;
  font: inherit;
  text-transform: none;
}

.share-link-input:focus-visible {
  outline: 0;
  border-color: var(--xenpaper-cyan);
}

.action-button {
  border: 0;
  border-left: 3px solid transparent;
  display: block;
  width: 5rem;
  padding: 0.5rem;
  cursor: pointer;
  background: var(--xenpaper-bg);
  color: #ffffff;
  outline: none;
  font-family: var(--xenpaper-font-mono);
  font-size: 1.1rem;
  text-align: center;
  text-transform: uppercase;
}

.action-button:hover,
.action-button:focus,
.action-button:active {
  background: var(--xenpaper-bg-light);
}

.action-button:focus-visible {
  border-left-color: var(--xenpaper-focus);
}

.loop-button.active {
  color: var(--xenpaper-bg);
  background: var(--xenpaper-placeholder);
}

.playback-error {
  position: relative;
  margin: 0;
  padding: 0 0 1rem 1rem;
  color: #cc0000;
  font-family: var(--xenpaper-font-mono);
}

.sidebar-stack {
  flex: 0 0 clamp(20rem, 40vw, 30rem);
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--xenpaper-bg-light);
  font-family: var(--xenpaper-font-copy);
}

.ruler-panel {
  flex: 0 0 42%;
  display: flex;
  flex-direction: column;
  min-height: 18rem;
  border-top: 1px solid var(--xenpaper-bg);
  overflow: hidden;
}

.ruler-heading {
  padding: 1rem 2rem;
  background: var(--xenpaper-bg);
}

.ruler-heading h2 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  font-weight: 400;
}

.ruler-heading p {
  margin: 0;
  color: var(--xenpaper-placeholder);
  font-style: italic;
  line-height: 1.3rem;
}

@media (max-width: 640px) {
  .app-layout {
    display: block;
    height: auto;
    overflow: visible;
  }

  .actions {
    position: sticky;
    top: 0;
    flex-direction: row;
    width: 100%;
    padding-top: 0;
  }

  .action-button,
  .share-link {
    width: auto;
  }

  .share-link {
    flex: 1 1 auto;
  }

  .source-editor,
  .source-input,
  .source-highlights {
    min-height: 50vh;
  }

  .sidebar-stack {
    height: auto;
  }
}
</style>
