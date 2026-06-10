import type { MoscNote, MoscScore } from '../mosc'
import { SoundEngine } from '../mosc'
import type { Bank } from '../sw-seq/bank'
import { PolySynth, type SynthParams } from '../sw-seq/polysynth'
import { isSWOscillatorType, parseSWOscillatorType, type SWOscillatorType } from '../sw-seq/timbre'
import type { Transport } from '../sw-seq/transport'

const OSC_VOLUME = 0.125

type SoundEngineOscParam = { type: 'osc'; osc: SWOscillatorType }
type SoundEngineEnvParam = { type: 'env'; a: number; d: number; s: number; r: number }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isOscParam = (value: unknown): value is SoundEngineOscParam =>
  isRecord(value) && value.type === 'osc'

const isEnvParam = (value: unknown): value is SoundEngineEnvParam =>
  isRecord(value) &&
  value.type === 'env' &&
  typeof value.a === 'number' &&
  typeof value.d === 'number' &&
  typeof value.s === 'number' &&
  typeof value.r === 'number'

export class SoundEngineSwSeq extends SoundEngine {
  private endTime = 0
  private activeNoteEvents = new Set<MoscNote>()
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

  get context() {
    return this.transport.context
  }

  private clearScheduledEvents(): void {
    this.transportEventIds.forEach((_, id) => this.transport.clear(id))
    this.transportEventIds.clear()
    for (const callback of this.noteOffs) {
      // Just release, scheduling be damned
      callback(this.context.currentTime)
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
      callback(this.context.currentTime)
    }
  }

  setOutputGain(gain: number): void {
    this.destination.gain.setValueAtTime(gain, this.context.currentTime)
  }

  setScore(score: MoscScore): void {
    this.score = score
    this.clearScheduledEvents()
    this.endTime = score.lengthTime

    const patch: SynthParams = {
      frequency: 440,
      velocity: OSC_VOLUME,
      oscillator: {
        type: 'sine',
        periodicity: 'harmonic',
        periodicWave: null,
        aperiodicWave: null,
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
        patch.frequency = item.hz
        const noteHandle = this.synth.trigger(patch)
        const noteEventId = this.transport.scheduleParametricNote({
          noteOn: (time) => {
            noteHandle.noteOn(time)
            this.activeNoteEvents.add(item)
            this._triggerEvent('note', item, true)
          },
          noteOff: (time) => {
            noteHandle.noteOff(time)
            this.activeNoteEvents.delete(item)
            this._triggerEvent('note', item, false)
          },
          when: item.time,
          duration: item.timeEnd - item.time,
        })
        this.transportEventIds.set(noteEventId, true)
        this.noteOffs.push(noteHandle.noteOff)
      } else if (item.type === 'PARAM_TIME') {
        // No scheduling needed. Change the active patch directly.
        if (isOscParam(item.value)) {
          if (isSWOscillatorType(item.value.osc))
            patch.oscillator = parseSWOscillatorType(item.value.osc, this.context)
          else throw new Error(`"${item.value.osc}" is not a valid oscillator type.`)
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
