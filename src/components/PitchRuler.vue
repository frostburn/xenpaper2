<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { centsToRatio, ratioToCents, type MoscNoteMs } from '../mosc'
import type { InitialRulerState } from '../grammars/process-grammar'

export type RulerColourMode = 'gradient' | 'proxnotes' | `proxplot${number}`

export type RulerState = {
  notes: Map<string, MoscNoteMs>
  notesActive: Map<string, MoscNoteMs>
  collect: boolean
  viewPan: number
  viewZoom: number
  colourMode: RulerColourMode
  colourModeThreshold: number
  colourModeSoft: boolean
  rootHz?: number
  octaveSize?: number
  plots: MoscNoteMs[][]
}

const LOW_HZ_LIMIT = 20
const ZOOM_SPEED = 1.1
const MIN_ZOOM = 0.05
const MAX_ZOOM = 12
const LABEL_GUTTER_WIDTH = 60
const ROOT_GRID_POSITIONS = [7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3]
const CENT_GRID_POSITIONS = [1, 0, -1]

const props = defineProps<{
  initialState?: InitialRulerState
}>()

const rulerElement = ref<HTMLElement>()
const rulerWidth = ref(0)
const rulerHeight = ref(0)
const dragging = ref(false)
const dragStartState = ref<{
  startPan: number
  startZoom: number
  startDrag: number
}>()

const hzToPan = (hz: number): number => Math.log2(hz / LOW_HZ_LIMIT)
const panToHz = (pan: number): number => Math.pow(2, pan) * LOW_HZ_LIMIT
const panToCents = (pan: number): number => pan * 1200

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

const wrapHue = (hue: number): number => ((hue % 360) + 360) % 360

const hsl = (hue: number, saturation: number, lightness: number): string => {
  return `hsl(${wrapHue(Math.round(hue))} ${saturation}% ${clamp(lightness, 0, 100)}%)`
}

const panToPx = (pan: number, viewPan: number, viewZoom: number, height: number): number => {
  return height * 0.5 - ((pan - viewPan) * height) / viewZoom
}

const pxToPan = (px: number, viewPan: number, viewZoom: number, height: number): number => {
  return viewPan - ((px - height * 0.5) / height) * viewZoom
}

const hzInRange = (hz: number, [lowHz, highHz]: [number, number]): boolean => {
  return hz >= lowHz && hz <= highHz
}

const getInitialView = (
  initialState?: InitialRulerState,
): { viewPan: number; viewZoom: number } => {
  if (initialState?.lowHz && initialState.highHz) {
    const lowPan = hzToPan(initialState.lowHz)
    const highPan = hzToPan(initialState.highHz)
    return {
      viewPan: (lowPan + highPan) * 0.5,
      viewZoom: Math.max(highPan - lowPan, MIN_ZOOM),
    }
  }

  return {
    viewPan: hzToPan(220 * 1.5),
    viewZoom: 1.5,
  }
}

const createRulerState = (initialState?: InitialRulerState): RulerState => {
  const { viewPan, viewZoom } = getInitialView(initialState)
  return {
    notes: new Map(),
    notesActive: new Map(),
    collect: true,
    viewPan,
    viewZoom,
    colourMode: 'gradient',
    colourModeThreshold: 15,
    colourModeSoft: true,
    rootHz: initialState?.rootHz,
    octaveSize: initialState?.octaveSize,
    plots: initialState?.plots ?? [],
  }
}

const rulerState = reactive<RulerState>(createRulerState(props.initialState))

const totalColumns = computed(() => rulerState.plots.length + 1)
const noteSetWidth = computed(() =>
  Math.max((rulerWidth.value - LABEL_GUTTER_WIDTH) / totalColumns.value, 0),
)

const visibleRange = computed<[number, number]>(() => [
  panToHz(pxToPan(rulerHeight.value, rulerState.viewPan, rulerState.viewZoom, rulerHeight.value)),
  panToHz(pxToPan(0, rulerState.viewPan, rulerState.viewZoom, rulerHeight.value)),
])

