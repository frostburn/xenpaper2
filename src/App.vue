<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, type WatchStopHandle } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import TheFooter from './components/TheFooter.vue'
import XenpaperEmbedToolbar from './components/XenpaperEmbedToolbar.vue'
import XenpaperSidebar from './components/XenpaperSidebar.vue'
import XenpaperToolbar from './components/XenpaperToolbar.vue'
import { useXenpaperStore } from './stores/xenpaper'

const xenpaper = useXenpaperStore()
const route = useRoute()
const router = useRouter()

let playbackAnimationFrame: number | undefined
let stopTitleWatcher: WatchStopHandle | undefined
let stopSourceWatcher: WatchStopHandle | undefined
let stopShareRouteWatcher: WatchStopHandle | undefined
let stopLoopStartWatcher: WatchStopHandle | undefined
let stopRouteHashWatcher: WatchStopHandle | undefined
let stopPlaybackWatcher: WatchStopHandle | undefined

const decodeBrowserHash = (hash: string): string => {
  try {
    return decodeURIComponent(hash)
  } catch {
    return hash
  }
}

const initialRouteHash = (): string => {
  if (route.hash) return route.hash
  if (window.location.hash) return decodeBrowserHash(window.location.hash)

  return ''
}

const currentRouteHash = computed(() => xenpaper.routeHash)
const isEmbedMode = computed(() => route.meta.embedMode === true)

const replaceShareRoute = async (): Promise<void> => {
  xenpaper.saveSourceCodeToBrowser()

  if (route.hash === currentRouteHash.value) return

  await router.replace({
    query: route.query,
    hash: currentRouteHash.value,
  })
}

const syncDocumentTitle = (title: string): void => {
  document.title = title

  let openGraphTitle = document.head.querySelector<HTMLMetaElement>('meta[property="og:title"]')
  if (!openGraphTitle) {
    openGraphTitle = document.createElement('meta')
    openGraphTitle.setAttribute('property', 'og:title')
    document.head.append(openGraphTitle)
  }

  openGraphTitle.setAttribute('content', title)
}

const startPlaybackAnimation = (): void => {
  const tick = (): void => {
    xenpaper.syncPlaybackPosition()
    playbackAnimationFrame = window.requestAnimationFrame(tick)
  }

  if (playbackAnimationFrame === undefined) tick()
}

const stopPlaybackAnimation = (): void => {
  if (playbackAnimationFrame !== undefined) {
    window.cancelAnimationFrame(playbackAnimationFrame)
    playbackAnimationFrame = undefined
  }
  xenpaper.resetPlaybackPosition()
}

const startWatchers = (): void => {
  stopTitleWatcher = watch(() => xenpaper.htmlTitle, syncDocumentTitle, { immediate: true })

  stopSourceWatcher = watch(
    () => xenpaper.sourceCodes,
    () => {
      void xenpaper.updateParsedSourceCode()
    },
  )

  stopShareRouteWatcher = watch(
    () => xenpaper.routeHash,
    () => {
      void replaceShareRoute()
    },
  )

  stopLoopStartWatcher = watch([() => xenpaper.selectedLine, () => xenpaper.chars], () => {
    xenpaper.updateLoopStart()
  })

  stopRouteHashWatcher = watch([() => route.hash, isEmbedMode], ([sharedHash, embedMode]) => {
    xenpaper.applySharedHash(sharedHash, embedMode)
  })

  stopPlaybackWatcher = watch(
    () => xenpaper.isPlaying,
    (playing) => {
      if (playing) {
        startPlaybackAnimation()
        return
      }

      stopPlaybackAnimation()
    },
  )
}

const stopWatchers = (): void => {
  stopTitleWatcher?.()
  stopSourceWatcher?.()
  stopShareRouteWatcher?.()
  stopLoopStartWatcher?.()
  stopRouteHashWatcher?.()
  stopPlaybackWatcher?.()
  stopTitleWatcher = undefined
  stopSourceWatcher = undefined
  stopShareRouteWatcher = undefined
  stopLoopStartWatcher = undefined
  stopRouteHashWatcher = undefined
  stopPlaybackWatcher = undefined
}

