import type { Bank } from './bank'
import type { EnvelopedAperiodicOscillator, EnvelopedOscillator, EnvelopedUnison } from './nodes'
import type {
  NoiseGeneratorNode,
  NoiseGeneratorType,
  NoiseInterpolationType,
} from './noise-worklet'
import type { SynthType as TimbreSynthType } from './timbre'

const TIME_CONSTANT = 0.2

const EASING_BEZIERS = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
} as const

const cubicBezier = (x1: number, y1: number, x2: number, y2: number, x: number): number => {
  const sample = (a1: number, a2: number, t: number): number => {
    const inv = 1 - t
    return 3 * inv * inv * t * a1 + 3 * inv * t * t * a2 + t * t * t
  }
  const slope = (a1: number, a2: number, t: number): number =>
    3 * (1 - t) * (1 - t) * a1 + 6 * (1 - t) * t * (a2 - a1) + 3 * t * t * (1 - a2)

  let t = x
  for (let i = 0; i < 8; i += 1) {
    const xAtT = sample(x1, x2, t) - x
    const dx = slope(x1, x2, t)
    if (Math.abs(xAtT) < 1e-6 || dx === 0) break
    t -= xAtT / dx
  }

  return sample(y1, y2, Math.min(1, Math.max(0, t)))
}

const easingCurve = (
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out',
  centsStart: number,
  centsEnd: number,
): Float32Array => {
  const [x1, y1, x2, y2] = EASING_BEZIERS[easing]
  const values = new Float32Array(128)
  for (let index = 0; index < values.length; index += 1) {
    const x = index / (values.length - 1)
    values[index] = centsStart + cubicBezier(x1, y1, x2, y2, x) * (centsEnd - centsStart)
  }
  return values
}

export type NoiseSynthType = {
  type: 'noise'
  noise: NoiseGeneratorType
  interpolation: NoiseInterpolationType
  periodicity: 'noise'
  periodicWave: null
  aperiodicWave: null
}

export type SynthType = TimbreSynthType | NoiseSynthType

export const WHITE_NOISE_SYNTH_TYPE: NoiseSynthType = {
  type: 'noise',
  noise: 'white',
  interpolation: 'constant',
  periodicity: 'noise',
  periodicWave: null,
  aperiodicWave: null,
}

type Envelope = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export type SynthParams = {
  frequency: number
  duration?: number
  pitchAutomation?: Array<{
    time: number
    hz: number
    pitchInterpolation?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
  }>
  velocity: number
  synth: SynthType
  envelope: Envelope
}

/**
 * Polyphonic synth consisting of a basic oscillator and an ADSR envelope.
 */
export class PolySynth {
  private bank: Bank
  private destination: AudioNode

  constructor(bank: Bank, destination: AudioNode) {
    this.bank = bank
    this.destination = destination
  }

  get context() {
    return this.bank.context
  }

  trigger(params: SynthParams) {
    const { periodicity } = params.synth

    if (periodicity === 'aperiodic') {
      return this.triggerWithOscillator(
        params,
        this.bank.allocateAperiodicOscillator.bind(this.bank),
        this.bank.freeAperiodicOscillator.bind(this.bank),
      )
    }

    if (periodicity === 'noise') {
      return this.triggerWithOscillator(
        params,
        this.bank.allocateNoiseGenerator.bind(this.bank),
        this.bank.freeNoiseGenerator.bind(this.bank),
      )
    }

    return periodicity === 'unison'
      ? this.triggerWithOscillator(
          params,
          this.bank.allocateUnison.bind(this.bank),
          this.bank.freeUnison.bind(this.bank),
        )
      : this.triggerWithOscillator(
          params,
          this.bank.allocateOscillator.bind(this.bank),
          this.bank.freeOscillator.bind(this.bank),
        )
  }

