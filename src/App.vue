<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import PlayPauseButton from './components/PlayPauseButton.vue'
import TutorialSidebar from './components/TutorialSidebar.vue'
import { parse } from './grammars/grammar.generated.js'
import { grammarToChars, type CharData } from './grammars/grammar-to-chars'
import { processGrammar } from './grammars/process-grammar'
import { scoreToMs, type MoscScoreMs } from './mosc'
import { SoundEngineTonejs } from './sound-engine-tonejs'
import type { XenpaperAST } from './grammars/grammar.generated'

type ParsedSource = {
  ast?: XenpaperAST
  chars: CharData[]
  error: string
  playable: boolean
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
const sourceCode = ref('')
const isPlaying = ref(false)
const isLooping = ref(false)
const scoreLoaded = ref(false)
const lastError = ref('')
const chars = ref<CharData[]>([])
const playbackPositionMs = ref(-1)
let parseVersion = 0
let playbackAnimationFrame: number | undefined

const sourceCharacters = computed(() => sourceCode.value.split(''))

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
    const { score } = processGrammar(ast)
    const highlightedChars = grammarToChars(ast)

    if (!score) {
      return {
        ast,
        chars: highlightedChars,
        error: 'There is no playable score yet.',
        playable: false,
      }
    }

    return {
      ast,
      chars: highlightedChars,
      error: '',
      playable: true,
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
  void updateParsedSourceCode()
})

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

onMounted(() => {
  void updateParsedSourceCode()
})

onUnmounted(() => {
  cancelOnEnd()
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
      </div>
      <p v-if="lastError" class="playback-error" role="alert">{{ lastError }}</p>
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
  width: min(100%, 48rem);
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
  transition: color 0.2s ease-out, background-color 0.2s ease-out;
}

.source-character.active {
  color: #fff;
  background: hsla(160, 100%, 37%, 0.6);
  transition: color 0s linear, background-color 0s linear;
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
@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
}
</style>
