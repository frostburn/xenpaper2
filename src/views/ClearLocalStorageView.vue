<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
onMounted(() => {
  window.localStorage.clear()
  setTimeout(() => router.push('/'), 1000)
})
</script>
<template>
  <p>Clearing local storage…</p>
</template>
