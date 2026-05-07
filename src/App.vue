<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import TutorialSidebar from './components/TutorialSidebar.vue'
import { parse } from './grammars/grammar.generated.js'
import { processGrammar } from './grammars/process-grammar'
import { scoreToMs } from './mosc'
import { SoundEngineTonejs } from './sound-engine-tonejs'
import type { XenpaperAST } from './grammars/grammar.generated'

const PLAY_PATHS = {
  paused: ['M 0 0 L 12 6 L 0 12 Z'],
  playing: ['M 0 0 L 4 0 L 4 12 L 0 12 Z', 'M 8 0 L 12 0 L 12 12 L 8 12 Z'],
} as const

const soundEngine = new SoundEngineTonejs()
const sourceCode = ref('')
const isPlaying = ref(false)
const isLooping = ref(false)
const scoreLoaded = ref(false)
const lastError = ref('')

const playbackState = computed(() => (isPlaying.value ? 'playing' : 'paused'))
const playbackLabel = computed(() => (isPlaying.value ? 'Pause' : 'Play'))
const playbackPaths = computed(() => PLAY_PATHS[playbackState.value])

const parseSourceCode = (): XenpaperAST => parse(sourceCode.value, { grammarSource: 'source-code' })

const setSourceCode = (tune: string): void => {
  sourceCode.value = tune
}

watch(sourceCode, () => {
  scoreLoaded.value = false
  lastError.value = ''
})

const loadScore = async (): Promise<boolean> => {
  try {
    const { score } = processGrammar(parseSourceCode())

    if (!score) {
      scoreLoaded.value = false
      lastError.value = 'There is no playable score yet.'
      return false
    }

    await soundEngine.setScore(scoreToMs(score))
    soundEngine.setLoopActive(isLooping.value)
    await soundEngine.gotoMs(0)
    scoreLoaded.value = true
    lastError.value = ''
    return true
  } catch (error) {
    scoreLoaded.value = false
    lastError.value =
      error instanceof Error ? error.message : 'Unable to parse Xenpaper source code.'
    return false
  }
}

const logParsedAst = (): void => {
  console.log('Parsed XenpaperAST:', parseSourceCode())
}

const togglePlayback = async (): Promise<void> => {
  if (isPlaying.value) {
    await soundEngine.pause()
    isPlaying.value = false
    return
  }

  if (!scoreLoaded.value || soundEngine.position() >= soundEngine.endPosition()) {
    const loaded = await loadScore()
    if (!loaded) return
  }

  await soundEngine.play()
  isPlaying.value = true
}

const toggleLoop = (): void => {
  isLooping.value = !isLooping.value
  soundEngine.setLoopActive(isLooping.value)
}

const cancelOnEnd = soundEngine.onEnd(() => {
  isPlaying.value = false
})

onUnmounted(() => {
  cancelOnEnd()
})
</script>

<template>
  <div class="app-layout">
    <TutorialSidebar @set-tune="setSourceCode" />

    <main class="xenpaper-app">
      <label class="source-label" for="source-code">Source code</label>
      <textarea
        id="source-code"
        v-model="sourceCode"
        class="source-input"
        placeholder="Enter Xenpaper source code..."
        spellcheck="false"
      />
      <div class="actions" aria-label="Playback controls">
        <button class="icon-toggle playback-button" type="button" @click="togglePlayback">
          <span class="visually-hidden">{{ playbackLabel }}</span>
          <svg aria-hidden="true" class="playback-icon" viewBox="0 0 12 12">
            <path v-for="path in playbackPaths" :key="path" :d="path" />
          </svg>
        </button>
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

.source-input {
  min-height: 20rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  background: var(--color-background-soft);
  font: inherit;
  font-family: monospace;
  resize: vertical;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.icon-toggle,
.action-button {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  background: var(--color-background-mute);
  cursor: pointer;
}

.icon-toggle:hover,
.action-button:hover {
  border-color: hsla(160, 100%, 37%, 1);
}

.icon-toggle:focus-visible,
.action-button:focus-visible {
  outline: 2px solid hsla(160, 100%, 37%, 1);
  outline-offset: 2px;
}

.playback-button {
  display: inline-grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  padding: 0.85rem;
}

.playback-icon {
  width: 100%;
  height: 100%;
}

.playback-icon path {
  fill: currentColor;
}

.action-button {
  padding: 0.75rem 1rem;
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

.visually-hidden {
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

@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
}
</style>
