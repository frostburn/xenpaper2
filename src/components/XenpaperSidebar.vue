<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import type { MoscNoteMs } from '../mosc'
import type { InitialRulerState } from '../grammars/process-grammar'
import PitchRuler from './PitchRuler.vue'
import TutorialSidebar from './TutorialSidebar.vue'

type SidebarMode = 'info' | 'share' | 'ruler' | 'none'

defineProps<{
  isEmbedMode: boolean
  sidebarMode: SidebarMode
  shareUrl: string
  embedCode: string
  embedUrl: string
  copiedShareLink: boolean
  copiedEmbedCode: boolean
  initialRulerState?: InitialRulerState
}>()

const emit = defineEmits<{
  closeSidebar: []
  setTune: [source: string]
  copyShareLink: []
  copyEmbedCode: []
  activeNoteHandlerChange: [handler?: (note: MoscNoteMs, on: boolean) => void]
}>()

const pitchRuler = ref<InstanceType<typeof PitchRuler>>()

onMounted(() => {
  emit('activeNoteHandlerChange', (note, on) => {
    pitchRuler.value?.setActiveNote(note, on)
  })
})

onUnmounted(() => {
  emit('activeNoteHandlerChange')
})
</script>

<template>
  <aside
    v-if="!isEmbedMode && sidebarMode !== 'none'"
    class="sidebar-stack"
    :class="`sidebar-stack-${sidebarMode}`"
  >
    <button
      class="sidebar-close"
      type="button"
      aria-label="Close sidebar"
      @click="emit('closeSidebar')"
    >
      ×
    </button>
    <TutorialSidebar v-if="sidebarMode === 'info'" @set-tune="emit('setTune', $event)" />

    <section v-else-if="sidebarMode === 'share'" class="sidebar-panel share-panel">
      <header class="sidebar-heading">
        <h1>xenpaper 2</h1>
        <p>Text-based microtonal sequencer.</p>
        <p>Write down musical ideas and share the link around.</p>
      </header>

      <div class="sidebar-content">
        <h2>Share</h2>
        <p>Copy this URL to share the current tune.</p>
        <label class="share-field">
          <span>Share link</span>
          <input
            class="share-link-input"
            :value="shareUrl"
            type="text"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
        </label>
        <button class="panel-button" type="button" @click="emit('copyShareLink')">
          {{ copiedShareLink ? 'Copied' : 'Copy link' }}
        </button>

        <h2 class="embed-heading">Embed</h2>
        <p>Copy this HTML to embed the current tune in another page.</p>
        <label class="share-field">
          <span>Embed code</span>
          <input
            class="share-link-input"
            :value="embedCode"
            type="text"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
        </label>
        <button class="panel-button" type="button" @click="emit('copyEmbedCode')">
          {{ copiedEmbedCode ? 'Copied' : 'Copy embed code' }}
        </button>
        <iframe class="embed-preview" :src="embedUrl" title="Xenpaper 2 embed preview"></iframe>
      </div>
    </section>

    <section v-else class="sidebar-panel ruler-panel" aria-labelledby="pitch-ruler-title">
      <header class="sidebar-heading">
        <h1>xenpaper 2</h1>
        <p>Text-based microtonal sequencer.</p>
      </header>

      <div class="ruler-heading">
        <h2 id="pitch-ruler-title">Pitch ruler</h2>
        <p>Click and drag to pan, use mousewheel to zoom.</p>
      </div>
      <PitchRuler ref="pitchRuler" :initial-state="initialRulerState" />
    </section>
  </aside>
</template>
