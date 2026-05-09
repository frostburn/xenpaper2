<script setup lang="ts">
import { computed } from 'vue'

import type { CharData } from '../grammars/grammar-to-chars'
import { getSourceLineAtOffset } from '../source-display'
import type { SourceDisplayToken } from '../types'

type SourceTab = {
  id: number
  title: string
  active: boolean
}

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
  closeSourceCodeTab: [index: number]
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

const activeSourceTab = computed(() => props.sourceTabs[props.activeSourceCodeTabIndex])

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
      v-if="!isEmbedMode || sourceTabs.length > 1"
      class="source-tabs"
      role="tablist"
      aria-label="Source codes"
    >
      <div v-for="(tab, index) in sourceTabs" :key="tab.id" class="source-tab">
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
          v-if="!isEmbedMode && sourceTabs.length > 1"
          class="source-tab-close"
          type="button"
          :aria-label="`Close ${tab.title}`"
          @click="emit('closeSourceCodeTab', index)"
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
