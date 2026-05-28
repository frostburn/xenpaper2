<script setup lang="ts">
import { useTemplateRef } from 'vue'

import type { CharData } from '../grammars/grammar-to-chars'
import type { SourceDisplayToken } from '../types'

const props = withDefaults(
  defineProps<{
    sourceCode: string
    sourceDisplayTokens: SourceDisplayToken[]
    chars: CharData[]
    isPlaying: boolean
    playbackPositionTime: number
    readonly?: boolean
  }>(),
  {
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:sourceCode': [source: string]
  sourceKeydown: [event: KeyboardEvent]
}>()

defineSlots<{
  playStart?: (props: { line: number }) => unknown
}>()

const sourceInput = useTemplateRef('sourceInput')
const sourceHighlights = useTemplateRef('sourceHighlights')

const handleSourceInput = (event: Event): void => {
  if (props.readonly) return

  emit('update:sourceCode', (event.target as HTMLTextAreaElement).value)
}

const syncHighlightScroll = (): void => {
  if (!sourceInput.value || !sourceHighlights.value) return

  sourceHighlights.value.scrollTop = sourceInput.value.scrollTop
  sourceHighlights.value.scrollLeft = sourceInput.value.scrollLeft
}

const isCharacterActive = (charData?: CharData): boolean => {
  const [start, end] = charData?.playTime ?? []

  return (
    props.isPlaying &&
    start !== undefined &&
    end !== undefined &&
    props.playbackPositionTime >= start &&
    props.playbackPositionTime < end
  )
}
</script>

<template>
  <textarea
    id="source-code"
    ref="sourceInput"
    :value="sourceCode"
    class="source-input"
    placeholder="Type your tune here..."
    :readonly="readonly"
    autocapitalize="off"
    autocomplete="off"
    autocorrect="off"
    spellcheck="false"
    @input="handleSourceInput"
    @keydown="emit('sourceKeydown', $event)"
    @scroll="syncHighlightScroll"
  />
  <pre ref="sourceHighlights" class="source-highlights"><span
    v-if="sourceCode === ''"
    class="placeholder-text"
    aria-hidden="true"
  >Type your tune here...</span><template v-else><template v-for="token in sourceDisplayTokens" :key="token.key"><slot
    v-if="token.type === 'playStart'"
    name="playStart"
    :line="token.line"
  ></slot><span
    v-else
    class="source-character"
    aria-hidden="true"
    :class="[
      chars[token.index]?.color ? `highlight-${chars[token.index]?.color}` : 'highlight-unknown',
      { active: isCharacterActive(chars[token.index]) },
    ]"
  >{{ token.character }}</span></template></template><br><br></pre>
</template>
