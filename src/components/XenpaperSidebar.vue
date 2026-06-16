<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'

import type { MoscNote } from '../mosc'
import type { InitialRulerState } from '../grammars/process-grammar'
import type { DemoTune, SidebarMode } from '../types'
import { copyText } from '../utils'
import {
  parseXenpaperScoreFile,
  serializeXenpaperScoreFile,
  XENPAPER_FILE_EXTENSION,
  XENPAPER_FILE_MIME_TYPE,
  XENPAPER_FILE_NAME,
} from '../xenpaper-file'
import BlobDownloadLink from './BlobDownloadLink.vue'
import NewInV2Sidebar from './NewInV2Sidebar.vue'
import NotationSidebar from './NotationSidebar.vue'
import PitchRuler from './PitchRuler.vue'
import TutorialSidebar from './TutorialSidebar.vue'

const COPY_FEEDBACK_MS = 2000

const props = defineProps<{
  sidebarMode: SidebarMode
  shareUrl: string
  embedCode: string
  embedUrl: string
  sourceCodes: string[]
  initialRulerState?: InitialRulerState
}>()

const emit = defineEmits<{
  closeSidebar: []
  setTune: [source: DemoTune]
  importSourceCodes: [sourceCodes: string[]]
  activeNoteHandlerChange: [handler?: (note: MoscNote, on: boolean) => void]
}>()

const pitchRuler = useTemplateRef('pitchRuler')
const copiedShareLink = ref(false)
const copiedEmbedCode = ref(false)
const fileInput = useTemplateRef('fileInput')
const importError = ref('')
const serializedSourceFile = computed(() => serializeXenpaperScoreFile(props.sourceCodes))
let shareLinkResetTimeout: number | undefined
let embedCodeResetTimeout: number | undefined

const resetCopiedShareLink = (): void => {
  if (shareLinkResetTimeout !== undefined) {
    window.clearTimeout(shareLinkResetTimeout)
    shareLinkResetTimeout = undefined
  }

  copiedShareLink.value = false
}

const resetCopiedEmbedCode = (): void => {
  if (embedCodeResetTimeout !== undefined) {
    window.clearTimeout(embedCodeResetTimeout)
    embedCodeResetTimeout = undefined
  }

  copiedEmbedCode.value = false
}

const setCopiedShareLink = (copied: boolean): void => {
  resetCopiedShareLink()
  copiedShareLink.value = copied

  if (copied) {
    shareLinkResetTimeout = window.setTimeout(resetCopiedShareLink, COPY_FEEDBACK_MS)
  }
}

const setCopiedEmbedCode = (copied: boolean): void => {
  resetCopiedEmbedCode()
  copiedEmbedCode.value = copied

  if (copied) {
    embedCodeResetTimeout = window.setTimeout(resetCopiedEmbedCode, COPY_FEEDBACK_MS)
  }
}

const copyShareLink = async (): Promise<void> => {
  setCopiedShareLink(await copyText(props.shareUrl))
}

const copyEmbedCode = async (): Promise<void> => {
  setCopiedEmbedCode(await copyText(props.embedCode))
}

const selectSourceFile = (): void => {
  importError.value = ''
  fileInput.value?.click()
}

const importSourceFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    emit('importSourceCodes', parseXenpaperScoreFile(await file.text()))
    importError.value = ''
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Failed to import Xenpaper scores.'
  } finally {
    input.value = ''
  }
}

watch(() => props.shareUrl, resetCopiedShareLink)
watch(() => props.embedCode, resetCopiedEmbedCode)

onMounted(() => {
  emit('activeNoteHandlerChange', (note, on) => {
    pitchRuler.value?.setActiveNote(note, on)
  })
})

onUnmounted(() => {
  resetCopiedShareLink()
  resetCopiedEmbedCode()
  emit('activeNoteHandlerChange')
})
</script>

<template>
  <aside
    v-if="sidebarMode !== 'none'"
    class="sidebar-stack"
    :class="{ 'sidebar-stack-ruler': sidebarMode === 'ruler' }"
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
    <NewInV2Sidebar v-else-if="sidebarMode === 'new-v2'" @set-tune="emit('setTune', $event)" />
    <NotationSidebar v-else-if="sidebarMode === 'notation'" @set-tune="emit('setTune', $event)" />

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
        <button class="panel-button" type="button" @click="copyShareLink">
          {{ copiedShareLink ? 'Copied' : 'Copy link' }}
        </button>

        <h2 class="file-heading">Import / export</h2>
        <p>
          Export or import all open source tabs as a versioned
          <code>{{ XENPAPER_FILE_EXTENSION }}</code> file.
        </p>
        <div class="file-actions">
          <BlobDownloadLink
            class="panel-button"
            :filename="XENPAPER_FILE_NAME"
            :contents="serializedSourceFile"
            :mime-type="XENPAPER_FILE_MIME_TYPE"
          >
            Export scores
          </BlobDownloadLink>
          <button class="panel-button" type="button" @click="selectSourceFile">
            Import scores
          </button>
        </div>
        <input
          ref="fileInput"
          class="file-input"
          type="file"
          :accept="`${XENPAPER_FILE_EXTENSION},application/json,${XENPAPER_FILE_MIME_TYPE}`"
          @change="importSourceFile"
        />
        <p v-if="importError" class="file-error" role="alert">{{ importError }}</p>

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
        <button class="panel-button" type="button" @click="copyEmbedCode">
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

