import type { MoscNoteTime, MoscScoreTime } from '../mosc'
import { SoundEngine } from '../mosc'
import { Bank } from '../sw-seq/bank'
import { PolySynth } from '../sw-seq/polysynth'
import { Transport } from '../sw-seq/transport'

const OSC_VOLUME = 0.125
const OSC_TYPES = ['sine', 'square', 'triangle', 'sawtooth'] as const

type SoundEngineOscillatorType = (typeof OSC_TYPES)[number]
type SoundEngineOscParam = { type: 'osc'; osc: SoundEngineOscillatorType }
type SoundEngineEnvParam = { type: 'env'; a: number; d: number; s: number; r: number }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isOscParam = (value: unknown): value is SoundEngineOscParam =>
  isRecord(value) && value.type === 'osc' && typeof value.osc === 'string' && OSC_TYPES.includes(value.osc as SoundEngineOscillatorType)

const isEnvParam = (value: unknown): value is SoundEngineEnvParam =>
  isRecord(value) && value.type === 'env' && typeof value.a === 'number' && typeof value.d === 'number' && typeof value.s === 'number' && typeof value.r === 'number'

type SynthPatch = {
  oscillator: { type: OscillatorType }
  envelope: { attack: number; decay: number; sustain: number; release: number }
}

export class SoundEngineSwSeq extends SoundEngine {
  private endTime = 0
  private activeNoteEvents = new Set<MoscNoteTime>()
  private destination: GainNode
  private synth: PolySynth
  private transport: Transport
  private transportEventIds = new Map<number, true>()
  private patch: SynthPatch = {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.01 },
  }

  constructor(transport: Transport) {
    super()
    this.transport = transport
    this.destination = transport.context.createGain()
    this.destination.gain.value = OSC_VOLUME
    this.destination.connect(transport.context.destination)
    this.synth = new PolySynth(new Bank(transport.context), this.destination, {
      oscillator: { type: this.patch.oscillator.type },
      envelope: this.patch.envelope,
    })
  }

  private clearScheduledEvents(): void {
    this.transportEventIds.forEach((_, id) => this.transport.clear(id))
    this.transportEventIds.clear()
  }

  endPosition(): number { return this.endTime }
  async start(): Promise<void> { await this.transport.context.resume() }

  dispose(): void {
    this.clearScheduledEvents()
    this.cutActiveNotes()
  }

  cutActiveNotes(): void {
    this.activeNoteEvents.forEach((note) => this._triggerEvent('note', note, false))
    this.activeNoteEvents.clear()
  }

  setOutputGain(gain: number): void {
    this.destination.gain.value = OSC_VOLUME * gain
  }

  async setScore(scoreTime: MoscScoreTime): Promise<void> {
    this.scoreTime = scoreTime
    this.clearScheduledEvents()
    this.endTime = scoreTime.lengthTime

    scoreTime.sequence.forEach((item) => {
      if (item.type === 'NOTE_TIME') {
        const noteHandle = this.synth.trigger(item.hz)
        const noteStartId = this.transport.scheduleParametric((time) => {
          noteHandle.noteOn(time)
          this.activeNoteEvents.add(item)
          this._triggerEvent('note', item, true)
        }, item.time + 0.1)
        const noteEndId = this.transport.scheduleParametric((time) => {
          noteHandle.noteOff(time)
          this.activeNoteEvents.delete(item)
          this._triggerEvent('note', item, false)
        }, item.timeEnd + 0.1)
        this.transportEventIds.set(noteStartId, true)
        this.transportEventIds.set(noteEndId, true)
      } else if (item.type === 'PARAM_TIME') {
        const paramId = this.transport.scheduleEvent(() => {
          if (isOscParam(item.value)) {
            this.patch.oscillator.type = item.value.osc
          }
          if (isEnvParam(item.value)) {
            this.patch.envelope = {
              attack: item.value.a,
              decay: item.value.d,
              sustain: item.value.s,
              release: item.value.r,
            }
            this.synth.set({
              oscillator: { type: this.patch.oscillator.type },
              envelope: this.patch.envelope,
            })
          }
        }, item.time)
        this.transportEventIds.set(paramId, true)
      } else if (item.type === 'END_TIME') {
        this.endTime = item.time
        const endId = this.transport.scheduleEvent((transport) => {
          if (transport.loop) return
          this.cutActiveNotes()
          this._triggerEvent('end', item.time)
        }, item.time)
        this.transportEventIds.set(endId, true)
      }
    })
  }
}
