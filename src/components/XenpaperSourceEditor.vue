<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { CharData } from '../grammars/grammar-to-chars'
import { getSourceLineAtOffset } from '../source-display'
import type { SourceDisplayToken, SourceTab } from '../types'

const props = defineProps<{
  isEmbedMode: boolean
  sourceCode: string
  sourceDisplayTokens: SourceDisplayToken[]
  selectedLine: number
  chars: CharData[]
  lastError: string
  isPlaying: boolean
  playbackPositionMs: number
  sourceTabs: SourceTab[]
  activeSourceCodeTabIndex: number
}>()

const emit = defineEmits<{
  'update:sourceCode': [source: string]
  restartPlaybackFromStart: []
  restartPlaybackFromLine: [line: number]
  undoSourceCode: []
  redoSourceCode: []
  setSelectedLine: [line: number]
  addSourceCodeTab: []
  selectSourceCodeTab: [index: number]
  closeSourceCodeTab: [id: number]
}>()

const handleSourceInput = (event: Event): void => {
  emit('update:sourceCode', (event.target as HTMLTextAreaElement).value)
}

const handleSourceKeydown = (event: KeyboardEvent): void => {
  if (!(event.ctrlKey || event.metaKey)) return

  if (event.key === 'Enter') {
    event.preventDefault()
    emit('restartPlaybackFromStart')
    return
  }

  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault()
    const target = event.target
    const line =
      target instanceof HTMLTextAreaElement
        ? getSourceLineAtOffset(props.sourceCode, target.selectionStart)
        : props.selectedLine
    emit('restartPlaybackFromLine', line)
    return
  }

  const key = event.key.toLowerCase()

  if (key === 'z' && event.shiftKey) {
    event.preventDefault()
    emit('redoSourceCode')
    return
  }

  if (key === 'z') {
    event.preventDefault()
    emit('undoSourceCode')
    return
  }

  if (key === 'y') {
    event.preventDefault()
    emit('redoSourceCode')
  }
}

const restoreMenu = ref<HTMLDetailsElement>()

const activeSourceTab = computed(() => props.sourceTabs[props.activeSourceCodeTabIndex])
const liveSourceTabs = computed(() => props.sourceTabs.filter((tab) => tab.alive))
const deadSourceTabs = computed(() =>
  props.sourceTabs.map((tab, index) => ({ ...tab, index })).filter((tab) => !tab.alive),
)
const liveSourceTabCount = computed(() => liveSourceTabs.value.length)

const closeRestoreMenu = (): void => {
  if (!restoreMenu.value) return

  restoreMenu.value.open = false
}

const restoreSourceCodeTab = (index: number): void => {
  emit('selectSourceCodeTab', index)
  closeRestoreMenu()
}

const handleDocumentPointerdown = (event: PointerEvent): void => {
  if (!restoreMenu.value?.open) return

  const target = event.target
  if (!(target instanceof Node) || restoreMenu.value.contains(target)) return

  closeRestoreMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerdown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerdown)
})

const isCharacterActive = (charData?: CharData): boolean => {
  const [start, end] = charData?.playTime ?? []

  return (
    props.isPlaying &&
    start !== undefined &&
    end !== undefined &&
    props.playbackPositionMs >= start &&
    props.playbackPositionMs < end
  )
}
</script>

<template>
  <main class="xenpaper-app" :class="{ 'xenpaper-app-embed': isEmbedMode }">
    <div
      v-if="!isEmbedMode || liveSourceTabs.length > 1"
      class="source-tabs"
      role="tablist"
      aria-label="Source codes"
    >
      <div v-for="(tab, index) in liveSourceTabs" :key="tab.id" class="source-tab">
        <button
          class="source-tab-button"
          :class="{ active: tab.active }"
          type="button"
          role="tab"
          :aria-selected="tab.active"
          :aria-controls="`source-code-panel-${tab.id}`"
          @click="emit('selectSourceCodeTab', index)"
        >
          {{ tab.title }}
        </button>
        <button
          v-if="!isEmbedMode && liveSourceTabCount > 1"
          class="source-tab-close"
          type="button"
          :aria-label="`Close ${tab.title}`"
          @click="emit('closeSourceCodeTab', tab.id)"
        >
          ×
        </button>
      </div>
      <button
        v-if="!isEmbedMode"
        class="source-tab-add"
        type="button"
        aria-label="Add source code"
        @click="emit('addSourceCodeTab')"
      >
        +
      </button>
      <details
        v-if="!isEmbedMode && deadSourceTabs.length"
        ref="restoreMenu"
        class="source-tab-restore-menu"
      >
        <summary class="source-tab-restore-summary">Recently closed</summary>
        <div class="source-tab-restore-list">
          <button
            v-for="tab in deadSourceTabs"
            :key="tab.id"
            class="source-tab-restore-button"
            type="button"
            :title="`Restore ${tab.title}`"
            @click="restoreSourceCodeTab(tab.index)"
          >
            {{ tab.title }}
          </button>
        </div>
      </details>
    </div>
    <label class="source-label" for="source-code">Source code</label>
    <div
      class="source-editor"
      :id="activeSourceTab ? `source-code-panel-${activeSourceTab.id}` : undefined"
      role="tabpanel"
      :class="{ 'source-editor-embed': isEmbedMode }"
    >
      <textarea
        id="source-code"
        :value="sourceCode"
        class="source-input"
        placeholder="Type your tune here..."
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        :readonly="isEmbedMode"
        @input="handleSourceInput"
        @keydown="handleSourceKeydown"
      />
      <pre class="source-highlights"><span
        v-if="sourceCode === ''"
        class="placeholder-text"
        aria-hidden="true"
      >Type your tune here...</span><template v-else><template v-for="token in sourceDisplayTokens" :key="token.key"><button
        v-if="token.type === 'playStart'"
        class="play-start-marker"
        :class="{ selected: selectedLine === token.line }"
        type="button"
        :aria-label="`Start playback at line ${token.line + 1}`"
        :aria-pressed="selectedLine === token.line"
        @click="emit('setSelectedLine', token.line)"
      >&gt;</button><span
        v-else
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
