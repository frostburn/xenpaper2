import type { Bank } from './bank'

const TIME_CONSTANT = 0.5

const DEFAULT_ATTACK = 0.01
const DEFAULT_DECAY = 0.3
const DEFAULT_SUSTAIN = 0.8
const DEFAULT_RELEASE = 0.01

type SynthOscillatorOptions = {
  type?: OscillatorType
}

export type SynthOptions = {
  oscillator?: SynthOscillatorOptions
  envelope?: {
    attack?: number
    decay?: number
    sustain?: number
    release?: number
  }
}

/**
 * Polyphonic synth consisting of a basic oscillator and an ADSR envelope.
 */
export class PolySynth {
  private bank: Bank
  private destination: AudioNode

  oscillatorType: OscillatorType
  attackTime: number
  decayTime: number
  sustainLevel: number
  releaseTime: number

  constructor(bank: Bank, destination: AudioNode, opts?: SynthOptions) {
    this.bank = bank
    this.destination = destination
    this.oscillatorType = opts?.oscillator?.type ?? 'sine'
    this.attackTime = opts?.envelope?.attack ?? DEFAULT_ATTACK
    this.decayTime = opts?.envelope?.decay ?? DEFAULT_DECAY
    this.sustainLevel = opts?.envelope?.sustain ?? DEFAULT_SUSTAIN
    this.releaseTime = opts?.envelope?.release ?? DEFAULT_RELEASE
  }

  get context() {
    return this.bank.context
  }

  set(opts: SynthOptions) {
    if (opts.oscillator?.type) this.oscillatorType = opts.oscillator.type
    if (opts.envelope) {
      if (opts.envelope.attack !== undefined) this.attackTime = opts.envelope.attack
      if (opts.envelope.decay !== undefined) this.decayTime = opts.envelope.decay
      if (opts.envelope.sustain !== undefined) this.sustainLevel = opts.envelope.sustain
      if (opts.envelope.release !== undefined) this.releaseTime = opts.envelope.release
    }
  }

  trigger(frequency: number) {
    let oscillator: OscillatorNode | null = null
    let startTime = NaN
    let attackTime = NaN
    let decayTime = NaN
    let sustainLevel = NaN
    let releaseTime = NaN

    const noteOn = (time: number) => {
      oscillator = this.bank.allocateOscillator()
      if (oscillator === null) return

      startTime = time
      oscillator.type = this.oscillatorType
      oscillator.frequency.setValueAtTime(frequency, time)
      oscillator.connect(this.destination)
      oscillator.gain.setValueAtTime(0, startTime)

      attackTime = this.attackTime
      decayTime = this.decayTime
      sustainLevel = this.sustainLevel
      releaseTime = this.releaseTime

      if (attackTime <= 0) oscillator.gain.setValueAtTime(1, startTime)
      else oscillator.gain.linearRampToValueAtTime(1, startTime + attackTime)

      if (this.decayTime <= 0) oscillator.gain.setValueAtTime(sustainLevel, startTime + attackTime)
      else oscillator.gain.setTargetAtTime(sustainLevel, startTime + attackTime, decayTime * TIME_CONSTANT)
    }

    const noteOff = (endTime: number) => {
      if (oscillator === null) return

      oscillator.gain.cancelScheduledValues(endTime)
      if (endTime < startTime + attackTime) {
        oscillator.gain.setValueAtTime((endTime - startTime) / attackTime)
      }

      if (releaseTime <= 0) oscillator.gain.setValueAtTime(0, endTime)
      else oscillator.gain.setTargetAtTime(0, endTime, releaseTime * TIME_CONSTANT)

      this.bank.freeOscillator(oscillator)
    }

    return { noteOn, noteOff }
  }
}
