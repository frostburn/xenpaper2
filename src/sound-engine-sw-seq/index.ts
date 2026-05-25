import type { MoscNoteTime, MoscScore } from '../mosc'
import { SoundEngine } from '../mosc'
import type { Bank } from '../sw-seq/bank'
import { PolySynth, type SynthParams } from '../sw-seq/polysynth'
import type { Transport } from '../sw-seq/transport'

const OSC_VOLUME = 0.125
const OSC_TYPES = ['sine', 'square', 'triangle', 'sawtooth'] as const

type SoundEngineOscillatorType = (typeof OSC_TYPES)[number]
type SoundEngineOscParam = { type: 'osc'; osc: SoundEngineOscillatorType }
type SoundEngineEnvParam = { type: 'env'; a: number; d: number; s: number; r: number }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isOscParam = (value: unknown): value is SoundEngineOscParam =>
  isRecord(value) &&
  value.type === 'osc' &&
  typeof value.osc === 'string' &&
  OSC_TYPES.includes(value.osc as SoundEngineOscillatorType)

const isEnvParam = (value: unknown): value is SoundEngineEnvParam =>
  isRecord(value) &&
  value.type === 'env' &&
  typeof value.a === 'number' &&
  typeof value.d === 'number' &&
  typeof value.s === 'number' &&
  typeof value.r === 'number'

export class SoundEngineSwSeq extends SoundEngine {
  private endTime = 0
  private activeNoteEvents = new Set<MoscNoteTime>()
  private noteOffs: Array<(time: number) => void> = []
  private destination: GainNode
  private synth: PolySynth
  private transport: Transport
  private transportEventIds = new Map<number, true>()

  constructor(transport: Transport, bank: Bank) {
    super()
    this.transport = transport
    this.destination = transport.context.createGain()
    this.destination.gain.setValueAtTime(1, transport.context.currentTime)
    this.destination.connect(transport.context.destination)
    this.synth = new PolySynth(bank, this.destination)
  }

  private clearScheduledEvents(): void {
    this.transportEventIds.forEach((_, id) => this.transport.clear(id))
    this.transportEventIds.clear()
    for (const callback of this.noteOffs) {
      // Just release, scheduling be damned
      callback(this.transport.context.currentTime)
    }
    this.noteOffs.length = 0
  }

  endPosition(): number {
    return this.endTime
  }

  dispose(): void {
    this.clearScheduledEvents()
    this.cutActiveNotes()
  }

  cutActiveNotes(_time?: number): void {
    this.activeNoteEvents.forEach((note) => this._triggerEvent('note', note, false))
    this.activeNoteEvents.clear()
    for (const callback of this.noteOffs) {
      // Just release, scheduling be damned
      callback(this.transport.context.currentTime)
    }
  }

  setOutputGain(gain: number): void {
    this.destination.gain.setValueAtTime(gain, this.transport.context.currentTime)
  }

  async setScore(score: MoscScore): Promise<void> {
    this.score = score
    this.clearScheduledEvents()
    this.endTime = score.lengthTime

    const patch: SynthParams = {
      velocity: OSC_VOLUME,
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.01,
        sustain: 0.5,
        decay: 0.25,
        release: 0.5,
      },
    }

    score.sequence.forEach((item) => {
      if (item.type === 'NOTE_TIME') {
        const noteHandle = this.synth.trigger(item.hz, patch)
        const noteStartId = this.transport.scheduleParametric((time) => {
          noteHandle.noteOn(time)
          this.activeNoteEvents.add(item)
          this._triggerEvent('note', item, true)
        }, item.time)
        const noteEndId = this.transport.scheduleParametric((time) => {
          noteHandle.noteOff(time)
          this.activeNoteEvents.delete(item)
          this._triggerEvent('note', item, false)
        }, item.timeEnd)
        this.transportEventIds.set(noteStartId, true)
        this.transportEventIds.set(noteEndId, true)
        this.noteOffs.push(noteHandle.noteOff)
      } else if (item.type === 'PARAM_TIME') {
        // No scheduling needed. Change the active patch directly.
        if (isOscParam(item.value)) {
          patch.oscillator.type = item.value.osc
        }
        if (isEnvParam(item.value)) {
          patch.envelope = {
            attack: item.value.a,
            decay: item.value.d,
            sustain: item.value.s,
            release: item.value.r,
          }
        }
      } else if (item.type === 'END_TIME') {
        this.endTime = item.time
        const endId = this.transport.scheduleEvent(() => {
          if (this.transport.loop) return
          this.cutActiveNotes()
          this._triggerEvent('end', item.time)
        }, item.time)
        this.transportEventIds.set(endId, true)
      }
    })
  }
}
