<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

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
  restartPlaybackFromStart: []
  restartPlaybackFromLine: [line: number]
  setSelectedLine: [line: number]
  selectSourceCodeTab: [index: number]
  toggleSourceCodeTabMute: [index: number]
  toggleSourceCodeTabSolo: [index: number, preserveOtherSolos?: boolean]
}>()

const sourceInput = useTemplateRef('sourceInput')
const sourceHighlights = useTemplateRef('sourceHighlights')

const activeSourceTab = computed(() => props.sourceTabs[props.activeSourceCodeTabIndex])
const liveSourceTabs = computed(() => props.sourceTabs.filter((tab) => tab.alive))
const liveSourceTabCount = computed(() => liveSourceTabs.value.length)

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
  }
}

const handleSourceTabClick = (event: MouseEvent, index: number): void => {
  if (event.ctrlKey || event.metaKey) {
    emit('toggleSourceCodeTabSolo', index, event.altKey)
    return
  }

  if (event.shiftKey) {
    emit('toggleSourceCodeTabMute', index)
    return
  }

  emit('selectSourceCodeTab', index)
}

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
            :class="{ active: tab.active, muted: tab.muted, soloed: tab.soloed }"
            type="button"
            role="tab"
            :aria-selected="tab.active"
            :title="`${tab.title}${tab.soloed ? ' (solo)' : ''}${tab.muted ? ' (muted)' : ''}`"
            :aria-label="`${tab.title}${tab.soloed ? ', soloed' : ''}${tab.muted ? ', muted' : ''}`"
            :aria-controls="`source-code-panel-${tab.id}`"
            @click="handleSourceTabClick($event, index)"
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
      <div v-if="activeSourceTab && liveSourceTabCount > 1" class="source-editor-tab-controls">
        <button
          class="source-editor-tab-control"
          :class="{ enabled: activeSourceTab.soloed }"
          type="button"
          :aria-label="`Solo ${activeSourceTab.title}`"
          :aria-pressed="activeSourceTab.soloed"
          :title="`${activeSourceTab.soloed ? 'Unsolo' : 'Solo'} ${activeSourceTab.title}`"
          @click="
            emit(
              'toggleSourceCodeTabSolo',
              activeSourceCodeTabIndex,
              $event.ctrlKey || $event.metaKey,
            )
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
          @click="emit('toggleSourceCodeTabMute', activeSourceCodeTabIndex)"
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
        readonly
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
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