const colourModeOptions = computed(() => [
  { value: 'gradient', label: 'Gradient' },
  { value: 'proxnotes', label: 'Proximity to notes' },
  ...rulerState.plots.map((_plot, index) => ({
    value: `proxplot${index}`,
    label: `Proximity to plot ${index + 1}`,
  })),
])

const noteSetColumns = computed(() => {
  const columns: Array<{ key: string; notes: MoscNoteMs[]; x: number; active?: boolean }> = []

  if (rulerState.collect) {
    columns.push({
      key: 'collected',
      notes: Array.from(rulerState.notes.values()),
      x: 0,
    })
  }

  rulerState.plots.forEach((plot, index) => {
    columns.push({
      key: `plot-${index}`,
      notes: plot,
      x: noteSetWidth.value * (index + 1),
    })
  })

  columns.push({
    key: 'active',
    notes: Array.from(rulerState.notesActive.values()),
    x: 0,
    active: true,
  })

  return columns
})

const getY = (hz: number): number =>
  panToPx(hzToPan(hz), rulerState.viewPan, rulerState.viewZoom, rulerHeight.value)

const getGradientColorFromNote = (note: MoscNoteMs): string => {
  const matched = note.label.match(/([\d.]+)c/)
  if (!matched) return hsl(0, 100, 66)

  const hue = (Number(matched[1]) / 1200) * 360 + 180
  return hsl(hue, 100, 66)
}

const getColorFromNoteProximity = (
  note: MoscNoteMs,
  proxNotes: MoscNoteMs[],
  threshold: number,
  hard: boolean,
): string => {
  if (!proxNotes.length) return hsl(0, 100, 66)

  const noteCents = panToCents(hzToPan(note.hz))
  let distance =
    Math.min(
      ...proxNotes
        .map((proxNote) => panToCents(hzToPan(proxNote.hz)))
        .map((cents) => Math.abs(noteCents - cents)),
    ) / threshold

  if (hard) distance = distance > 1 ? 1000 : distance

  return hsl(360 - Math.min(distance, 2) * 80, 100, Math.max(1 - distance * 0.5, 0) * 50 + 10)
}

const getNoteColor = (note: MoscNoteMs): string => {
  if (rulerState.colourMode === 'gradient') return getGradientColorFromNote(note)

  let compare: MoscNoteMs[] = []
  if (rulerState.colourMode === 'proxnotes') {
    compare = Array.from(rulerState.notes.values())
  } else if (rulerState.colourMode.startsWith('proxplot')) {
    const plotIndex = Number(rulerState.colourMode.replace('proxplot', ''))
    compare = rulerState.plots[plotIndex] ?? []
  }

  return getColorFromNoteProximity(
    note,
    compare,
    rulerState.colourModeThreshold,
    !rulerState.colourModeSoft,
  )
}

const rootGridLines = computed(() => {
  const { rootHz, octaveSize } = rulerState
  if (!rootHz || !octaveSize) return []

  return ROOT_GRID_POSITIONS.map((octave) => ({
    octave,
    hz: rootHz * Math.pow(octaveSize, octave),
  }))
    .filter(({ hz }) => hzInRange(hz, visibleRange.value))
    .map(({ octave, hz }) => ({
      key: `root-${octave}`,
      label: `${Number(hz.toPrecision(6))}Hz`,
      y: getY(hz),
      stroke: hsl(208, 32, (8 - Math.abs(octave)) * 12),
      fill: hsl(208, 32, (8 - Math.abs(octave)) * 24),
    }))
})

const centsGridLines = computed(() => {
  const { rootHz, octaveSize } = rulerState
  if (!rootHz || !octaveSize) return []

  const lines: Array<{ key: string; label: string; y: number; stroke: string; fill: string }> = []
  const equaveCents = ratioToCents(octaveSize)

  CENT_GRID_POSITIONS.forEach((equave) => {
    const equaveRatio = Math.pow(octaveSize, equave)

    for (let cents = 100; cents < equaveCents; cents += 100) {
      const hz = rootHz * equaveRatio * centsToRatio(cents)
      if (hzInRange(hz, visibleRange.value)) {
        lines.push({
          key: `cents-${equave}-${cents}`,
          label: `${cents}c`,
          y: getY(hz),
          stroke: hsl(208, 32, (2 - Math.abs(equave)) * 12),
          fill: hsl(208, 32, (2 - Math.abs(equave)) * 24),
        })
      }
    }
  })

  return lines
})