onMounted(() => {
  xenpaper.initializeLocation(window.location.href)
  xenpaper.initializeSourceCode(initialRouteHash(), isEmbedMode.value)
  startWatchers()
  void replaceShareRoute()
  void xenpaper.updateParsedSourceCode()
})

onUnmounted(() => {
  stopWatchers()
  xenpaper.disposeSoundEngines()
  stopPlaybackAnimation()
})
</script>

<template>
  <div class="app-shell">
    <div class="app-layout" :class="{ 'app-layout-embed': isEmbedMode }">
      <XenpaperEmbedToolbar
        v-if="isEmbedMode"
        :edit-url="xenpaper.shareUrl"
        :is-playing="xenpaper.isPlaying"
        :is-looping="xenpaper.isLooping"
        @toggle-playback="xenpaper.togglePlayback"
        @toggle-loop="xenpaper.toggleLoop"
      />
      <XenpaperToolbar
        v-else
        :is-playing="xenpaper.isPlaying"
        :is-looping="xenpaper.isLooping"
        :can-undo-source-code="xenpaper.canUndoSourceCode"
        :can-redo-source-code="xenpaper.canRedoSourceCode"
        :sidebar-mode="xenpaper.sidebarMode"
        @toggle-playback="xenpaper.togglePlayback"
        @toggle-loop="xenpaper.toggleLoop"
        @undo-source-code="xenpaper.undoSourceCode"
        @redo-source-code="xenpaper.redoSourceCode"
        @show-sidebar="xenpaper.showSidebar"
      />
      <RouterView />
      <XenpaperSidebar
        v-if="!isEmbedMode"
        :sidebar-mode="xenpaper.sidebarMode"
        :share-url="xenpaper.shareUrl"
        :embed-code="xenpaper.embedCode"
        :embed-url="xenpaper.embedUrl"
        :source-codes="xenpaper.sourceCodes"
        :initial-ruler-state="xenpaper.initialRulerState"
        @close-sidebar="xenpaper.closeSidebar"
        @set-tune="xenpaper.setDemoTune"
        @import-source-codes="xenpaper.importSourceCodes"
        @active-note-handler-change="xenpaper.setActiveNoteHandler"
      />
    </div>
    <TheFooter v-if="!isEmbedMode" />
  </div>
</template>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--xenpaper-bg);
}

.app-layout {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--xenpaper-bg);
  color: var(--xenpaper-text);
}

.xenpaper-app {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
  padding: 1.5rem 0 0 1rem;
}

.source-tabs {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  min-width: 0;
  min-height: 2.5rem;
  padding: 0 1rem 0.25rem 2rem;
  overflow: visible;
}

.source-tab-list {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: stretch;
  gap: 0.25rem;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}

.source-tab {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  max-width: 18rem;
  background: var(--xenpaper-bg-light);
}

