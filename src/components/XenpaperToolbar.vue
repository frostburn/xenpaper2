<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PlayPauseButton from './PlayPauseButton.vue'
import { useXenpaperStore } from '../stores/xenpaper'

const xenpaper = useXenpaperStore()
</script>

<template>
  <div class="actions" :class="{ 'actions-embed': xenpaper.isEmbedMode }" aria-label="Playback controls">
    <PlayPauseButton :playing="xenpaper.isPlaying" @toggle="xenpaper.togglePlayback" />
    <button
      class="action-button loop-button"
      :class="{ active: xenpaper.isLooping }"
      type="button"
      :aria-pressed="xenpaper.isLooping"
      @click="xenpaper.toggleLoop"
    >
      Loop
    </button>
    <a
      v-if="xenpaper.isEmbedMode"
      class="action-button edit-link"
      :href="xenpaper.shareUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      Edit on Xenpaper 2
    </a>
    <div v-if="!xenpaper.isEmbedMode" class="toolbar-rule" aria-hidden="true"></div>
    <button
      v-if="!xenpaper.isEmbedMode"
      class="action-button"
      type="button"
      :disabled="!xenpaper.canUndoSourceCode"
      @click="xenpaper.undoSourceCode"
    >
      Undo
    </button>
    <button
      v-if="!xenpaper.isEmbedMode"
      class="action-button"
      type="button"
      :disabled="!xenpaper.canRedoSourceCode"
      @click="xenpaper.redoSourceCode"
    >
      Redo
    </button>
    <div v-if="!xenpaper.isEmbedMode" class="toolbar-rule" aria-hidden="true"></div>
    <button
      v-if="!xenpaper.isEmbedMode"
      class="action-button"
      :class="{ active: xenpaper.sidebarMode === 'info' }"
      type="button"
      @click="xenpaper.showSidebar('info')"
    >
      Info
    </button>
    <button
      v-if="!xenpaper.isEmbedMode"
      class="action-button"
      :class="{ active: xenpaper.sidebarMode === 'share' }"
      type="button"
      @click="xenpaper.showSidebar('share')"
    >
      Share
    </button>
    <button
      v-if="!xenpaper.isEmbedMode"
      class="action-button"
      :class="{ active: xenpaper.sidebarMode === 'ruler' }"
      type="button"
      @click="xenpaper.showSidebar('ruler')"
    >
      Ruler
    </button>
    <nav v-if="!xenpaper.isEmbedMode" class="route-navigation" aria-label="Application navigation">
      <RouterLink class="action-button route-link" to="/">Home</RouterLink>
      <RouterLink class="action-button route-link" to="/about">About</RouterLink>
    </nav>
  </div>
</template>
