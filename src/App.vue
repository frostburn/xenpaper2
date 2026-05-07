<script setup lang="ts">
import { ref } from 'vue'

import { parse } from './grammars/grammar.generated.js'
import type { XenpaperAST } from './grammars/grammar.generated'

const sourceCode = ref('')

const logParsedAst = (): void => {
  const ast: XenpaperAST = parse(sourceCode.value, { grammarSource: 'source-code' })
  console.log('Parsed XenpaperAST:', ast)
}
</script>

<template>
  <main class="xenpaper-app">
    <label class="source-label" for="source-code">Source code</label>
    <textarea
      id="source-code"
      v-model="sourceCode"
      class="source-input"
      placeholder="Enter Xenpaper source code..."
      spellcheck="false"
    />
    <button class="parse-button" type="button" @click="logParsedAst">Log parsed XenpaperAST</button>
  </main>
</template>

<style scoped>
.xenpaper-app {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(100%, 48rem);
  margin: 0 auto;
}

.source-label {
  font-weight: 600;
}

.source-input {
  min-height: 20rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  background: var(--color-background-soft);
  font: inherit;
  font-family: monospace;
  resize: vertical;
}

.parse-button {
  align-self: flex-start;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  background: var(--color-background-mute);
  cursor: pointer;
}

.parse-button:hover {
  border-color: hsla(160, 100%, 37%, 1);
}
</style>
