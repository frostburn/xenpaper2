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
