<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'

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
const editorSourceTabs = computed(() => [
  ...liveSourceTabs.value.filter((tab) => tab.active),
  ...liveSourceTabs.value.filter((tab) => !tab.active),
])

watch(
  () => activeSourceTab.value?.id,
  async (tabId) => {
    if (tabId === undefined) return

    await nextTick()
    restoreSourceScroll(tabId)
    syncHighlightScroll(tabId)
  },
)

type ScrollPosition = {
  top: number
  left: number
}

const sourceInputs = new Map<number, HTMLTextAreaElement>()
const sourceHighlights = new Map<number, HTMLPreElement>()
const sourceScrollPositions = new Map<number, ScrollPosition>()

const setSourceInputRef = (tabId: number, element: unknown): void => {
  if (element instanceof HTMLTextAreaElement) {
    sourceInputs.set(tabId, element)
    return
  }

  sourceInputs.delete(tabId)
}

const setSourceHighlightsRef = (tabId: number, element: unknown): void => {
  if (element instanceof HTMLPreElement) {
    sourceHighlights.set(tabId, element)
    return
  }

  sourceHighlights.delete(tabId)
}

const restoreSourceScroll = (tabId: number): void => {
  const sourceInput = sourceInputs.get(tabId)
  const savedScroll = sourceScrollPositions.get(tabId)
  if (!sourceInput || !savedScroll) return

  sourceInput.scrollTop = savedScroll.top
  sourceInput.scrollLeft = savedScroll.left
}

const syncHighlightScroll = (tabId: number): void => {
  const sourceInput = sourceInputs.get(tabId)
  const highlights = sourceHighlights.get(tabId)
  if (!sourceInput || !highlights) return

  sourceScrollPositions.set(tabId, {
    top: sourceInput.scrollTop,
    left: sourceInput.scrollLeft,
  })
  highlights.scrollTop = sourceInput.scrollTop
  highlights.scrollLeft = sourceInput.scrollLeft
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
      v-for="tab in editorSourceTabs"
      v-show="tab.active"
      :key="tab.id"
      class="source-editor source-editor-embed"
      :id="`source-code-panel-${tab.id}`"
      role="tabpanel"
    >
      <textarea
        :id="tab.active ? 'source-code' : undefined"
        :ref="(element) => setSourceInputRef(tab.id, element)"
        :value="tab.active ? sourceCode : tab.sourceCode"
        class="source-input"
        placeholder="Type your tune here…"
        readonly
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @scroll="syncHighlightScroll(tab.id)"
      />
      <pre
        :ref="(element) => setSourceHighlightsRef(tab.id, element)"
        class="source-highlights"
      ><span
        v-if="(tab.active ? sourceCode : tab.sourceCode) === ''"
        class="placeholder-text"
        aria-hidden="true"
      >Type your tune here…</span><template v-else><template v-for="token in tab.active ? sourceDisplayTokens : []" :key="token.key"><span
        v-if="token.type === 'character'"
        class="source-character"
        aria-hidden="true"
        :class="[
          token.charDataIndex !== undefined && chars[token.charDataIndex]?.color
            ? `highlight-${chars[token.charDataIndex]?.color}`
            : 'highlight-unknown',
          {
            active:
              token.charDataIndex !== undefined && isCharacterActive(chars[token.charDataIndex]),
          },
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
