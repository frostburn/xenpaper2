<script setup lang="ts">
import PlayPauseButton from './PlayPauseButton.vue'

defineProps<{
  editUrl: string
  isPlaying: boolean
  isLooping: boolean
}>()

const emit = defineEmits<{
  togglePlayback: []
  toggleLoop: []
}>()
</script>

<template>
  <div class="actions actions-embed" aria-label="Playback controls">
    <PlayPauseButton :playing="isPlaying" @toggle="emit('togglePlayback')" />
    <button
      class="action-button loop-button"
      :class="{ active: isLooping }"
      type="button"
      :aria-pressed="isLooping"
      @click="emit('toggleLoop')"
    >
      Loop
    </button>
    <a class="action-button edit-link" :href="editUrl" target="_blank" rel="noopener noreferrer">
      Edit on Xenpaper 2
    </a>
  </div>
</template>
