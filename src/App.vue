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

.source-tab-button,
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

.source-tab-button {
  max-width: 14rem;
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-tab-button.active {
  color: var(--xenpaper-bg);
  background: var(--xenpaper-cyan);
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

.source-tab-button:hover,
.source-tab-button:focus-visible,
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

.source-input,
.source-highlights {
  box-sizing: border-box;
  min-height: 100%;
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
  padding: 1rem 8rem 1rem 2rem;
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

.actions {
  flex: 0 0 5rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding-top: 2rem;
  background: var(--xenpaper-bg);
  z-index: 4;
}

.actions-embed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  flex: 0 0 auto;
  flex-direction: row;
  width: 100%;
  padding-top: 0;
}

.actions-embed .action-button {
  width: auto;
  height: 3rem;
  padding: 1rem 0.5rem;
  font-size: 0.9rem;
  line-height: 1rem;
}

.actions-embed .edit-link {
  margin-left: auto;
}

.actions-embed .play-pause-button {
  width: 3rem;
  height: 3rem;
  padding: 1rem 0.5rem;
}

.xenpaper-app-embed {
  padding-top: 3rem;
}

.source-editor-embed .source-input {
  cursor: default;
}

.toolbar-rule {
  margin: 0.75rem 0.5rem;
  border-top: 1px solid var(--xenpaper-bg-light);
}

.route-navigation {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--xenpaper-bg-light);
}

.route-link.router-link-active {
  color: var(--xenpaper-bg);
  background: var(--xenpaper-cyan);
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

.tutorial-sidebar {
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
  .actions:not(.actions-embed) {
    position: sticky;
    top: 0;
    z-index: 5;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
    width: 100%;
    padding-top: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .actions:not(.actions-embed) .action-button,
  .actions:not(.actions-embed) .toolbar-rule,
  .actions:not(.actions-embed) .route-navigation {
    flex: 0 0 auto;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4.25rem;
    min-width: 4.25rem;
    height: 3rem;
    padding: 0.5rem;
    font-size: 0.95rem;
    line-height: 1.1;
    white-space: nowrap;
    text-align: center;
  }

  .toolbar-rule {
    margin: 0.5rem 0.25rem;
    border-top: 0;
    border-left: 1px solid var(--xenpaper-bg-light);
  }

  .route-navigation {
    display: flex;
    flex-direction: row;
    margin-top: 0;
    margin-left: 0;
    padding-top: 0;
    border-top: 0;
    border-left: 1px solid var(--xenpaper-bg-light);
  }

  .source-tab-restore-menu {
    display: none;
  }
}

@media (max-width: 640px) {
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

  .toolbar-rule {
    margin: 0.5rem 0.25rem;
    border-top: 0;
    border-left: 1px solid var(--xenpaper-bg-light);
  }

  .source-editor,
  .source-input,
  .source-highlights {
    min-height: 50vh;
  }

  .sidebar-stack {
    min-width: 0;
    width: 100%;
    height: auto;
  }

  .sidebar-stack-ruler {
    flex-basis: auto;
  }

  .tutorial-sidebar,
  .sidebar-panel {
    height: auto;
    max-height: none;
    overflow-x: hidden;
  }

  .sidebar-content {
    overflow-wrap: anywhere;
  }
}

@media (max-width: 900px) and (orientation: landscape) {
  .app-shell {
    height: 100vh;
    min-height: 0;
    overflow: hidden;
  }

  .app-shell > footer {
    display: none;
  }

  .app-layout:not(.app-layout-embed) {
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  .actions:not(.actions-embed) {
    position: static;
    z-index: 4;
    flex: 0 0 4rem;
    flex-direction: column;
    flex-wrap: nowrap;
    width: 4rem;
    height: 100%;
    min-height: 0;
    padding-top: 0.5rem;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .actions:not(.actions-embed) .action-button {
    width: 4rem;
    min-width: 0;
    height: auto;
    min-height: 2.25rem;
    padding: 0.35rem 0.25rem;
    font-size: 0.75rem;
    line-height: 1;
    white-space: normal;
  }

  .actions:not(.actions-embed) .toolbar-rule {
    margin: 0.5rem 0.35rem;
    border-top: 1px solid var(--xenpaper-bg-light);
    border-left: 0;
  }

  .actions:not(.actions-embed) .route-navigation {
    flex-direction: column;
    margin-top: 0.75rem;
    margin-left: 0;
    padding-top: 0.5rem;
    border-top: 1px solid var(--xenpaper-bg-light);
    border-left: 0;
  }

  .sidebar-stack {
    flex-basis: 32%;
    min-width: min(18rem, 42vw);
  }

  .sidebar-heading {
    padding: 1.25rem 1.25rem 1rem;
  }

  .sidebar-heading h1 {
    font-size: 1.75rem;
    line-height: 1.5rem;
  }

  .sidebar-content {
    padding: 1.25rem;
    font-size: 0.95rem;
  }

  .sidebar-content h2,
  .ruler-heading h2 {
    font-size: 1.2rem;
  }

  .source-editor {
    font-size: clamp(0.85rem, 1.5vw, 0.95rem);
  }

  .source-input,
  .source-highlights {
    white-space: pre;
    overflow-x: auto;
    overflow-y: auto;
    overflow-wrap: normal;
    word-break: normal;
    padding-right: 3rem;
  }

  .sidebar-panel,
  .sidebar-content {
    overflow-x: hidden;
  }

  .sidebar-content {
    overflow-wrap: anywhere;
  }
}
</style>
