<script setup lang="ts">
import { computed, onMounted, onUnmounted, useTemplateRef } from 'vue'

import type { CharData } from '../grammars/grammar-to-chars'
import { getSourceLineAtOffset } from '../source-display'
import type { SourceDisplayToken, SourceTab } from '../types'

const props = defineProps<{
  sourceCode: string
  sourceDisplayTokens: SourceDisplayToken[]
  selectedLine: number
  chars: CharData[]
  lastError: string
  isPlaying: boolean
  playbackPositionTime: number
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
  selectSourceCodeTab: [id: number]
  toggleSourceCodeTabMute: [id: number]
  toggleSourceCodeTabSolo: [id: number, preserveOtherSolos?: boolean]
  closeSourceCodeTab: [id: number]
}>()

const handleSourceInput = (event: Event): void => {
  emit('update:sourceCode', (event.target as HTMLTextAreaElement).value)
}

const sourceInput = useTemplateRef('sourceInput')
const sourceHighlights = useTemplateRef('sourceHighlights')

const syncHighlightScroll = (): void => {
  if (!sourceInput.value || !sourceHighlights.value) return

  sourceHighlights.value.scrollTop = sourceInput.value.scrollTop
  sourceHighlights.value.scrollLeft = sourceInput.value.scrollLeft
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

const restoreMenu = useTemplateRef('restoreMenu')

const activeSourceTab = computed(() => props.sourceTabs[props.activeSourceCodeTabIndex])
const liveSourceTabs = computed(() => props.sourceTabs.filter((tab) => tab.alive))
const deadSourceTabs = computed(() => props.sourceTabs.filter((tab) => !tab.alive))
const liveSourceTabCount = computed(() => liveSourceTabs.value.length)

const closeRestoreMenu = (): void => {
  if (!restoreMenu.value) return

  restoreMenu.value.open = false
}

const restoreSourceCodeTab = (id: number): void => {
  emit('selectSourceCodeTab', id)
  closeRestoreMenu()
}

const handleSourceTabClick = (event: MouseEvent, id: number): void => {
  if (event.ctrlKey || event.metaKey) {
    emit('toggleSourceCodeTabSolo', id, event.altKey)
    return
  }

  if (event.shiftKey) {
    emit('toggleSourceCodeTabMute', id)
    return
  }

  emit('selectSourceCodeTab', id)
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
    props.playbackPositionTime >= start &&
    props.playbackPositionTime < end
  )
}
</script>

<template>
  <main class="xenpaper-app">
    <div class="source-tabs" role="tablist" aria-label="Source codes">
      <div class="source-tab-list">
        <div v-for="tab in liveSourceTabs" :key="tab.id" class="source-tab">
          <button
            class="source-tab-button"
            :class="{ active: tab.active, muted: tab.muted, soloed: tab.soloed }"
            type="button"
            role="tab"
            :aria-selected="tab.active"
            :title="`${tab.title}${tab.soloed ? ' (solo)' : ''}${tab.muted ? ' (muted)' : ''}`"
            :aria-label="`${tab.title}${tab.soloed ? ', soloed' : ''}${tab.muted ? ', muted' : ''}`"
            :aria-controls="`source-code-panel-${tab.id}`"
            @click="handleSourceTabClick($event, tab.id)"
          >
            {{ tab.title }}
          </button>
          <button
            v-if="liveSourceTabCount > 1"
            class="source-tab-close"
            type="button"
            :aria-label="`Close ${tab.title}`"
            @click="emit('closeSourceCodeTab', tab.id)"
          >
            ×
          </button>
        </div>
        <button
          class="source-tab-add"
          type="button"
          aria-label="Add source code"
          @click="emit('addSourceCodeTab')"
        >
          +
        </button>
      </div>
      <details v-if="deadSourceTabs.length" ref="restoreMenu" class="source-tab-restore-menu">
        <summary class="source-tab-restore-summary">Recently closed</summary>
        <div class="source-tab-restore-list">
          <button
            v-for="tab in deadSourceTabs"
            :key="tab.id"
            class="source-tab-restore-button"
            type="button"
            :title="`Restore ${tab.title}`"
            @click="restoreSourceCodeTab(tab.id)"
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
    >
      <div v-if="activeSourceTab && liveSourceTabCount > 1" class="source-editor-tab-controls">
        <button
          class="source-editor-tab-control"
          :class="{ enabled: activeSourceTab.soloed }"
          type="button"
          :aria-label="`Solo ${activeSourceTab.title}`"
          :aria-pressed="activeSourceTab.soloed"
          :title="`${activeSourceTab.soloed ? 'Unsolo' : 'Solo'} ${activeSourceTab.title}`"
          @click="
            emit('toggleSourceCodeTabSolo', activeSourceTab.id, $event.ctrlKey || $event.metaKey)
          "
        >
          Solo
        </button>
        <button
          class="source-editor-tab-control"
          :class="{ enabled: activeSourceTab.muted }"
          type="button"
          :aria-label="`Mute ${activeSourceTab.title}`"
          :aria-pressed="activeSourceTab.muted"
          :title="`${activeSourceTab.muted ? 'Unmute' : 'Mute'} ${activeSourceTab.title}`"
          @click="emit('toggleSourceCodeTabMute', activeSourceTab.id)"
        >
          Mute
        </button>
      </div>
      <textarea
        id="source-code"
        ref="sourceInput"
        :value="sourceCode"
        class="source-input"
        placeholder="Type your tune here..."
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

