import type { EasingName, MoscNote, MoscScore } from '../mosc'
import { SoundEngine } from '../mosc'
import type { Bank } from '../sw-seq/bank'
import {
  isNoiseGeneratorType,
  isNoiseInterpolationType,
  type NoiseGeneratorType,
  type NoiseInterpolationType,
} from '../sw-seq/noise-worklet'
import {
  PolySynth,
  type NoiseSynthType,
  WHITE_NOISE_SYNTH_TYPE,
  type SynthParams,
} from '../sw-seq/polysynth'
import { isSWOscillatorType, parseSWOscillatorType, type SWOscillatorType } from '../sw-seq/timbre'
import { easingCurve } from '../mosc/easing'
import type { Transport } from '../sw-seq/transport'

const OSC_VOLUME = 0.275
const VOLUME_TIME_CONSTANT = 0.001

type SoundEngineOscParam = { type: 'osc'; osc: SWOscillatorType }
type SoundEngineNoiseParam = { type: 'noise'; noise: string; interpolation: string }
type SoundEngineEnvParam = { type: 'env'; a: number; d: number; s: number; r: number }
type SoundEngineVolumeAutomationPoint = {
  time: number
  db: number
  volumeInterpolation?: EasingName
}
type SoundEngineVolumeParam = {
  type: 'volume'
  db: number
  volumeAutomation?: SoundEngineVolumeAutomationPoint[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isOscParam = (value: unknown): value is SoundEngineOscParam =>
  isRecord(value) && value.type === 'osc'

const isNoiseParam = (value: unknown): value is SoundEngineNoiseParam =>
  isRecord(value) &&
  value.type === 'noise' &&
  typeof value.noise === 'string' &&
  typeof value.interpolation === 'string'

const createNoiseSynthType = (
  noise: NoiseGeneratorType,
  interpolation: NoiseInterpolationType,
): NoiseSynthType => ({
  ...WHITE_NOISE_SYNTH_TYPE,
  noise,
  interpolation,
})

const isEnvParam = (value: unknown): value is SoundEngineEnvParam =>
  isRecord(value) &&
  value.type === 'env' &&
  typeof value.a === 'number' &&
  typeof value.d === 'number' &&
  typeof value.s === 'number' &&
  typeof value.r === 'number'

const isVolumeAutomationPoint = (value: unknown): value is SoundEngineVolumeAutomationPoint =>
  isRecord(value) && typeof value.time === 'number' && typeof value.db === 'number'

const isVolumeParam = (value: unknown): value is SoundEngineVolumeParam =>
  isRecord(value) &&
  value.type === 'volume' &&
  typeof value.db === 'number' &&
  (value.volumeAutomation === undefined ||
    (Array.isArray(value.volumeAutomation) &&
      value.volumeAutomation.every(isVolumeAutomationPoint)))

const dbToGain = (db: number): number => Math.pow(10, db / 20)

const linearDbCurve = (db0: number, db1: number): Float32Array => {
  const values = new Float32Array(16)
  for (let index = 0; index < values.length; index += 1) {
    const progress = index / (values.length - 1)
    values[index] = db0 + (db1 - db0) * progress
  }
  return values
}

const volumeCurve = (startDb: number, endDb: number, interpolation: EasingName): Float32Array =>
  interpolation === 'linear'
    ? linearDbCurve(startDb, endDb)
    : easingCurve(interpolation, startDb, endDb)

export class SoundEngineSwSeq extends SoundEngine {
  private endTime = 0
  private activeNoteEvents = new Set<MoscNote>()
  private noteOffs: Array<(time: number) => void> = []
  private destination: GainNode
  private outputGain = 1
  private scoreVolume = 1
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

  clearScheduledEvents(): void {
    this.cancelScheduledOutputGain()
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
    this.cancelScheduledOutputGain()
    this.activeNoteEvents.forEach((note) => this._triggerEvent('note', note, false))
    this.activeNoteEvents.clear()
    for (const callback of this.noteOffs) {
      // Just release, scheduling be damned
      callback(this.context.currentTime)
    }
  }

  private cancelScheduledOutputGain(time = this.context.currentTime): void {
    this.destination.gain.cancelScheduledValues(time)
    this.destination.gain.setValueAtTime(this.outputGain * this.scoreVolume, time)
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
        patch.duration = item.timeEnd - item.time
        patch.pitchAutomation = note.pitchAutomation?.map((point) => ({
          ...point,
          time: point.time - note.time,
        }))
        const noteHandle = this.synth.trigger({
          ...patch,
          velocity: OSC_VOLUME * note.velocity,
        })
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
          if (!isNoiseInterpolationType(item.value.interpolation))
            throw new Error(
              `"${item.value.interpolation}" is not a valid noise interpolation type.`,
            )
          patch.synth = createNoiseSynthType(item.value.noise, item.value.interpolation)
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
          const { db, volumeAutomation } = item.value
          const volumeEventId = this.transport.scheduleParametric((time) => {
            this.scoreVolume = dbToGain(db)
            if (volumeAutomation?.length) {
              this.destination.gain.cancelScheduledValues(time)
              this.destination.gain.setValueAtTime(this.outputGain * this.scoreVolume, time)
            } else {
              this.applyOutputGain(time)
            }

            let startDb = db
            let startTime = item.time
            volumeAutomation?.forEach((point) => {
              const duration = point.time - startTime
              if (duration <= 0) {
                this.scoreVolume = dbToGain(point.db)
                this.applyOutputGain(time)
                startDb = point.db
                startTime = point.time
                return
              }

              const curve = volumeCurve(startDb, point.db, point.volumeInterpolation ?? 'linear')
              const gainCurve = Float32Array.from(
                curve,
                (curveDb) => this.outputGain * dbToGain(curveDb),
              )
              this.destination.gain.setValueCurveAtTime(
                gainCurve,
                time + startTime - item.time,
                duration,
              )
              this.scoreVolume = dbToGain(point.db)
              startDb = point.db
              startTime = point.time
            })
          }, item.time)
          this.transportEventIds.set(volumeEventId, true)
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
