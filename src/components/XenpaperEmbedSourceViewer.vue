<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import type { CharData } from '../grammars/grammar-to-chars'
import type { SourceDisplayToken, SourceTab } from '../types'
import { isCharacterActiveAtTime } from '../utils'

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

const sourceInput = useTemplateRef('sourceInput')
const sourceHighlights = useTemplateRef('sourceHighlights')

const syncHighlightScroll = (): void => {
  if (!sourceInput.value || !sourceHighlights.value) return

  sourceHighlights.value.scrollTop = sourceInput.value.scrollTop
  sourceHighlights.value.scrollLeft = sourceInput.value.scrollLeft
}

const isCharacterActive = (charData?: CharData): boolean =>
  isCharacterActiveAtTime(charData, props.isPlaying, props.playbackPositionTime)

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
    <div
      class="source-editor source-editor-embed"
      :id="activeSourceTab ? `source-code-panel-${activeSourceTab.id}` : undefined"
      role="tabpanel"
    >
      <textarea
        id="source-code"
        ref="sourceInput"
        :value="sourceCode"
        class="source-input"
        placeholder="Type your tune here..."
        readonly
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @scroll="syncHighlightScroll"
      />
      <pre ref="sourceHighlights" class="source-highlights"><span
        v-if="sourceCode === ''"
        class="placeholder-text"
        aria-hidden="true"
      >Type your tune here...</span><template v-else><template v-for="token in sourceDisplayTokens" :key="token.key"><span
        v-if="token.type === 'character'"
        class="source-character"
        aria-hidden="true"
        :class="[
          chars[token.index]?.color
            ? `highlight-${chars[token.index]?.color}`
            : 'highlight-unknown',
          { active: isCharacterActive(chars[token.index]) },
        ]"
      >{{ token.character }}</span></template></template><br><br></pre>
    </div>
    <p v-if="lastError" class="playback-error" role="alert">Error: {{ lastError }}</p>
  </main>
</template>

<style scoped>
.xenpaper-app-embed {
  padding-top: 3rem;
}

.source-editor-embed .source-input {
  cursor: default;
}
</style>