.source-tab-button {
  max-width: 14rem;
  border: 0;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  overflow: hidden;
  background: var(--xenpaper-bg-light);
  color: var(--xenpaper-text);
  font-family: var(--xenpaper-font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
  outline: none;
}

.source-tab-button.active {
  color: var(--xenpaper-bg);
  background: var(--xenpaper-cyan);
}

.source-tab-button:hover,
.source-tab-button:focus-visible {
  background: var(--xenpaper-focus);
  color: var(--xenpaper-text);
}

.source-label {
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

.source-editor {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  line-height: 1.4em;
  font-size: clamp(1.1rem, 1.65vw, 1.4rem);
  overflow: hidden;
}

.source-editor::before {
  content: '';
  display: block;
  width: 3px;
  height: 4rem;
  background-color: transparent;
  transition: background-color 0.2s ease-out;
  position: absolute;
  top: 12px;
  left: 0;
}

.source-editor:focus-within::before {
  background-color: var(--xenpaper-focus);
}

.source-input,
.source-highlights {
  box-sizing: border-box;
  min-height: 100%;
  max-width: 64rem;
  width: 100%;
  margin: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-family: var(--xenpaper-font-mono);
  line-height: inherit;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: keep-all;
  overflow-wrap: break-word;
  padding: 1rem 1rem 1rem 2rem;
  scrollbar-gutter: stable;
}

.source-input {
  position: absolute;
  inset: 0;
  z-index: 1;
  height: 100%;
  resize: none;
  outline: 0;
  caret-color: var(--xenpaper-text);
  color: inherit;
  overflow: auto;
  -webkit-text-fill-color: transparent;
}

.source-input::selection {
  background: var(--xenpaper-cyan);
}

.source-highlights {
  position: absolute;
  inset: 0;
  z-index: 2;
  height: 100%;
  pointer-events: none;
  user-select: none;
  overflow: hidden;
}

.placeholder-text {
  color: var(--xenpaper-placeholder);
  font-style: italic;
}

.source-character {
  transition: color 0.2s ease-out;
}

.source-character.active {
  color: #ffffff;
  transition: color 0s linear;
}

.highlight-delimiter {
  color: var(--xenpaper-placeholder);
}

.highlight-pitch,
.highlight-chord {
  color: var(--xenpaper-cyan);
}

.highlight-scaleGroup {
  color: #94472f;
}

.highlight-scale {
  color: #ff541e;
}

.highlight-setterGroup {
  color: #821361;
}

.highlight-setter {
  color: #d61ba4;
}

.highlight-comment {
  color: #ffffff;
}

.highlight-commentStart {
  color: var(--xenpaper-placeholder);
}

.highlight-error,
.highlight-errorMessage {
  color: #cc0000;
}

.highlight-unknown {
  color: #a490b3;
}

.playback-error {
  flex: 0 0 auto;
  margin: 0.75rem 1rem 1rem 2rem;
  padding: 0.75rem 1rem;
  border-left: 3px solid #cc0000;
  background: var(--xenpaper-bg-light);
  color: #ff541e;
  font-family: var(--xenpaper-font-mono);
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .source-editor,
  .source-input,
  .source-highlights {
    min-height: 50vh;
  }
}

.actions {
  flex: 0 0 5rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  max-height: 100%;
  gap: 0;
  padding-top: 2rem;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--xenpaper-bg);
  z-index: 4;
}

.actions > * {
  flex: 0 0 auto;
}

.action-button {
  border: 0;
  border-left: 3px solid transparent;
  display: block;
  width: 5rem;
  padding: 0.5rem;
  cursor: pointer;
  background: var(--xenpaper-bg);
  color: #ffffff;
  outline: none;
  font-family: var(--xenpaper-font-mono);
  font-size: 1.1rem;
  text-align: center;
  text-transform: uppercase;
  text-decoration: none;
}

.action-button:hover,
.action-button:focus,
.action-button:active {
  background: var(--xenpaper-bg-light);
}

.action-button:focus-visible {
  border-left-color: var(--xenpaper-focus);
}

.action-button:disabled {
  cursor: not-allowed;
  color: var(--xenpaper-placeholder);
  opacity: 0.45;
}

.action-button:disabled:hover,
.action-button:disabled:focus,
.action-button:disabled:active {
  background: var(--xenpaper-bg);
}

.action-button.active {
  color: var(--xenpaper-bg);
  background: var(--xenpaper-placeholder);
}

@media (max-width: 900px) {
  .app-shell {
    min-height: 100vh;
    height: auto;
    overflow: visible;
  }

  .app-layout:not(.app-layout-embed) {
    display: block;
    min-height: 0;
    overflow: visible;
  }
}
</style>
