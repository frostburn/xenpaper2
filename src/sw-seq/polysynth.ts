import type { Bank } from './bank'
import type { EnvelopedOscillator, EnvelopedUnison } from './nodes'

const TIME_CONSTANT = 0.5

type Envelope = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export type SynthParams = {
  velocity: number
  oscillator: { type: OscillatorType; unison: boolean }
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

  trigger(frequency: number, params: SynthParams) {
    const { velocity } = params
    const { type, unison } = params.oscillator
    const envelope = params.envelope

    return unison
      ? this.triggerWithOscillator(
          frequency,
          velocity,
          type,
          envelope,
          () => this.bank.allocateUnison(),
          (oscillator) => this.bank.freeUnison(oscillator),
        )
      : this.triggerWithOscillator(
          frequency,
          velocity,
          type,
          envelope,
          () => this.bank.allocateOscillator(),
          (oscillator) => this.bank.freeOscillator(oscillator),
        )
  }

  private triggerWithOscillator<T extends EnvelopedOscillator | EnvelopedUnison>(
    frequency: number,
    velocity: number,
    type: OscillatorType,
    envelope: Envelope,
    allocate: () => T | null,
    release: (oscillator: T) => void,
  ) {
    let oscillator: T | null = null
    let startTime = NaN

    const { attack: attackTime, decay: decayTime, sustain: sustainLevel, release: releaseTime } =
      envelope

    const noteOn = (time: number) => {
      // Loops can cause note-ons to unpair from note-offs. Release previous resources.
      if (oscillator !== null) void release(oscillator)

      oscillator = allocate()
      if (oscillator === null) return

      startTime = time
      oscillator.type = type
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
