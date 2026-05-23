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

export class SwSeqTransportController {
  readonly context = new AudioContext()
  readonly transport = new Transport(this.context)
  seconds = 0
  loop = false
  loopStart = 0
  loopEnd = 0
  state: 'started' | 'stopped' = 'stopped'

  start() {
    this.transport.start()
    this.state = 'started'
  }

  pause() {
    this.transport.stop()
    this.state = 'stopped'
  }
}

export const swSeqTransport = new SwSeqTransportController()

export class SoundEngineSwSeq extends SoundEngine {
  _endTime = 0
  _activeNoteEvents = new Set<MoscNoteTime>()
  _synth: PolySynth
  _destination: GainNode
  _oscType: OscillatorType = 'sine'
  _transportEventIds: number[] = []

  constructor() {
    super()
    this._destination = swSeqTransport.context.createGain()
    this._destination.gain.value = OSC_VOLUME
    this._destination.connect(swSeqTransport.context.destination)
    this._synth = new PolySynth(new Bank(swSeqTransport.context), this._destination)
  }

  _clearScheduledEvents(): void {
    this._transportEventIds.forEach((id) => swSeqTransport.transport.clear(id))
    this._transportEventIds = []
  }

  endPosition(): number {
    return this._endTime
  }

  async start(): Promise<void> {
    await swSeqTransport.context.resume()
  }

  dispose(): void {
    this._clearScheduledEvents()
    this.cutActiveNotes()
  }

  cutActiveNotes(): void {
    this._activeNoteEvents.forEach((note) => this._triggerEvent('note', note, false))
    this._activeNoteEvents.clear()
  }

  setOutputGain(gain: number): void {
    this._destination.gain.value = OSC_VOLUME * gain
  }

  async setScore(scoreTime: MoscScoreTime): Promise<void> {
    this.scoreTime = scoreTime
    this._clearScheduledEvents()
    this._endTime = scoreTime.lengthTime

    scoreTime.sequence.forEach((item) => {
      if (item.type === 'NOTE_TIME') {
        const noteHandle = this._synth.trigger(item.hz, this._oscType)
        const noteStartId = swSeqTransport.transport.scheduleParametric((time) => {
          noteHandle.noteOn(time)
          this._activeNoteEvents.add(item)
          this._triggerEvent('note', item, true)
        }, item.time + 0.1)

        const noteEndId = swSeqTransport.transport.scheduleParametric((time) => {
          noteHandle.noteOff(time)
          this._activeNoteEvents.delete(item)
          this._triggerEvent('note', item, false)
        }, item.timeEnd + 0.1)

        this._transportEventIds.push(noteStartId, noteEndId)
      } else if (item.type === 'PARAM_TIME') {
        const paramId = swSeqTransport.transport.scheduleEvent(() => {
          if (isOscParam(item.value)) this._oscType = item.value.osc
          if (isEnvParam(item.value)) {
            this._synth.attackTime = item.value.a
            this._synth.decayTime = item.value.d
            this._synth.sustainLevel = item.value.s
            this._synth.releaseTime = item.value.r
          }
        }, item.time)

        this._transportEventIds.push(paramId)
      } else if (item.type === 'END_TIME') {
        this._endTime = item.time
        const endId = swSeqTransport.transport.scheduleEvent(() => {
          if (swSeqTransport.loop) return
          this.cutActiveNotes()
          this._triggerEvent('end', item.time)
        }, item.time)

        this._transportEventIds.push(endId)
      }
    })
  }
}
