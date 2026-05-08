<script setup lang="ts">
import { useXenpaperStore } from '../stores/xenpaper'

const xenpaper = useXenpaperStore()
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
        @input="xenpaper.handleSourceInput"
        @keydown="xenpaper.handleSourceKeydown"
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
