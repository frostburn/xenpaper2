import type { MoscNote, MoscScore } from '../mosc'
import { SoundEngine } from '../mosc'
import type { Bank } from '../sw-seq/bank'
import { isNoiseGeneratorType, type NoiseGeneratorType } from '../sw-seq/noise-worklet'
import {
  PolySynth,
  type NoiseSynthType,
  type SynthType,
  WHITE_NOISE_SYNTH_TYPE,
  type SynthParams,
} from '../sw-seq/polysynth'
import { isSWOscillatorType, parseSWOscillatorType, type SWOscillatorType } from '../sw-seq/timbre'
import type { Transport } from '../sw-seq/transport'

const OSC_VOLUME = 0.275
const VOLUME_TIME_CONSTANT = 0.001

type SoundEngineOscParam = { type: 'osc'; osc: SWOscillatorType }
type SoundEngineNoiseParam = { type: 'noise'; noise: string }
type SoundEngineEnvParam = { type: 'env'; a: number; d: number; s: number; r: number }
type SoundEngineVolumeParam = { type: 'volume'; db: number }
type SoundEngineVelocityParam = { type: 'velocity'; velocity: number }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isOscParam = (value: unknown): value is SoundEngineOscParam =>
  isRecord(value) && value.type === 'osc'

const isNoiseParam = (value: unknown): value is SoundEngineNoiseParam =>
  isRecord(value) && value.type === 'noise' && typeof value.noise === 'string'

const createNoiseSynthType = (noise: NoiseGeneratorType): NoiseSynthType => ({
  ...WHITE_NOISE_SYNTH_TYPE,
  noise,
})

const isEnvParam = (value: unknown): value is SoundEngineEnvParam =>
  isRecord(value) &&
  value.type === 'env' &&
  typeof value.a === 'number' &&
  typeof value.d === 'number' &&
  typeof value.s === 'number' &&
  typeof value.r === 'number'

const isVolumeParam = (value: unknown): value is SoundEngineVolumeParam =>
  isRecord(value) && value.type === 'volume' && typeof value.db === 'number'

const isVelocityParam = (value: unknown): value is SoundEngineVelocityParam =>
  isRecord(value) && value.type === 'velocity' && typeof value.velocity === 'number'

const dbToGain = (db: number): number => Math.pow(10, db / 20)

export type SoundEngineSwSeqOptions = {
  noteFilter?: (synth: SynthType) => boolean
}

export class SoundEngineSwSeq extends SoundEngine {
  private endTime = 0
  private activeNoteEvents = new Set<MoscNote>()
  private noteOffs: Array<(time: number) => void> = []
  private destination: GainNode
  private outputGain = 1
  private scoreVolume = 1
  private synth: PolySynth
  private transport: Transport
  private noteFilter: (synth: SynthType) => boolean
  private transportEventIds = new Map<number, true>()

  constructor(transport: Transport, bank: Bank, options: SoundEngineSwSeqOptions = {}) {
    super()
    this.transport = transport
    this.noteFilter = options.noteFilter ?? (() => true)
    this.destination = transport.context.createGain()
    this.destination.gain.setValueAtTime(1, transport.context.currentTime)
    this.destination.connect(transport.context.destination)
    this.synth = new PolySynth(bank, this.destination)
  }

  get context() {
    return this.transport.context
  }

  clearScheduledEvents(): void {
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

  private applyOutputGain(time = this.context.currentTime): void {
    this.destination.gain.setTargetAtTime(
      this.outputGain * this.scoreVolume,
      time,
      VOLUME_TIME_CONSTANT,
    )
  }

  setOutputGain(gain: number): void {
    this.outputGain = gain
    this.applyOutputGain()
  }

  setScore(score: MoscScore): void {
    this.score = score
    this.clearScheduledEvents()
    this.endTime = score.lengthTime

    const patch: SynthParams = {
      frequency: 440,
      velocity: OSC_VOLUME,
      synth: {
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

    this.scoreVolume = 1
    this.applyOutputGain()

    score.sequence.forEach((item) => {
      if (item.type === 'NOTE_TIME' || item.type === 'SAMPLE_RATE_NOTE_TIME') {
        const note: MoscNote =
          item.type === 'SAMPLE_RATE_NOTE_TIME'
            ? { ...item, type: 'NOTE_TIME', hz: this.context.sampleRate }
            : item
        patch.frequency = note.hz
        if (!this.noteFilter(patch.synth)) return

        const noteHandle = this.synth.trigger(patch)
        const noteEventId = this.transport.scheduleParametricNote({
          noteOn: (time) => {
            noteHandle.noteOn(time)
            this.activeNoteEvents.add(note)
            this._triggerEvent('note', note, true)
          },
          noteOff: (time) => {
            noteHandle.noteOff(time)
            this.activeNoteEvents.delete(note)
            this._triggerEvent('note', note, false)
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
            patch.synth = parseSWOscillatorType(item.value.osc, this.context)
          else throw new Error(`"${item.value.osc}" is not a valid oscillator type.`)
        }
        if (isNoiseParam(item.value)) {
          if (!isNoiseGeneratorType(item.value.noise))
            throw new Error(`"${item.value.noise}" is not a valid noise generator.`)
          patch.synth = createNoiseSynthType(item.value.noise)
        }
        if (isEnvParam(item.value)) {
          patch.envelope = {
            attack: item.value.a,
            decay: item.value.d,
            sustain: item.value.s,
            release: item.value.r,
          }
        }
        if (isVolumeParam(item.value)) {
          const { db } = item.value
          const volumeEventId = this.transport.scheduleParametric((time) => {
            this.scoreVolume = dbToGain(db)
            this.applyOutputGain(time)
          }, item.time)
          this.transportEventIds.set(volumeEventId, true)
        }
        if (isVelocityParam(item.value)) {
          patch.velocity = OSC_VOLUME * item.value.velocity
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
