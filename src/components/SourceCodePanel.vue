<script setup lang="ts">
import { nextTick, onActivated, onMounted, useTemplateRef } from 'vue'

import type { CharData } from '../grammars/grammar-to-chars'
import { getSourceLineAtOffset } from '../source-display'
import type { SourceDisplayToken } from '../types'
import { isCharacterActiveAtTime } from '../utils'

const props = withDefaults(
  defineProps<{
    id: string
    sourceCode: string
    sourceDisplayTokens: SourceDisplayToken[]
    chars: CharData[]
    selectedLine?: number
    isPlaying: boolean
    playbackPositionTime: number
    readonly?: boolean
    showPlayStartMarkers?: boolean
    editorClass?: string
  }>(),
  {
    selectedLine: 0,
    readonly: false,
    showPlayStartMarkers: true,
    editorClass: '',
  },
)

const emit = defineEmits<{
  'update:sourceCode': [source: string]
  restartPlaybackFromStart: []
  restartPlaybackFromLine: [line: number]
  undoSourceCode: []
  redoSourceCode: []
  setSelectedLine: [line: number]
}>()

const sourceInput = useTemplateRef('sourceInput')
const sourceHighlights = useTemplateRef('sourceHighlights')

const savedScroll = {
  top: 0,
  left: 0,
}

const restoreSourceScroll = (): void => {
  if (!sourceInput.value) return

  sourceInput.value.scrollTop = savedScroll.top
  sourceInput.value.scrollLeft = savedScroll.left
}

const syncHighlightScroll = (): void => {
  if (!sourceInput.value || !sourceHighlights.value) return

  savedScroll.top = sourceInput.value.scrollTop
  savedScroll.left = sourceInput.value.scrollLeft
  sourceHighlights.value.scrollTop = sourceInput.value.scrollTop
  sourceHighlights.value.scrollLeft = sourceInput.value.scrollLeft
}

const restoreAndSyncHighlightScroll = async (): Promise<void> => {
  await nextTick()
  restoreSourceScroll()
  syncHighlightScroll()
}

const handleSourceInput = (event: Event): void => {
  if (props.readonly) return

  emit('update:sourceCode', (event.target as HTMLTextAreaElement).value)
}

const handleSourceKeydown = (event: KeyboardEvent): void => {
  if (props.readonly || !(event.ctrlKey || event.metaKey)) return

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

const isCharacterActive = (charData?: CharData): boolean =>
  isCharacterActiveAtTime(charData, props.isPlaying, props.playbackPositionTime)

onMounted(restoreAndSyncHighlightScroll)
onActivated(restoreAndSyncHighlightScroll)
</script>

<template>
  <div class="source-editor" :class="editorClass" :id="id" role="tabpanel">
    <div class="source-editor-content">
      <slot name="controls" />
      <textarea
        id="source-code"
        ref="sourceInput"
        :value="sourceCode"
        class="source-input"
        placeholder="Type your tune here…"
        :readonly="readonly"
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @input="handleSourceInput"
        @keydown="handleSourceKeydown"
        @scroll="syncHighlightScroll"
      />
      <pre ref="sourceHighlights" class="source-highlights"><span
        v-if="sourceCode === ''"
        class="placeholder-text"
        aria-hidden="true"
      >Type your tune here…</span><template v-else><template v-for="token in sourceDisplayTokens" :key="token.key"><button
        v-if="showPlayStartMarkers && token.type === 'playStart'"
        class="play-start-marker"
        :class="{ selected: selectedLine === token.line }"
        type="button"
        :aria-label="`Start playback at line ${token.line + 1}`"
        :aria-pressed="selectedLine === token.line"
        @click="emit('setSelectedLine', token.line)"
      >&gt;</button><span
        v-else-if="token.type === 'character'"
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
  </div>
</template>

<style scoped>
.play-start-marker {
  position: absolute;
  left: 0.8rem;
  border: 0;
  display: block;
  padding: 0;
  cursor: pointer;
  background: transparent;
  color: var(--xenpaper-placeholder);
  font: inherit;
  line-height: inherit;
  outline: none;
  opacity: 0.2;
  pointer-events: auto;
  transition: opacity 0.2s ease-out;
}

.play-start-marker.selected,
.play-start-marker:hover,
.play-start-marker:focus,
.play-start-marker:active {
  opacity: 1;
}

.play-start-marker:focus-visible {
  color: var(--xenpaper-focus);
}

.source-editor.source-editor-embed .source-input {
  cursor: default;
}
</style>
