<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PlayPauseButton from './PlayPauseButton.vue'

import type { OpenSidebarMode, SidebarMode } from '../types'

defineProps<{
  isPlaying: boolean
  isLooping: boolean
  canUndoSourceCode: boolean
  canRedoSourceCode: boolean
  sidebarMode: SidebarMode
}>()

const emit = defineEmits<{
  togglePlayback: []
  toggleLoop: []
  undoSourceCode: []
  redoSourceCode: []
  showSidebar: [mode: OpenSidebarMode]
}>()
</script>

<template>
  <div class="actions" aria-label="Playback controls">
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
    <div class="toolbar-rule" aria-hidden="true"></div>
    <button
      class="action-button"
      type="button"
      :disabled="!canUndoSourceCode"
      @click="emit('undoSourceCode')"
    >
      Undo
    </button>
    <button
      class="action-button"
      type="button"
      :disabled="!canRedoSourceCode"
      @click="emit('redoSourceCode')"
    >
      Redo
    </button>
    <div class="toolbar-rule" aria-hidden="true"></div>
    <button
      class="action-button"
      :class="{ active: sidebarMode === 'info' }"
      type="button"
      @click="emit('showSidebar', 'info')"
    >
      Info
    </button>
    <button
      class="action-button"
      :class="{ active: sidebarMode === 'share' }"
      type="button"
      @click="emit('showSidebar', 'share')"
    >
      Share
    </button>
    <button
      class="action-button"
      :class="{ active: sidebarMode === 'ruler' }"
      type="button"
      @click="emit('showSidebar', 'ruler')"
    >
      Ruler
    </button>
    <nav class="route-navigation" aria-label="Application navigation">
      <RouterLink class="action-button route-link" to="/">Home</RouterLink>
      <RouterLink class="action-button route-link" to="/about">About</RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.toolbar-rule {
  margin: 0.75rem 0.5rem;
  border-top: 1px solid var(--xenpaper-bg-light);
}

.route-navigation {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--xenpaper-bg-light);
}

.route-link.router-link-active {
  color: var(--xenpaper-bg);
  background: var(--xenpaper-cyan);
}

@media (max-width: 900px) {
  .actions {
    position: sticky;
    top: 0;
    z-index: 5;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
    width: 100%;
    padding-top: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .actions .action-button,
  .actions .toolbar-rule,
  .actions .route-navigation {
    flex: 0 0 auto;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4.25rem;
    min-width: 4.25rem;
    height: 3rem;
    padding: 0.5rem;
    font-size: 0.95rem;
    line-height: 1.1;
    white-space: nowrap;
    text-align: center;
  }

  .toolbar-rule {
    margin: 0.5rem 0.25rem;
    border-top: 0;
    border-left: 1px solid var(--xenpaper-bg-light);
  }

  .route-navigation {
    display: flex;
    flex-direction: row;
    margin-top: 0;
    margin-left: 0;
    padding-top: 0;
    border-top: 0;
    border-left: 1px solid var(--xenpaper-bg-light);
  }
}

</style>
