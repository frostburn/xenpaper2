<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    filename: string
    contents: BlobPart
    mimeType?: string
  }>(),
  {
    mimeType: 'application/octet-stream',
  },
)

const objectUrl = ref('')

const revokeObjectUrl = (): void => {
  if (!objectUrl.value) return

  URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ''
}

watch(
  () => [props.contents, props.mimeType],
  () => {
    revokeObjectUrl()
    objectUrl.value = URL.createObjectURL(new Blob([props.contents], { type: props.mimeType }))
  },
  { immediate: true },
)

onUnmounted(revokeObjectUrl)
</script>

<template>
  <a :href="objectUrl" :download="filename">
    <slot />
  </a>
</template>