const visibleNotesForColumn = (notes: MoscNoteMs[]) => {
  return notes.filter((note) => hzInRange(note.hz, visibleRange.value))
}

const clearCollectedNotes = (): void => {
  rulerState.notes.clear()
}

const addNote = (note: MoscNoteMs): void => {
  rulerState.notesActive.set(`${note.ms}-${note.hz}-${note.label}`, note)
  if (rulerState.collect) {
    rulerState.notes.set(`${note.hz}-${note.label}`, note)
  }
}

const removeNote = (note: MoscNoteMs): void => {
  rulerState.notesActive.delete(`${note.ms}-${note.hz}-${note.label}`)
}

const setActiveNote = (note: MoscNoteMs, on: boolean): void => {
  if (on) {
    addNote(note)
    return
  }
  removeNote(note)
}

defineExpose({
  setActiveNote,
})

const handlePointerDown = (event: PointerEvent): void => {
  if (!rulerElement.value || rulerHeight.value <= 0) return

  event.preventDefault()
  rulerElement.value.setPointerCapture(event.pointerId)
  dragStartState.value = {
    startPan: rulerState.viewPan,
    startZoom: rulerState.viewZoom,
    startDrag: pxToPan(event.offsetY, rulerState.viewPan, rulerState.viewZoom, rulerHeight.value),
  }
  dragging.value = true
}

const handlePointerMove = (event: PointerEvent): void => {
  if (!dragStartState.value || rulerHeight.value <= 0) return

  event.preventDefault()
  const nowDrag = pxToPan(
    event.offsetY,
    dragStartState.value.startPan,
    dragStartState.value.startZoom,
    rulerHeight.value,
  )
  rulerState.viewPan = dragStartState.value.startPan + (dragStartState.value.startDrag - nowDrag)
}

const stopDragging = (): void => {
  dragging.value = false
  dragStartState.value = undefined
}

