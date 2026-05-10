<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import type { MoscNoteMs } from '../mosc'
import type { InitialRulerState } from '../grammars/process-grammar'
import type { SidebarMode } from '../types'
import { copyText } from '../utils'
import {
  parseXenpaperScoreFile,
  serializeXenpaperScoreFile,
  XENPAPER_FILE_EXTENSION,
  XENPAPER_FILE_MIME_TYPE,
  XENPAPER_FILE_NAME,
} from '../xenpaper-file'
import BlobDownloadLink from './BlobDownloadLink.vue'
import PitchRuler from './PitchRuler.vue'
import TutorialSidebar from './TutorialSidebar.vue'

const COPY_FEEDBACK_MS = 2000

const props = defineProps<{
  isEmbedMode: boolean
  sidebarMode: SidebarMode
  shareUrl: string
  embedCode: string
  embedUrl: string
  sourceCodes: string[]
  initialRulerState?: InitialRulerState
}>()

const emit = defineEmits<{
  closeSidebar: []
  setTune: [source: string]
  importSourceCodes: [sourceCodes: string[]]
  activeNoteHandlerChange: [handler?: (note: MoscNoteMs, on: boolean) => void]
}>()

const pitchRuler = ref<InstanceType<typeof PitchRuler>>()
const copiedShareLink = ref(false)
const copiedEmbedCode = ref(false)
const fileInput = ref<HTMLInputElement>()
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
