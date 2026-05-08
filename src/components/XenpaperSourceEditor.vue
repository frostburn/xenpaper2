<script setup lang="ts">
import type { CharData } from '../grammars/grammar-to-chars'
import type { SourceDisplayToken } from '../types'
import { getSourceLineAtOffset } from '../source-display'

const props = defineProps<{
  isEmbedMode: boolean
  sourceCodes: string[]
  sourceCode: string
  activeSourceCodeIndex: number
  sourceDisplayTokens: SourceDisplayToken[]
  selectedLine: number
  chars: CharData[]
  lastError: string
  isPlaying: boolean
  playbackPositionMs: number
}>()

const emit = defineEmits<{
  'update:sourceCode': [source: string]
  addSourceCode: []
  removeSourceCode: [index: number]
  setActiveSourceCodeIndex: [index: number]
  restartPlaybackFromStart: []
  restartPlaybackFromLine: [line: number]
  undoSourceCode: []
  redoSourceCode: []
  setSelectedLine: [line: number]
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
    <div v-if="!isEmbedMode" class="source-tabs" role="tablist" aria-label="Source codes">
      <button
        v-for="(_, index) in sourceCodes"
        :key="index"
        class="source-tab"
        :class="{ active: activeSourceCodeIndex === index }"
        type="button"
        role="tab"
        :aria-selected="activeSourceCodeIndex === index"
        :aria-controls="'source-code'"
        @click="emit('setActiveSourceCodeIndex', index)"
      >
        <span>Source {{ index + 1 }}</span>
        <span
          v-if="sourceCodes.length > 1"
          class="source-tab-close"
          role="button"
          tabindex="0"
          :aria-label="`Delete source ${index + 1}`"
          @click.stop="emit('removeSourceCode', index)"
          @keydown.enter.stop.prevent="emit('removeSourceCode', index)"
          @keydown.space.stop.prevent="emit('removeSourceCode', index)"
          >×</span
        >
      </button>
      <button
        class="source-tab source-tab-add"
        type="button"
        aria-label="Add source code"
        @click="emit('addSourceCode')"
      >
        +
      </button>
    </div>
    <label class="source-label" for="source-code">Source code</label>
    <div class="source-editor" :class="{ 'source-editor-embed': isEmbedMode }">
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