<style scoped>
.source-tab-close,
.source-tab-add,
.source-tab-restore-summary,
.source-tab-restore-button {
  border: 0;
  cursor: pointer;
  background: var(--xenpaper-bg-light);
  color: var(--xenpaper-text);
  font-family: var(--xenpaper-font-mono);
  outline: none;
}

.source-tab-button.muted {
  color: var(--xenpaper-placeholder);
  text-decoration: line-through;
}

.source-tab-button.soloed {
  box-shadow: inset 0 -0.2rem 0 var(--xenpaper-solo);
}

.source-tab-button.active.muted {
  color: var(--xenpaper-bg-light);
}

.source-tab-close {
  width: 2rem;
  padding: 0 0.5rem;
  color: var(--xenpaper-placeholder);
}

.source-tab-add {
  flex: 0 0 auto;
  width: 2.5rem;
  color: var(--xenpaper-cyan);
}

.source-tab-restore-menu {
  position: relative;
  flex: 0 0 auto;
}

.source-tab-restore-summary {
  display: block;
  padding: 0.5rem 0.75rem;
  color: var(--xenpaper-placeholder);
  list-style: none;
}

.source-tab-restore-summary::-webkit-details-marker {
  display: none;
}

.source-tab-restore-list {
  position: absolute;
  z-index: 2;
  right: 0;
  display: flex;
  min-width: 12rem;
  flex-direction: column;
  background: var(--xenpaper-bg-light);
  box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 30%);
}

.source-tab-restore-button {
  padding: 0.5rem 0.75rem;
  text-align: left;
  white-space: nowrap;
}

.source-tab-close:hover,
.source-tab-close:focus-visible,
.source-tab-add:hover,
.source-tab-add:focus-visible,
.source-tab-restore-summary:hover,
.source-tab-restore-summary:focus-visible,
.source-tab-restore-button:hover,
.source-tab-restore-button:focus-visible {
  background: var(--xenpaper-focus);
  color: var(--xenpaper-text);
}

.source-editor-tab-controls {
  position: absolute;
  z-index: 2;
  top: 0.75rem;
  right: 1rem;
  display: flex;
  gap: 0.25rem;
}

.source-editor-tab-control {
  border: 0;
  cursor: pointer;
  background: var(--xenpaper-bg-light);
  color: var(--xenpaper-placeholder);
  font-family: var(--xenpaper-font-mono);
  font-size: 0.75rem;
  line-height: 1;
  outline: none;
  padding: 0.35rem 0.5rem;
}

.source-editor-tab-control.enabled {
  color: var(--xenpaper-bg);
  background: var(--xenpaper-solo);
}

.source-editor-tab-control[aria-label^='Mute'].enabled {
  background: var(--xenpaper-placeholder);
}

.source-editor-tab-control:hover,
.source-editor-tab-control:focus-visible {
  background: var(--xenpaper-focus);
  color: var(--xenpaper-text);
}

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

@media (max-width: 900px) {
  .source-tab-restore-menu {
    display: none;
  }
}
</style>
