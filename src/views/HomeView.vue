<script setup lang="ts">
import XenpaperSourceEditor from '../components/XenpaperSourceEditor.vue'
import { useXenpaperStore } from '../stores/xenpaper'

const xenpaper = useXenpaperStore()
</script>

<template>
  <XenpaperSourceEditor
    :is-embed-mode="xenpaper.isEmbedMode"
    :source-codes="xenpaper.sourceCodes"
    :source-code="xenpaper.sourceCode"
    :active-source-code-index="xenpaper.activeSourceCodeIndex"
    :source-display-tokens="xenpaper.sourceDisplayTokens"
    :selected-line="xenpaper.selectedLine"
    :chars="xenpaper.chars"
    :last-error="xenpaper.lastError"
    :is-playing="xenpaper.isPlaying"
    :playback-position-ms="xenpaper.playbackPositionMs"
    @update:source-code="xenpaper.setSourceCode"
    @add-source-code="xenpaper.addSourceCode"
    @remove-source-code="xenpaper.removeSourceCode"
    @set-active-source-code-index="xenpaper.setActiveSourceCodeIndex"
    @restart-playback-from-start="xenpaper.restartPlaybackFromStart"
    @restart-playback-from-line="xenpaper.restartPlaybackFromLine"
    @undo-source-code="xenpaper.undoSourceCode"
    @redo-source-code="xenpaper.redoSourceCode"
    @set-selected-line="xenpaper.setSelectedLine"
  />
</template>