  private triggerWithOscillator<
    T extends
      | EnvelopedOscillator
      | EnvelopedUnison
      | EnvelopedAperiodicOscillator
      | NoiseGeneratorNode,
  >(
    params: SynthParams,
    allocate: (time?: number, synth?: SynthType) => T | null,
    release: (oscillator: T, freeAt?: number) => void,
  ) {
    let oscillator: T | null = null
    let startTime = NaN

    const { frequency, pitchAutomation, velocity, synth } = params
    const { type, periodicWave, aperiodicWave } = synth

    const {
      attack: attackTime,
      decay: decayTime,
      sustain: sustainLevel,
      release: releaseTime,
    } = params.envelope

    const noteOn = (time: number) => {
      // Loops can cause note-ons to unpair from note-offs. Release previous resources.
      if (oscillator !== null) void release(oscillator, time)

      oscillator = allocate(time, synth)
      if (oscillator === null) return

      startTime = time
      if (aperiodicWave !== null && 'setAperiodicWave' in oscillator) {
        oscillator.setAperiodicWave(aperiodicWave)
      } else if (type === 'custom' && periodicWave !== null && 'setPeriodicWave' in oscillator) {
        oscillator.setPeriodicWave(periodicWave)
      } else if (type === 'noise' && 'type' in oscillator) {
        const noiseGenerator = oscillator as NoiseGeneratorNode
        noiseGenerator.type = synth.noise
        noiseGenerator.interpolation = synth.interpolation
      } else if (type !== 'custom' && type !== 'noise' && 'type' in oscillator) {
        oscillator.type = type
      }
      const activeOscillator = oscillator
      activeOscillator.frequency.setValueAtTime(frequency, time)
      activeOscillator.detune.setValueAtTime(0, time)
      const automationPoints = pitchAutomation ?? []
      let segmentStartTime = time
      let segmentStartCents = 0
      automationPoints.forEach((point) => {
        const pointTime = time + point.time
        const segmentDuration = pointTime - segmentStartTime
        if (segmentDuration <= 0) return
        const centsEnd = 1200 * Math.log2(point.hz / frequency)
        const interpolation = point.pitchInterpolation ?? 'linear'
        if (interpolation === 'linear') {
          activeOscillator.detune.linearRampToValueAtTime(centsEnd, pointTime)
        } else {
          activeOscillator.detune.setValueCurveAtTime(
            easingCurve(interpolation, segmentStartCents, centsEnd),
            segmentStartTime,
            segmentDuration,
          )
        }
        segmentStartTime = pointTime
        segmentStartCents = centsEnd
      })
      activeOscillator.connect(this.destination)
      activeOscillator.gain.setValueAtTime(0, startTime)

      if (attackTime <= 0) activeOscillator.gain.setValueAtTime(velocity, startTime)
      else activeOscillator.gain.linearRampToValueAtTime(velocity, startTime + attackTime)

      if (decayTime <= 0)
        activeOscillator.gain.setValueAtTime(sustainLevel * velocity, startTime + attackTime)
      else
        activeOscillator.gain.setTargetAtTime(
          sustainLevel * velocity,
          startTime + attackTime,
          decayTime * TIME_CONSTANT,
        )
    }

    const noteOff = (endTime: number) => {
      if (oscillator === null) return

      oscillator.gain.cancelScheduledValues(endTime)
      // Manually hold linear ramp if needed
      if (endTime < startTime + attackTime) {
        // Note-offs can be called out-of-schedule so clamping is needed.
        oscillator.gain.setValueAtTime(
          Math.max(0, (endTime - startTime) / attackTime) * velocity,
          endTime,
        )
      }

      if (releaseTime <= 0) oscillator.gain.setValueAtTime(0, endTime)
      else oscillator.gain.setTargetAtTime(0, endTime, releaseTime * TIME_CONSTANT)

      void release(oscillator, endTime + releaseTime)

      // Loops can cause note-offs to unpair from note-ons. Prevent double release.
      oscillator = null
    }

    return { noteOn, noteOff }
  }
}
