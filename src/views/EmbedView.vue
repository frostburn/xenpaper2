<script setup lang="ts">
import XenpaperEmbedSourceViewer from '../components/XenpaperEmbedSourceViewer.vue'
import { useXenpaperStore } from '../stores/xenpaper'

const xenpaper = useXenpaperStore()
</script>

<template>
  <XenpaperEmbedSourceViewer
    :source-tabs="xenpaper.sourceTabs"
    :active-source-code-tab-index="xenpaper.activeSourceCodeTabIndex"
    :source-code="xenpaper.sourceCode"
    :source-display-tokens="xenpaper.sourceDisplayTokens"
    :selected-line="xenpaper.selectedLine"
    :chars="xenpaper.chars"
    :last-error="xenpaper.lastError"
    :is-playing="xenpaper.isPlaying"
    :playback-position-time="xenpaper.playbackPositionTime"
    @restart-playback-from-start="xenpaper.restartPlaybackFromStart"
    @restart-playback-from-line="xenpaper.restartPlaybackFromLine"
    @set-selected-line="xenpaper.setSelectedLine"
    @select-source-code-tab="xenpaper.selectSourceCodeTab"
    @toggle-source-code-tab-mute="xenpaper.toggleSourceCodeTabMute"
    @toggle-source-code-tab-solo="xenpaper.toggleSourceCodeTabSolo"
  />
</template>