<style scoped>
.sidebar-stack {
  position: relative;
  flex: 0 0 40%;
  min-width: min(30rem, calc(100vw - 5rem));
  height: 100%;
  overflow: hidden;
  background: var(--xenpaper-bg-light);
  font-family: var(--xenpaper-font-copy);
}

.sidebar-stack-ruler {
  flex-basis: 55%;
}

.sidebar-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  border: 0;
  width: 3rem;
  height: 3rem;
  padding: 0;
  cursor: pointer;
  background: transparent;
  color: #ffffff;
  font-family: var(--xenpaper-font-mono);
  font-size: 2rem;
  line-height: 1;
  opacity: 0.9;
}

.sidebar-close:hover,
.sidebar-close:focus-visible {
  background: var(--xenpaper-bg-light);
  opacity: 1;
}

.sidebar-close:focus-visible {
  outline: 2px solid var(--xenpaper-focus);
  outline-offset: 2px;
}

.sidebar {
  height: 100%;
  max-height: 100%;
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--xenpaper-bg-light);
  animation: 0.3s ease-out sidebar-show;
}

@keyframes sidebar-show {
  from {
    opacity: 0;
    transform: translateY(0.25rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sidebar-heading {
  flex: 0 0 auto;
  padding: 2rem 2rem 1.5rem;
  background: var(--xenpaper-bg);
}

.sidebar-heading h1 {
  margin: 0 0 0.5rem;
  font-size: 2.5rem;
  line-height: 2rem;
  font-weight: 400;
  text-transform: lowercase;
}

.sidebar-heading p {
  margin: 0;
  color: var(--xenpaper-placeholder);
  font-style: italic;
  line-height: 1.3rem;
}

.sidebar-content {
  padding: 2rem;
}

.sidebar-content h2 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  font-weight: 400;
}

.sidebar-content .embed-heading,
.sidebar-content .file-heading {
  margin-top: 2.5rem;
}

.sidebar-content p {
  margin: 0 0 1.5rem;
}

.share-field {
  display: block;
  margin-bottom: 1rem;
  font-family: var(--xenpaper-font-mono);
}

.share-field span {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--xenpaper-placeholder);
  font-style: italic;
}

.share-link-input {
  width: 100%;
  min-width: 0;
  border: 1px solid #a490b3;
  color: #ffffff;
  background: var(--xenpaper-bg);
  padding: 0.5rem;
  font: inherit;
}

.share-link-input:focus-visible {
  outline: 0;
  border-color: var(--xenpaper-cyan);
}

.panel-button {
  border: 0;
  display: inline-block;
  padding: 0.5rem;
  cursor: pointer;
  background: #ff541e;
  color: var(--xenpaper-bg);
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s ease-out;
}

.panel-button:hover,
.panel-button:focus,
.panel-button:active {
  opacity: 1;
}

.file-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.file-error {
  color: #ff541e;
  overflow-wrap: anywhere;
}

.embed-preview {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 20rem;
  margin-top: 1.5rem;
  border: 1px solid #a490b3;
  background: var(--xenpaper-bg);
}

.ruler-panel {
  overflow: hidden;
}

.ruler-heading {
  flex: 0 0 auto;
  padding: 2rem 2rem 1rem;
  background: var(--xenpaper-bg-light);
}

.ruler-heading h2 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  font-weight: 400;
}

.ruler-heading p {
  margin: 0;
  color: var(--xenpaper-placeholder);
  font-style: italic;
  line-height: 1.3rem;
}

@media (max-width: 900px) {
  .sidebar-stack {
    min-width: 0;
    width: 100%;
    height: auto;
  }

  .sidebar-stack-ruler {
    flex-basis: auto;
  }

  .sidebar,
  .sidebar-panel {
    height: auto;
    max-height: none;
    overflow-x: hidden;
  }

  .ruler-panel {
    min-height: max(32rem, calc(100dvh - 3rem));
  }

  .sidebar-content {
    overflow-wrap: anywhere;
  }
}
</style>
