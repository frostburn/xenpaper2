import type {Bank, EnvelopedOscillator} from './bank'

const TIME_CONSTANT = 0.5;
const RECOLLECTION_CONSTANT = 6;

const DEFAULT_ATTACK = 0.01;
const DEFAULT_DECAY = 0.3;
const DEFAULT_SUSTAIN = 0.8;
const DEFAULT_RELEASE = 0.01;

export type SynthOptions = {
  attackTime?: number;
  decayTime?: number;
  sustainLevel?: number;
  releaseTime?: number;
}

function doNothing() {
  return;
}

/**
 * Polyphonic synth consisting of a basic oscillator and an ADSR envelope.
 */
export class PolySynth {
  private bank: Bank;
  private destination: AudioNode;

  attackTime: number;
  decayTime: number;
  sustainLevel: number;
  releaseTime: number;

  constructor(bank: Bank, destination: AudioNode, opts?: SynthOptions) {
    this.bank = bank;
    this.destination = destination;
    this.attackTime = opts?.attackTime ?? DEFAULT_ATTACK;
    this.decayTime = opts?.decayTime ?? DEFAULT_DECAY;
    this.sustainLevel = opts?.sustainLevel ?? DEFAULT_SUSTAIN;
    this.releaseTime = opts?.releaseTime ?? DEFAULT_RELEASE;
  }

  get context() {
    return this.bank.context;
  }

  trigger(frequency: number) {
    let oscillator: OscillatorNode | null = null;
    let startTime = NaN;
    let attackTime = NaN;
    let decayTime = NaN;
    let sustainLevel = NaN;
    let releaseTime = NaN;

    const noteOn = (time: number) => {
      oscillator = this.bank.allocateOscillator();
      if (oscillator === null) {
        return;
      }
      startTime = time;
      oscillator.connect(this.destination);
      oscillator.gain.setValueAtTime(0, startTime);

      // Xenpaper allows you to change unschedulable params. Store references.
      attackTime = this.attackTime;
      decayTime = this.decayTime;
      sustainLevel = this.sustainLevel;
      releaseTime = this.releaseTime;

      if (attackTime <= 0) {
        oscillator.gain.setValueAtTime(1, startTime);
      } else {
        oscillator.gain.linearRampToValueAtTime(1, startTime + attackTime);
      }

      if (this.decayTime <= 0) {
        oscillator.gain.setValueAtTime(sustainLevel, startTime + attackTime);
      } else {
        oscillator.gain.setTargetAtTime(sustainLevel, startTime + attackTime, decayTime * TIME_CONSTANT);
      }
    }

    const noteOff = (endTime: number) => {
      if (oscillator === null) {
        return;
      }
      oscillator.gain.cancelScheduledValues(endTime);
      // NOTE: Canceling scheduled values doesn't hold intermediate values of linear ramps
      if (endTime < startTime + attackTime) {
        // Calculate correct linear ramp hold value
        oscillator.gain.setValueAtTime((endTime - startTime) / attackTime);
      }

      if (releaseTime <= 0) {
        oscillator.gain.setValueAtTime(0, endTime);
      } else {
        oscillator.gain.setTargetAtTime(0, endTime, releaseTime * TIME_CONSTANT);
      }

      // Allow eventual re-use.
      // Can technically glitch out due to look-ahead but we'll tweak it once we run into it.
      this.bank.freeOscillator(oscillator);
    }

    return {noteOn, noteOff};
  }
}
