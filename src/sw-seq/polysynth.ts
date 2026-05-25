import type { Bank, EnvelopedOscillator } from './bank'

const TIME_CONSTANT = 0.5

const DEFAULT_ATTACK = 0.01
const DEFAULT_DECAY = 0.3
const DEFAULT_SUSTAIN = 0.8
const DEFAULT_RELEASE = 0.01

export type SynthParams = {
  oscillator: {type: OscillatorType}
  envelope: {
    attack: number
    decay: number
    sustain: number
    release: number
  }
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
    let oscillator: EnvelopedOscillator | null = null

    let startTime = NaN;
    const type = params.oscillator.type
    const attackTime = params.envelope.attack
    const decayTime = params.envelope.decay
    const sustainLevel = params.envelope.sustain
    const releaseTime = params.envelope.release

    const noteOn = (time: number) => {
      // Loops can cause note-ons to unpair from note-offs. Release previous resources.
      if (oscillator !== null)
        this.bank.freeOscillator(oscillator)

      oscillator = this.bank.allocateOscillator()
      if (oscillator === null) return

      startTime = time
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, time)
      oscillator.connect(this.destination)
      oscillator.gain.setValueAtTime(0, startTime)

      if (attackTime <= 0) oscillator.gain.setValueAtTime(1, startTime)
      else oscillator.gain.linearRampToValueAtTime(1, startTime + attackTime)

      if (decayTime <= 0) oscillator.gain.setValueAtTime(sustainLevel, startTime + attackTime)
      else oscillator.gain.setTargetAtTime(sustainLevel, startTime + attackTime, decayTime * TIME_CONSTANT)
    }

    const noteOff = (endTime: number) => {
      if (oscillator === null) return

      oscillator.gain.cancelScheduledValues(endTime)
      // Manually hold linear ramp if needed
      if (endTime < startTime + attackTime) {
        // Note-offs can be called out-of-schedule so clamping is needed.
        oscillator.gain.setValueAtTime(Math.max(0, (endTime - startTime) / attackTime), endTime)
      }

      if (releaseTime <= 0) oscillator.gain.setValueAtTime(0, endTime)
      else oscillator.gain.setTargetAtTime(0, endTime, releaseTime * TIME_CONSTANT)

      this.bank.freeOscillator(oscillator)

      // Loops can cause note-offs to unpair from note-ons. Prevent double release.
      oscillator = null
    }

    return { noteOn, noteOff }
  }
}
