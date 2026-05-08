<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
  <nav class="app-navigation" aria-label="Application navigation">
    <RouterLink to="/">Home</RouterLink>
    <RouterLink to="/about">About</RouterLink>
  </nav>
</template>

<style scoped>
.app-navigation {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 10;
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--xenpaper-bg-light);
  background: rgb(14 21 27 / 85%);
  font-family: var(--xenpaper-font-mono);
}

.app-navigation a {
  color: var(--xenpaper-cyan);
  text-decoration: none;
}

.app-navigation a.router-link-active {
  color: var(--xenpaper-text);
}
</style>
