<script setup lang="ts">
import { computed } from 'vue'

import SourceCodePanel from './SourceCodePanel.vue'
import type { CharData } from '../grammars/grammar-to-chars'
import type { SourceDisplayToken, SourceTab } from '../types'

const props = defineProps<{
  sourceCode: string
  sourceDisplayTokens: SourceDisplayToken[]
  chars: CharData[]
  lastError: string
  isPlaying: boolean
  playbackPositionTime: number
  sourceTabs: SourceTab[]
}>()

const emit = defineEmits<{
  selectSourceCodeTab: [id: number]
}>()

const activeSourceTab = computed(() => props.sourceTabs.find((tab) => tab.active))
const liveSourceTabs = computed(() => props.sourceTabs.filter((tab) => tab.alive))
</script>

<template>
  <main class="xenpaper-app xenpaper-app-embed">
    <div
      v-if="liveSourceTabs.length > 1"
      class="source-tabs"
      role="tablist"
      aria-label="Source codes"
    >
      <div class="source-tab-list">
        <div v-for="tab in liveSourceTabs" :key="tab.id" class="source-tab">
          <button
            class="source-tab-button"
            :class="{ active: tab.active }"
            type="button"
            role="tab"
            :aria-selected="tab.active"
            :title="tab.title"
            :aria-label="tab.title"
            :aria-controls="`source-code-panel-${tab.id}`"
            @click="emit('selectSourceCodeTab', tab.id)"
          >
            {{ tab.title }}
          </button>
        </div>
      </div>
    </div>
    <label class="source-label" for="source-code">Source code</label>
    <KeepAlive>
      <SourceCodePanel
        v-if="activeSourceTab"
        :id="`source-code-panel-${activeSourceTab.id}`"
        :key="activeSourceTab.id"
        :source-code="sourceCode"
        :source-display-tokens="sourceDisplayTokens"
        :chars="chars"
        :is-playing="isPlaying"
        :playback-position-time="playbackPositionTime"
        :readonly="true"
        :show-play-start-markers="false"
        editor-class="source-editor-embed"
      />
    </KeepAlive>
    <p v-if="lastError" class="playback-error" role="alert">Error: {{ lastError }}</p>
  </main>
</template>

<style scoped>
.xenpaper-app-embed {
  padding-top: 3rem;
}
</style>
