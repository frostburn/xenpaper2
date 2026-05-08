<script setup lang="ts">
import {version} from '../../package.json'
</script>
<template>
<footer>
Xenpaper {{version}} is made by Lumi Pakkanen.
Built with Vue 3, Vite, TypeScript, Peggy and Tone.js.
Originally created by Damien Clarke.
</footer>
</template>
<style scoped>
footer {
  font-family: var(--xenpaper-font-copy);
  font-size: 0.9rem;
  line-height: 1.3rem;
  background: var(--xenpaper-bg);
  color: var(--xenpaper-placeholder);
}
</style>