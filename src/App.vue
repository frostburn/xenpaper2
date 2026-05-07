<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

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
  getShareUrl,
  getSharedSourceFromLocation,
  replaceShareHash,
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

const soundEngine = new SoundEngineTonejs()
const sourceCode = ref(getSavedSourceCode())
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
const shareUrl = computed(() => getShareUrl(sourceCode.value))

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
  replaceShareHash(sourceCode.value)
  void updateParsedSourceCode()
})

const copyShareLink = async (): Promise<void> => {
  if (!shareUrl.value) return

  try {
    await navigator.clipboard?.writeText(shareUrl.value)
    copiedShareLink.value = true
    return
  } catch {
    // Fall back for browsers that do not expose Clipboard API outside secure contexts.
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

const syncSourceCodeFromHash = (): void => {
  const sharedSourceCode = getSharedSourceFromLocation()

  if (sharedSourceCode !== sourceCode.value) {
    sourceCode.value = sharedSourceCode
  }
}

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
  window.addEventListener('hashchange', syncSourceCodeFromHash)
  replaceShareHash(sourceCode.value)
  void updateParsedSourceCode()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncSourceCodeFromHash)
  cancelOnEnd()
  cancelOnNote()
  stopPlaybackAnimation()
})
</script>

<template>
  <div class="app-layout">
    <TutorialSidebar @set-tune="setSourceCode" />

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
        <button class="action-button" type="button" @click="logParsedAst">
          Log parsed XenpaperAST
        </button>
        <label class="share-link">
          <span>Share link</span>
          <input
            class="share-link-input"
            :value="shareUrl"
            type="text"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
        </label>
        <button class="action-button" type="button" @click="copyShareLink">
          {{ copiedShareLink ? 'Copied' : 'Copy share link' }}
        </button>
      </div>
      <p v-if="lastError" class="playback-error" role="alert">{{ lastError }}</p>

      <section class="ruler-panel" aria-labelledby="pitch-ruler-title">
        <div class="ruler-heading">
          <h2 id="pitch-ruler-title">Pitch ruler</h2>
          <p>
            Click and drag to pan, use the mouse wheel to zoom. Plot scales with
            <code>(plot)</code>.
          </p>
        </div>
        <PitchRuler ref="pitchRuler" :initial-state="initialRulerState" />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-columns: minmax(20rem, 28rem) minmax(0, 1fr);
  min-height: 100vh;
}

.xenpaper-app {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(100%, 64rem);
  margin: 0 auto;
  padding: 2rem;
}

.source-label {
  font-weight: 600;
}

.source-editor {
  position: relative;
  min-height: 20rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-background-soft);
  overflow: hidden;
}

.source-editor:focus-within {
  border-color: hsla(160, 100%, 37%, 1);
  box-shadow: 0 0 0 2px hsla(160, 100%, 37%, 0.2);
}

.source-input,
.source-highlights {
  box-sizing: border-box;
  min-height: 20rem;
  width: 100%;
  margin: 0;
  padding: 1rem;
  border: 0;
  color: var(--color-text);
  background: transparent;
  font: inherit;
  font-family: monospace;
  line-height: 1.5;
  tab-size: 2;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.source-input {
  position: absolute;
  inset: 0;
  height: 100%;
  resize: vertical;
  outline: 0;
  caret-color: var(--color-text);
  color: transparent;
  -webkit-text-fill-color: transparent;
}

.source-input::selection {
  background: hsla(160, 100%, 37%, 0.35);
}

.source-highlights {
  position: relative;
  pointer-events: none;
  user-select: none;
}

.placeholder-text {
  color: var(--color-text);
  opacity: 0.5;
  font-style: italic;
}

.source-character {
  transition:
    color 0.2s ease-out,
    background-color 0.2s ease-out;
}

.source-character.active {
  color: #fff;
  background: hsla(160, 100%, 37%, 0.6);
  transition:
    color 0s linear,
    background-color 0s linear;
}

.highlight-delimiter {
  color: #8e8e93;
}

.highlight-pitch {
  color: #5edfff;
}

.highlight-chord {
  color: #ffb86c;
}

.highlight-scaleGroup {
  color: #c792ea;
}

.highlight-scale {
  color: #82e68b;
}

.highlight-setterGroup {
  color: #ff79c6;
}

.highlight-setter {
  color: #ffd866;
}

.highlight-comment,
.highlight-commentStart {
  color: #6a9955;
}

.highlight-error,
.highlight-errorMessage {
  color: #ff5c57;
  background: rgba(255, 92, 87, 0.16);
}

.highlight-unknown {
  color: var(--color-text);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.share-link {
  display: flex;
  flex: 1 1 20rem;
  align-items: center;
  gap: 0.5rem;
  min-width: min(100%, 20rem);
}

.share-link span {
  flex: 0 0 auto;
  font-weight: 600;
}

.share-link-input {
  min-width: 0;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  background: var(--color-background-mute);
  padding: 0.75rem 1rem;
}

.share-link-input:focus-visible {
  outline: 2px solid hsla(160, 100%, 37%, 1);
  outline-offset: 2px;
}

.action-button {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  background: var(--color-background-mute);
  cursor: pointer;
  padding: 0.75rem 1rem;
}

.action-button:hover {
  border-color: hsla(160, 100%, 37%, 1);
}

.action-button:focus-visible {
  outline: 2px solid hsla(160, 100%, 37%, 1);
  outline-offset: 2px;
}

.loop-button.active {
  border-color: hsla(160, 100%, 37%, 1);
  color: var(--color-background);
  background: hsla(160, 100%, 37%, 1);
}

.playback-error {
  margin: 0;
  color: #d14343;
}

.ruler-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ruler-heading h2 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
}

.ruler-heading p {
  margin: 0;
  opacity: 0.75;
}

.ruler-heading code {
  border-radius: 0.25rem;
  background: var(--color-background-mute);
  padding: 0.05rem 0.25rem;
}
@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
}
</style>
