<script setup lang="ts">
import XenpaperEmbedSourceViewer from '../components/XenpaperEmbedSourceViewer.vue'
import { useXenpaperStore } from '../stores/xenpaper'

const xenpaper = useXenpaperStore()
</script>

<template>
  <XenpaperEmbedSourceViewer
    :source-tabs="xenpaper.sourceTabs"
    :source-code="xenpaper.sourceCode"
    :source-display-tokens="xenpaper.sourceDisplayTokens"
    :chars="xenpaper.chars"
    :last-error="xenpaper.lastError"
    :is-playing="xenpaper.isPlaying"
    :playback-position-time="xenpaper.playbackPositionTime"
    @select-source-code-tab="xenpaper.selectSourceCodeTab"
  />
</template>
