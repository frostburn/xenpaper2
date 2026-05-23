import type { MoscScoreMs, MoscNoteMs } from '../mosc'
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
  _endMs = 0
  _activeNoteEvents = new Set<MoscNoteMs>()
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
    this._activeNoteEvents.forEach((noteMs) => {
      this._triggerEvent('note', noteMs, false)
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
    return this._endMs
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

  async play(): Promise<void> {
    await this.start()
    Tone.Transport.start()
  }

  async pause(time?: number): Promise<void> {
    Tone.Transport.pause(time)
    this._releaseActiveNotesIfSynthExists(time)
  }

  stopSilently(time?: number): void {
    Tone.Transport.pause(time)
    this._releaseActiveNotesIfSynthExists(time)
    this._clearScheduledEvents()
  }

  async gotoMs(ms: number): Promise<void> {
    Tone.Transport.seconds = ms * 0.001
  }

  setOutputGain(gain: number): void {
    this.getSynth().volume.value = gain <= 0 ? -Infinity : 20 * Math.log10(gain)
  }

  async setScore(scoreMs: MoscScoreMs): Promise<void> {
    this.scoreMs = scoreMs

    // clear this engine's previous notes from tone transport without
    // disturbing other score engines that share the same transport clock
    this._clearScheduledEvents()
    this._endMs = scoreMs.lengthMs
    this._releaseActiveNotesIfSynthExists()

    // add all new notes to tone transport
    this.scoreMs.sequence.forEach((item): void => {
      if (item.type === 'NOTE_MS') {
        const noteMs = item
        const noteStartEventId = Tone.Transport.schedule(
          (time: number) => {
            this.getSynth().triggerAttackRelease(
              noteMs.hz,
              noteMs.msEnd * 0.001 - noteMs.ms * 0.001,
              time,
            )
            this._activeNoteEvents.add(noteMs)
            this._triggerEvent('note', noteMs, true)
          },
          noteMs.ms * 0.001 + 0.1,
        ) // schedule in the future slightly to avoid double note playing at end

        const noteEndEventId = Tone.Transport.schedule(
          () => {
            this._activeNoteEvents.delete(noteMs)
            this._triggerEvent('note', noteMs, false)
          },
          noteMs.msEnd * 0.001 + 0.1,
        )

        this._transportEventIds.push(noteStartEventId, noteEndEventId)

        return
      }

      if (item.type === 'PARAM_MS') {
        const paramMs = item
        const paramEventId = Tone.Transport.schedule(() => {
          // this is inaccurate
          // as tonejs calls these callbacks several ms ahead of schedule
          // and relies on scheduled events to pass the provided time
          // to schedule correctly, but param changes cannot accept
          // the time argument
          if (isOscParam(paramMs.value)) {
            this.getSynth().set({
              oscillator: {
                type: paramMs.value.osc,
                volume: OSC_VOLUME,
              } as Partial<SynthOptions['oscillator']>,
            })
          }
          if (isEnvParam(paramMs.value)) {
            this.getSynth().set({
              envelope: {
                attack: paramMs.value.a,
                decay: paramMs.value.d,
                sustain: paramMs.value.s,
                release: paramMs.value.r,
              },
            })
          }
        }, paramMs.ms * 0.001)

        this._transportEventIds.push(paramEventId)

        return
      }

      if (item.type === 'END_MS') {
        this._endMs = item.ms

        const endEventId = Tone.Transport.schedule((time?: number) => {
          if (Tone.Transport.loop) return

          this._releaseActiveNotes(time)
          this._triggerEvent('end', time)
        }, this._endMs * 0.001)

        this._transportEventIds.push(endEventId)

        return
      }
    })
  }
}
