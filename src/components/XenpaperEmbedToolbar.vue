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

<style scoped>
.actions-embed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  flex: 0 0 auto;
  flex-direction: row;
  width: 100%;
  padding-top: 0;
}

.actions-embed .action-button {
  width: auto;
  height: 3rem;
  padding: 1rem 0.5rem;
  font-size: 0.9rem;
  line-height: 1rem;
}

.actions-embed .edit-link {
  margin-left: auto;
}

.actions-embed .play-pause-button {
  width: 3rem;
  height: 3rem;
  padding: 1rem 0.5rem;
}
</style>
