<script setup lang="ts">
import type { CharData } from '../grammars/grammar-to-chars'
import { computed } from 'vue'

import type { SourceDisplayToken, SourceTab } from '../types'
import SourceCodePane from './SourceCodePane.vue'

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
  selectSourceCodeTab: [index: number]
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
        <div v-for="(tab, index) in liveSourceTabs" :key="tab.id" class="source-tab">
          <button
            class="source-tab-button"
            :class="{ active: tab.active }"
            type="button"
            role="tab"
            :aria-selected="tab.active"
            :title="tab.title"
            :aria-label="tab.title"
            :aria-controls="`source-code-panel-${tab.id}`"
            @click="emit('selectSourceCodeTab', index)"
          >
            {{ tab.title }}
          </button>
        </div>
      </div>
    </div>
    <label class="source-label" for="source-code">Source code</label>
    <div
      class="source-editor source-editor-embed"
      :id="activeSourceTab ? `source-code-panel-${activeSourceTab.id}` : undefined"
      role="tabpanel"
    >
      <SourceCodePane
        readonly
        :source-code="sourceCode"
        :source-display-tokens="sourceDisplayTokens"
        :chars="chars"
        :is-playing="isPlaying"
        :playback-position-time="playbackPositionTime"
      />
    </div>
    <p v-if="lastError" class="playback-error" role="alert">Error: {{ lastError }}</p>
  </main>
</template>
