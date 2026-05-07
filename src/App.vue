<script setup lang="ts">
import { ref } from 'vue'

import { parse } from './grammars/grammar.generated.js'
import { processGrammar } from './grammars/process-grammar'
import { scoreToMs } from './mosc'
import { SoundEngineTonejs } from './sound-engine-tonejs'
import type { XenpaperAST } from './grammars/grammar.generated'

const soundEngine = new SoundEngineTonejs()
const sourceCode = ref('')

const parseSourceCode = (): XenpaperAST => parse(sourceCode.value, { grammarSource: 'source-code' })

const logParsedAst = (): void => {
  console.log('Parsed XenpaperAST:', parseSourceCode())
}

const playParsedScore = async (): Promise<void> => {
  const { score } = processGrammar(parseSourceCode())

  if (!score) {
    return
  }

  await soundEngine.setScore(scoreToMs(score))
  await soundEngine.gotoMs(0)
  await soundEngine.play()
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
    <div class="actions">
      <button class="action-button" type="button" @click="logParsedAst">
        Log parsed XenpaperAST
      </button>
      <button class="action-button" type="button" @click="playParsedScore">Play with Tone.js</button>
    </div>
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

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.action-button {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  background: var(--color-background-mute);
  cursor: pointer;
}

.action-button:hover {
  border-color: hsla(160, 100%, 37%, 1);
}
</style>
