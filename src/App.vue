<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, type WatchStopHandle } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import TheFooter from './components/TheFooter.vue'
import XenpaperEmbedToolbar from './components/XenpaperEmbedToolbar.vue'
import XenpaperSidebar from './components/XenpaperSidebar.vue'
import XenpaperToolbar from './components/XenpaperToolbar.vue'
import { encodeShareHashForUrl } from './share-link'
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

const replaceBrowserAddressHash = (hash: string): void => {
  const encodedHash = encodeShareHashForUrl(hash)

  if (window.location.hash === encodedHash) return

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${encodedHash}`,
  )
}

const replaceShareRoute = async (): Promise<void> => {
  xenpaper.saveSourceCodeToBrowser()

  if (route.hash !== currentRouteHash.value) {
    await router.replace({
      query: route.query,
      hash: currentRouteHash.value,
    })
  }

  replaceBrowserAddressHash(currentRouteHash.value)
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

  stopRouteHashWatcher = watch(
    () => route.hash,
    (sharedHash) => {
      xenpaper.applySharedHash(sharedHash)
    },
  )

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
  xenpaper.initializeSourceCode(initialRouteHash())
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
        :render-song-to-wav-blob="xenpaper.renderSongToWavBlob"
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

<style scoped>
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
