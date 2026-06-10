import type { MoscScore, MoscNote } from '../mosc'
import { SoundEngine } from '../mosc'
import * as Tone from 'tone'
import type { PolySynth, Synth, SynthOptions, ToneOscillatorType } from 'tone'

//
// utils
//

function flatMap<I, O>(arr: readonly I[], mapper: (item: I) => O[]): O[] {
  const out: O[] = []
  arr.forEach((item) => out.push(...mapper(item)))
  return out
}

//
// consts
//

const OSC_VOLUME = -18

type SoundEngineBaseOscillatorType = Exclude<ToneOscillatorType, 'custom'>
type SoundEngineOscillatorType =
  | SoundEngineBaseOscillatorType
  | `fm${SoundEngineBaseOscillatorType}`
  | `am${SoundEngineBaseOscillatorType}`
  | `fat${SoundEngineBaseOscillatorType}`

type SoundEngineOscParam = {
  type: 'osc'
  osc: SoundEngineOscillatorType
}

type SoundEngineEnvParam = {
  type: 'env'
  a: number
  d: number
  s: number
  r: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isToneOscillatorType = (value: string): value is SoundEngineOscillatorType => {
  return (OSC_TYPES as readonly string[]).includes(value)
}

const isOscParam = (value: unknown): value is SoundEngineOscParam => {
  return (
    isRecord(value) &&
    value.type === 'osc' &&
    typeof value.osc === 'string' &&
    isToneOscillatorType(value.osc)
  )
}

const isEnvParam = (value: unknown): value is SoundEngineEnvParam => {
  return (
    isRecord(value) &&
    value.type === 'env' &&
    typeof value.a === 'number' &&
    typeof value.d === 'number' &&
    typeof value.s === 'number' &&
    typeof value.r === 'number'
  )
}

export const OSC_BASE_TYPES = ['sine', 'sawtooth', 'square', 'triangle'] as const

export const OSC_PARTIAL_SUFFIXES: string[] = []
for (let i = 1; i < 33; i++) {
  OSC_PARTIAL_SUFFIXES.push(`${i}`)
}

export const OSC_TYPES_EXPANDED = flatMap(OSC_BASE_TYPES, (base) => [
  base,
  `fm${base}`,
  `am${base}`,
  `fat${base}`,
])

export const OSC_TYPES = flatMap(OSC_TYPES_EXPANDED, (type) => [
  type,
  ...OSC_PARTIAL_SUFFIXES.map((suffix) => `${type}${suffix}`),
]) as SoundEngineOscillatorType[]

export class SoundEngineTonejs extends SoundEngine {
  _started = false
  _endTime = 0
  _activeNoteEvents = new Set<MoscNote>()
  _transportEventIds: number[] = []

  _synth: PolySynth<Synth> | undefined

  _clearScheduledEvents(): void {
    this._transportEventIds.forEach((id) => Tone.Transport.clear(id))
    this._transportEventIds = []
  }

  _releaseActiveNotes(time?: number): void {
    this.getSynth().releaseAll(time)
    this._clearActiveNoteEvents()
  }

  _releaseActiveNotesIfSynthExists(time?: number): void {
    this._synth?.releaseAll(time)
    this._clearActiveNoteEvents()
  }

  _clearActiveNoteEvents(): void {
    this._activeNoteEvents.forEach((noteTime) => {
      this._triggerEvent('note', noteTime, false)
    })
    this._activeNoteEvents.clear()
  }

  getSynth(): PolySynth<Synth> {
    this._synth ??= new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine',
        volume: OSC_VOLUME,
      },
      envelope: {
        attack: 0.01,
        sustain: 0.5,
        decay: 0.25,
        release: 0.5,
      },
    }).toDestination()

    return this._synth
  }

  endPosition(): number {
    return this._endTime
  }

  async start(): Promise<void> {
    if (!this._started) {
      await Tone.start()
      this.getSynth()
      this._started = true
    }
  }

  dispose(): void {
    this._clearScheduledEvents()
    this._releaseActiveNotesIfSynthExists()
    this._synth?.dispose()
    this._synth = undefined
    this._started = false
  }

  cutActiveNotes(time?: number): void {
    this._releaseActiveNotesIfSynthExists(time)
  }

  setOutputGain(gain: number): void {
    this.getSynth().volume.value = gain <= 0 ? -Infinity : 20 * Math.log10(gain)
  }

  setScore(score: MoscScore): void {
    this.score = score

    // clear this engine's previous notes from tone transport without
    // disturbing other score engines that share the same transport clock
    this._clearScheduledEvents()
    this._endTime = score.lengthTime
    this._releaseActiveNotesIfSynthExists()

    // add all new notes to tone transport
    this.score.sequence.forEach((item): void => {
      if (item.type === 'NOTE_TIME') {
        const noteTime = item
        const noteStartEventId = Tone.Transport.schedule((time: number) => {
          this.getSynth().triggerAttackRelease(noteTime.hz, noteTime.timeEnd - noteTime.time, time)
          this._activeNoteEvents.add(noteTime)
          this._triggerEvent('note', noteTime, true)
        }, noteTime.time + 0.1) // schedule in the future slightly to avoid double note playing at end

        const noteEndEventId = Tone.Transport.schedule(() => {
          this._activeNoteEvents.delete(noteTime)
          this._triggerEvent('note', noteTime, false)
        }, noteTime.timeEnd + 0.1)

        this._transportEventIds.push(noteStartEventId, noteEndEventId)

        return
      }

      if (item.type === 'PARAM_TIME') {
        const paramTime = item
        const paramEventId = Tone.Transport.schedule(() => {
          // this is inaccurate
          // as tonejs calls these callbacks several ms ahead of schedule
          // and relies on scheduled events to pass the provided time
          // to schedule correctly, but param changes cannot accept
          // the time argument
          if (isOscParam(paramTime.value)) {
            this.getSynth().set({
              oscillator: {
                type: paramTime.value.osc,
                volume: OSC_VOLUME,
              } as Partial<SynthOptions['oscillator']>,
            })
          }
          if (isEnvParam(paramTime.value)) {
            this.getSynth().set({
              envelope: {
                attack: paramTime.value.a,
                decay: paramTime.value.d,
                sustain: paramTime.value.s,
                release: paramTime.value.r,
              },
            })
          }
        }, paramTime.time)

        this._transportEventIds.push(paramEventId)

        return
      }

      if (item.type === 'END_TIME') {
        this._endTime = item.time

        const endEventId = Tone.Transport.schedule((time?: number) => {
          if (Tone.Transport.loop) return

          this._releaseActiveNotes(time)
          this._triggerEvent('end', time)
        }, this._endTime)

        this._transportEventIds.push(endEventId)

        return
      }
    })
  }
}
