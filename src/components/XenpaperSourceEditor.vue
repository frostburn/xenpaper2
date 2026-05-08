<script setup lang="ts">
import { getSourceLineAtOffset, useXenpaperStore } from '../stores/xenpaper'

const xenpaper = useXenpaperStore()

const handleSourceInput = (event: Event): void => {
  xenpaper.setSourceCode((event.target as HTMLTextAreaElement).value)
}

const handleSourceKeydown = (event: KeyboardEvent): void => {
  if (!(event.ctrlKey || event.metaKey)) return

  if (event.key === 'Enter') {
    event.preventDefault()
    void xenpaper.restartPlaybackFromStart()
    return
  }

  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault()
    const target = event.target
    const line =
      target instanceof HTMLTextAreaElement
        ? getSourceLineAtOffset(xenpaper.sourceCode, target.selectionStart)
        : xenpaper.selectedLine
    void xenpaper.restartPlaybackFromLine(line)
    return
  }

  const key = event.key.toLowerCase()

  if (key === 'z' && event.shiftKey) {
    event.preventDefault()
    xenpaper.redoSourceCode()
    return
  }

  if (key === 'z') {
    event.preventDefault()
    xenpaper.undoSourceCode()
    return
  }

  if (key === 'y') {
    event.preventDefault()
    xenpaper.redoSourceCode()
  }
}
</script>

<template>
  <main class="xenpaper-app" :class="{ 'xenpaper-app-embed': xenpaper.isEmbedMode }">
    <label class="source-label" for="source-code">Source code</label>
    <div class="source-editor" :class="{ 'source-editor-embed': xenpaper.isEmbedMode }">
      <textarea
        id="source-code"
        :value="xenpaper.sourceCode"
        class="source-input"
        placeholder="Type your tune here..."
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        :readonly="xenpaper.isEmbedMode"
        @input="handleSourceInput"
        @keydown="handleSourceKeydown"
      />
      <pre class="source-highlights"><span
        v-if="xenpaper.sourceCode === ''"
        class="placeholder-text"
        aria-hidden="true"
      >Type your tune here...</span><template v-else><template v-for="token in xenpaper.sourceDisplayTokens" :key="token.key"><button
        v-if="token.type === 'playStart'"
        class="play-start-marker"
        :class="{ selected: xenpaper.selectedLine === token.line }"
        type="button"
        :aria-label="`Start playback at line ${token.line + 1}`"
        :aria-pressed="xenpaper.selectedLine === token.line"
        @click="xenpaper.setSelectedLine(token.line)"
      >&gt;</button><span
        v-else
        class="source-character"
        aria-hidden="true"
        :class="[
          xenpaper.chars[token.index]?.color
            ? `highlight-${xenpaper.chars[token.index]?.color}`
            : 'highlight-unknown',
          { active: xenpaper.isCharacterActive(xenpaper.chars[token.index]) },
        ]"
      >{{ token.character }}</span></template></template><br><br></pre>
    </div>
    <p v-if="xenpaper.lastError" class="playback-error" role="alert">
      Error: {{ xenpaper.lastError }}
    </p>
  </main>
</template>
