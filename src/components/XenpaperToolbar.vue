<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PlayPauseButton from './PlayPauseButton.vue'

type SidebarMode = 'info' | 'share' | 'ruler' | 'none'
type OpenSidebarMode = Exclude<SidebarMode, 'none'>

defineProps<{
  isEmbedMode: boolean
  isPlaying: boolean
  isLooping: boolean
  shareUrl: string
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
  <div class="actions" :class="{ 'actions-embed': isEmbedMode }" aria-label="Playback controls">
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
    <a
      v-if="isEmbedMode"
      class="action-button edit-link"
      :href="shareUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      Edit on Xenpaper 2
    </a>
    <div v-if="!isEmbedMode" class="toolbar-rule" aria-hidden="true"></div>
    <button
      v-if="!isEmbedMode"
      class="action-button"
      type="button"
      :disabled="!canUndoSourceCode"
      @click="emit('undoSourceCode')"
    >
      Undo
    </button>
    <button
      v-if="!isEmbedMode"
      class="action-button"
      type="button"
      :disabled="!canRedoSourceCode"
      @click="emit('redoSourceCode')"
    >
      Redo
    </button>
    <div v-if="!isEmbedMode" class="toolbar-rule" aria-hidden="true"></div>
    <button
      v-if="!isEmbedMode"
      class="action-button"
      :class="{ active: sidebarMode === 'info' }"
      type="button"
      @click="emit('showSidebar', 'info')"
    >
      Info
    </button>
    <button
      v-if="!isEmbedMode"
      class="action-button"
      :class="{ active: sidebarMode === 'share' }"
      type="button"
      @click="emit('showSidebar', 'share')"
    >
      Share
    </button>
    <button
      v-if="!isEmbedMode"
      class="action-button"
      :class="{ active: sidebarMode === 'ruler' }"
      type="button"
      @click="emit('showSidebar', 'ruler')"
    >
      Ruler
    </button>
    <nav v-if="!isEmbedMode" class="route-navigation" aria-label="Application navigation">
      <RouterLink class="action-button route-link" to="/">Home</RouterLink>
      <RouterLink class="action-button route-link" to="/about">About</RouterLink>
    </nav>
  </div>
</template>
