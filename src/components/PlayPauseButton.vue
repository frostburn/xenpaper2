<script setup lang="ts">
import { computed } from 'vue'

const PLAY_PATHS = {
  paused: ['M 0 0 L 12 6 L 0 12 Z'],
  playing: ['M 0 0 L 4 0 L 4 12 L 0 12 Z', 'M 8 0 L 12 0 L 12 12 L 8 12 Z'],
} as const

const props = defineProps<{
  playing: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const playbackState = computed(() => (props.playing ? 'playing' : 'paused'))
const playbackLabel = computed(() => (props.playing ? 'Pause' : 'Play'))
const playbackPaths = computed(() => PLAY_PATHS[playbackState.value])
</script>

<template>
  <button class="play-pause-button" type="button" @click="emit('toggle')">
    <span class="visually-hidden">{{ playbackLabel }}</span>
    <svg aria-hidden="true" class="playback-icon" viewBox="0 0 12 12">
      <path v-for="path in playbackPaths" :key="path" :d="path" />
    </svg>
  </button>
</template>

<style scoped>
.play-pause-button {
  border: 0;
  border-left: 3px solid transparent;
  display: block;
  width: 5rem;
  height: 4rem;
  padding: 1rem;
  cursor: pointer;
  background: transparent;
  color: #ffffff;
  position: relative;
  outline: none;
}

.play-pause-button:hover {
  background: var(--xenpaper-bg-light);
}

.play-pause-button:focus-visible {
  border-left-color: var(--xenpaper-focus);
}

.playback-icon {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0.9;
}

.playback-icon:hover {
  opacity: 1;
}

.playback-icon path {
  fill: currentColor;
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
  .play-pause-button {
    width: 3rem;
    min-width: 3rem;
    height: 3rem;
    padding: 0.4rem;
  }

  .playback-icon {
    width: 100%;
    height: 100%;
  }
}
</style>
