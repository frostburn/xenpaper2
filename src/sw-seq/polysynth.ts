import type { Bank } from './bank'
import type { EnvelopedAperiodicOscillator, EnvelopedOscillator, EnvelopedUnison } from './nodes'
import type { SynthType } from './timbre'

const TIME_CONSTANT = 0.2

type Envelope = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export type SynthParams = {
  frequency: number
  velocity: number
  oscillator: SynthType
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
    const { periodicity } = params.oscillator

    if (periodicity === 'aperiodic') {
      return this.triggerWithOscillator(
        params,
        this.bank.allocateAperiodicOscillator.bind(this.bank),
        this.bank.freeAperiodicOscillator.bind(this.bank),
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
    T extends EnvelopedOscillator | EnvelopedUnison | EnvelopedAperiodicOscillator,
  >(params: SynthParams, allocate: () => T | null, release: (oscillator: T) => void) {
    let oscillator: T | null = null
    let startTime = NaN

    const { frequency, velocity } = params
    const { type, periodicWave, aperiodicWave } = params.oscillator

    const {
      attack: attackTime,
      decay: decayTime,
      sustain: sustainLevel,
      release: releaseTime,
    } = params.envelope

    const noteOn = (time: number) => {
      // Loops can cause note-ons to unpair from note-offs. Release previous resources.
      if (oscillator !== null) void release(oscillator)

      oscillator = allocate()
      if (oscillator === null) return

      startTime = time
      if (aperiodicWave !== null && 'setAperiodicWave' in oscillator) {
        oscillator.setAperiodicWave(aperiodicWave)
      } else if (type === 'custom' && periodicWave !== null && 'setPeriodicWave' in oscillator) {
        oscillator.setPeriodicWave(periodicWave)
      } else if (type !== 'custom') {
        oscillator.type = type
      }
      oscillator.frequency.setValueAtTime(frequency, time)
      oscillator.connect(this.destination)
      oscillator.gain.setValueAtTime(0, startTime)

      if (attackTime <= 0) oscillator.gain.setValueAtTime(velocity, startTime)
      else oscillator.gain.linearRampToValueAtTime(velocity, startTime + attackTime)

      if (decayTime <= 0)
        oscillator.gain.setValueAtTime(sustainLevel * velocity, startTime + attackTime)
      else
        oscillator.gain.setTargetAtTime(
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

      void release(oscillator)

      // Loops can cause note-offs to unpair from note-ons. Prevent double release.
      oscillator = null
    }

    return { noteOn, noteOff }
  }
}
