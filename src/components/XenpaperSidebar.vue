<script setup lang="ts">
import PitchRuler from './PitchRuler.vue'
import TutorialSidebar from './TutorialSidebar.vue'
import { useXenpaperStore } from '../stores/xenpaper'

const xenpaper = useXenpaperStore()
</script>

<template>
  <aside
    v-if="!xenpaper.isEmbedMode && xenpaper.sidebarMode !== 'none'"
    class="sidebar-stack"
    :class="`sidebar-stack-${xenpaper.sidebarMode}`"
  >
    <button
      class="sidebar-close"
      type="button"
      aria-label="Close sidebar"
      @click="xenpaper.closeSidebar"
    >
      ×
    </button>
    <TutorialSidebar v-if="xenpaper.sidebarMode === 'info'" @set-tune="xenpaper.setDemoTune" />

    <section v-else-if="xenpaper.sidebarMode === 'share'" class="sidebar-panel share-panel">
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
            :value="xenpaper.shareUrl"
            type="text"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
        </label>
        <button class="panel-button" type="button" @click="xenpaper.copyShareLink">
          {{ xenpaper.copiedShareLink ? 'Copied' : 'Copy link' }}
        </button>

        <h2 class="embed-heading">Embed</h2>
        <p>Copy this HTML to embed the current tune in another page.</p>
        <label class="share-field">
          <span>Embed code</span>
          <input
            class="share-link-input"
            :value="xenpaper.embedCode"
            type="text"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
        </label>
        <button class="panel-button" type="button" @click="xenpaper.copyEmbedCode">
          {{ xenpaper.copiedEmbedCode ? 'Copied' : 'Copy embed code' }}
        </button>
        <iframe
          class="embed-preview"
          :src="xenpaper.embedUrl"
          title="Xenpaper 2 embed preview"
        ></iframe>
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
      <PitchRuler :ref="xenpaper.setPitchRuler" :initial-state="xenpaper.initialRulerState" />
    </section>
  </aside>
</template>