const handleWheel = (event: WheelEvent): void => {
  if (rulerHeight.value <= 0) return

  event.preventDefault()
  const delta = event.deltaY < 0 ? 1 : -1
  const oldZoom = rulerState.viewZoom
  const oldPointerPan = pxToPan(event.offsetY, rulerState.viewPan, oldZoom, rulerHeight.value)
  const newZoom = clamp(oldZoom * Math.pow(ZOOM_SPEED, -delta), MIN_ZOOM, MAX_ZOOM)

  rulerState.viewZoom = newZoom
  rulerState.viewPan = oldPointerPan - (oldPointerPan - rulerState.viewPan) * (newZoom / oldZoom)
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  if (!rulerElement.value) return

  const updateDimensions = (): void => {
    const rect = rulerElement.value?.getBoundingClientRect()
    rulerWidth.value = rect?.width ?? 0
    rulerHeight.value = rect?.height ?? 0
  }

  updateDimensions()
  resizeObserver = new ResizeObserver(updateDimensions)
  resizeObserver.observe(rulerElement.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.initialState,
  (initialState) => {
    const { viewPan, viewZoom } = getInitialView(initialState)
    rulerState.viewPan = viewPan
    rulerState.viewZoom = viewZoom
    rulerState.rootHz = initialState?.rootHz
    rulerState.octaveSize = initialState?.octaveSize
    rulerState.plots = initialState?.plots ?? []
    rulerState.notesActive.clear()

    if (!colourModeOptions.value.some(({ value }) => value === rulerState.colourMode)) {
      rulerState.colourMode = 'gradient'
    }
  },
)
</script>

<template>
  <section class="pitch-ruler" aria-label="Pitch ruler">
    <div class="ruler-toolbar">
      <label class="ruler-control">
        <span>collect</span>
        <input v-model="rulerState.collect" type="checkbox" />
      </label>

      <button class="ruler-button" type="button" @click="clearCollectedNotes">clear</button>

      <label class="ruler-control">
        <span>colour</span>
        <select v-model="rulerState.colourMode">
          <option v-for="option in colourModeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <template v-if="rulerState.colourMode !== 'gradient'">
        <label class="ruler-control">
          <span>threshold</span>
          <input
            v-model.number="rulerState.colourModeThreshold"
            type="number"
            min="1"
            max="100"
            step="1"
          />
        </label>

        <label class="ruler-control">
          <span>soft</span>
          <input v-model="rulerState.colourModeSoft" type="checkbox" />
        </label>
      </template>
    </div>

    <div
      ref="rulerElement"
      class="ruler-canvas"
      :class="{ dragging }"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="stopDragging"
      @pointercancel="stopDragging"
      @wheel="handleWheel"
    >
      <svg class="ruler-svg" :width="rulerWidth" :height="rulerHeight" role="img">
        <title>Pitch ruler notes and plot lines</title>

        <g v-for="line in centsGridLines" :key="line.key" :transform="`translate(0 ${line.y})`">
          <line :x1="0" :x2="Math.max(rulerWidth - 60, 0)" y1="0" y2="0" :stroke="line.stroke" />
          <text :x="Math.max(rulerWidth - 55, 0)" y="-5" :fill="line.fill">{{ line.label }}</text>
        </g>

        <g v-for="line in rootGridLines" :key="line.key" :transform="`translate(0 ${line.y})`">
          <line
            :x1="0"
            :x2="Math.max(rulerWidth - 60, 0)"
            y1="0"
            y2="0"
            :stroke="line.stroke"
            stroke-dasharray="4 4"
          />
          <text :x="Math.max(rulerWidth - 55, 0)" y="-5" :fill="line.fill">{{ line.label }}</text>
        </g>

        <g
          v-for="column in noteSetColumns"
          :key="column.key"
          :transform="`translate(${column.x} 0)`"
        >
          <g
            v-for="(note, index) in visibleNotesForColumn(column.notes)"
            :key="`${column.key}-${note.hz}-${note.label}-${index}`"
            :transform="`translate(0 ${getY(note.hz)})`"
          >
            <line
              :x1="0"
              :x2="noteSetWidth"
              y1="0"
              y2="0"
              :stroke="column.active ? '#ffffff' : getNoteColor(note)"
            />
            <text
              :x="noteSetWidth / 2"
              y="-13"
              text-anchor="middle"
              :fill="column.active ? '#ffffff' : getNoteColor(note)"
            >
              {{ note.label }}
            </text>
          </g>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.pitch-ruler {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--xenpaper-bg-light);
  font-family: var(--xenpaper-font-mono);
}

.ruler-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
  padding: 0.5rem 0.75rem 0;
  background: var(--xenpaper-bg-light);
}

.ruler-control {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  user-select: none;
}

.ruler-control span {
  color: var(--xenpaper-text);
}

.ruler-control select,
.ruler-control input[type='number'] {
  max-width: 11rem;
  border: 1px solid #a490b3;
  color: var(--xenpaper-text);
  background: var(--xenpaper-bg);
  padding: 0.25rem;
}

.ruler-control input[type='number'] {
  width: 4.5rem;
}

.ruler-button {
  border: 0;
  display: block;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  background: #a490b3;
  color: var(--xenpaper-bg);
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s ease-out;
}

.ruler-button:hover,
.ruler-button:focus-visible {
  opacity: 1;
}

.ruler-canvas {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  cursor: grab;
  touch-action: none;
  overflow: hidden;
}

.ruler-canvas.dragging {
  cursor: grabbing;
}

.ruler-svg {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
}

.ruler-svg text {
  font-size: 0.75rem;
  paint-order: stroke;
  stroke: rgba(14, 21, 27, 0.75);
  stroke-width: 2px;
  stroke-linejoin: round;
}
</style>
