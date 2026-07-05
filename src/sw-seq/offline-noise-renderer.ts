import type { MoscItem, MoscScore } from '../mosc'
import { isNoiseGeneratorType, type NoiseGeneratorType } from './noise-worklet'

const OSC_VOLUME = 0.275
const VOLUME_TIME_CONSTANT = 0.001
const ENVELOPE_TIME_CONSTANT = 0.2
const PINK_OCTAVE_COUNT = 10
const PINK_GAIN = 1 / Math.sqrt(PINK_OCTAVE_COUNT)

type NoiseParam = { type: 'noise'; noise: string }
type OscParam = { type: 'osc'; osc: string }
type EnvParam = { type: 'env'; a: number; d: number; s: number; r: number }
type VolumeParam = { type: 'volume'; db: number }
type VelocityParam = { type: 'velocity'; velocity: number }

type Envelope = {
  attack: number
  decay: number
  sustain: number
  release: number
}

type NoiseRenderSource = {
  score: MoscScore
  gain: number
}

type NoiseRenderEvent = {
  noise: NoiseGeneratorType
  time: number
  timeEnd: number
  frequency: number
  velocity: number
  envelope: Envelope
  gain: number
  volumeEvents: Array<{ time: number; gain: number }>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isNoiseParam = (value: unknown): value is NoiseParam =>
  isRecord(value) && value.type === 'noise' && typeof value.noise === 'string'

const isOscParam = (value: unknown): value is OscParam =>
  isRecord(value) && value.type === 'osc' && typeof value.osc === 'string'

const isEnvParam = (value: unknown): value is EnvParam =>
  isRecord(value) &&
  value.type === 'env' &&
  typeof value.a === 'number' &&
  typeof value.d === 'number' &&
  typeof value.s === 'number' &&
  typeof value.r === 'number'

const isVolumeParam = (value: unknown): value is VolumeParam =>
  isRecord(value) && value.type === 'volume' && typeof value.db === 'number'

const isVelocityParam = (value: unknown): value is VelocityParam =>
  isRecord(value) && value.type === 'velocity' && typeof value.velocity === 'number'

const dbToGain = (db: number): number => Math.pow(10, db / 20)

function createNoiseSampleGenerator(noise: NoiseGeneratorType): () => number {
  let previousWhiteSample = 0
  let previousPinkSample = 0
  let brownSample = 0
  const pinkOctaveSamples = new Float64Array(PINK_OCTAVE_COUNT)
  const pinkOctaveCountdowns = new Uint32Array(PINK_OCTAVE_COUNT)

  const nextPinkSample = () => {
    let pinkSample = 0

    for (let octave = 0; octave < PINK_OCTAVE_COUNT; octave++) {
      if (pinkOctaveCountdowns[octave] === 0) {
        pinkOctaveSamples[octave] = Math.random() * 2 - 1
        pinkOctaveCountdowns[octave] = 1 << octave
      }

      pinkSample += pinkOctaveSamples[octave] ?? 0
      pinkOctaveCountdowns[octave] = (pinkOctaveCountdowns[octave] ?? 1) - 1
    }

    return pinkSample * PINK_GAIN
  }

  return () => {
    if (noise === 'pink') return nextPinkSample()

    if (noise === 'blue') {
      const pinkSample = nextPinkSample()
      const blueSample = pinkSample - previousPinkSample
      previousPinkSample = pinkSample
      return blueSample
    }

    const whiteSample = Math.random() * 2 - 1

    if (noise === 'brown') {
      brownSample = brownSample * 0.95 + whiteSample * 0.8
      brownSample = Math.max(-2, Math.min(2, brownSample))
      return brownSample
    }

    if (noise === 'violet') {
      const violetSample = (whiteSample - previousWhiteSample) * 0.66
      previousWhiteSample = whiteSample
      return violetSample
    }

    return whiteSample
  }
}

const gainAtTime = (time: number, event: NoiseRenderEvent): number => {
  const { envelope, velocity, time: startTime, timeEnd } = event
  const attackEnd = startTime + envelope.attack

  let noteGain: number
  if (time < attackEnd) {
    noteGain =
      envelope.attack <= 0 ? velocity : Math.max(0, (time - startTime) / envelope.attack) * velocity
  } else if (envelope.decay <= 0) {
    noteGain = envelope.sustain * velocity
  } else {
    noteGain =
      envelope.sustain * velocity +
      (velocity - envelope.sustain * velocity) *
        Math.exp(-(time - attackEnd) / (envelope.decay * ENVELOPE_TIME_CONSTANT))
  }

  if (time >= timeEnd) {
    if (envelope.release <= 0) return 0
    noteGain *= Math.exp(-(time - timeEnd) / (envelope.release * ENVELOPE_TIME_CONSTANT))
  }

  return noteGain
}

const scoreVolumeAtTime = (time: number, volumeEvents: NoiseRenderEvent['volumeEvents']) => {
  let currentGain = 1
  let currentTime = 0

  for (const event of volumeEvents) {
    if (event.time > time) break
    currentGain =
      event.gain +
      (currentGain - event.gain) * Math.exp(-(event.time - currentTime) / VOLUME_TIME_CONSTANT)
    currentTime = event.time
  }

  let targetGain = 1
  for (const event of volumeEvents) {
    if (event.time > time) break
    targetGain = event.gain
  }

  return (
    targetGain + (currentGain - targetGain) * Math.exp(-(time - currentTime) / VOLUME_TIME_CONSTANT)
  )
}

function collectNoiseEvents(source: NoiseRenderSource, lookAhead: number, sampleRate: number) {
  let noise: NoiseGeneratorType | null = null
  let velocity = OSC_VOLUME
  let envelope: Envelope = { attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.5 }
  const volumeEvents: NoiseRenderEvent['volumeEvents'] = []
  const retainedSequence: MoscItem[] = []
  const events: NoiseRenderEvent[] = []

  for (const item of source.score.sequence) {
    if (item.type === 'PARAM_TIME') {
      if (isNoiseParam(item.value)) {
        if (!isNoiseGeneratorType(item.value.noise)) {
          throw new Error(`"${item.value.noise}" is not a valid noise generator.`)
        }
        noise = item.value.noise
      } else if (isOscParam(item.value)) {
        noise = null
        retainedSequence.push(item)
      } else if (isEnvParam(item.value)) {
        envelope = {
          attack: item.value.a,
          decay: item.value.d,
          sustain: item.value.s,
          release: item.value.r,
        }
        retainedSequence.push(item)
      } else if (isVelocityParam(item.value)) {
        velocity = OSC_VOLUME * item.value.velocity
        retainedSequence.push(item)
      } else if (isVolumeParam(item.value)) {
        volumeEvents.push({ time: item.time + lookAhead, gain: dbToGain(item.value.db) })
        retainedSequence.push(item)
      } else {
        retainedSequence.push(item)
      }
      continue
    }

    if (item.type === 'NOTE_TIME' || item.type === 'SAMPLE_RATE_NOTE_TIME') {
      if (noise === null) {
        retainedSequence.push(item)
        continue
      }

      events.push({
        noise,
        time: item.time + lookAhead,
        timeEnd: item.timeEnd + lookAhead,
        frequency: item.type === 'SAMPLE_RATE_NOTE_TIME' ? sampleRate : item.hz,
        velocity,
        envelope,
        gain: source.gain,
        volumeEvents: volumeEvents.slice(),
      })
      continue
    }

    retainedSequence.push(item)
  }

  return {
    score: { ...source.score, sequence: retainedSequence },
    noiseEvents: events,
  }
}

export function stripOfflineNoiseEvents(
  sources: NoiseRenderSource[],
  lookAhead: number,
  sampleRate: number,
) {
  const noiseEvents: NoiseRenderEvent[] = []
  const scores = sources.map((source) => {
    const result = collectNoiseEvents(source, lookAhead, sampleRate)
    noiseEvents.push(...result.noiseEvents)
    return { score: result.score, gain: source.gain }
  })

  return { scores, noiseEvents }
}

export function renderOfflineNoiseEvents(buffer: AudioBuffer, events: NoiseRenderEvent[]): void {
  const sampleRate = buffer.sampleRate

  for (const event of events) {
    const nextSample = createNoiseSampleGenerator(event.noise)
    let phase = 1
    let currentSample = 0
    const endTime = event.timeEnd + Math.max(0, event.envelope.release) * 8
    const startFrame = Math.max(0, Math.floor(event.time * sampleRate))
    const endFrame = Math.min(buffer.length, Math.ceil(endTime * sampleRate))

    for (let frame = startFrame; frame < endFrame; frame++) {
      const time = frame / sampleRate
      phase += Math.max(0, event.frequency) / sampleRate
      if (phase >= 1) {
        currentSample = nextSample()
        phase -= Math.floor(phase)
      }

      const sample =
        currentSample *
        gainAtTime(time, event) *
        event.gain *
        scoreVolumeAtTime(time, event.volumeEvents)
      for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex++) {
        const channel = buffer.getChannelData(channelIndex)
        channel[frame] = Math.max(-1, Math.min(1, channel[frame]! + sample))
      }
    }
  }
}
