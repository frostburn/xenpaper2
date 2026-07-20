import { integrateTempo } from './easing'
import type { EasingName, TempoInterpolationName } from './easing'
export { EASING_NAMES, easingCurve, easingValue, integrateTempo, isEasingName } from './easing'
export type { EasingName, TempoInterpolationName } from './easing'

const velocityMultiplierProp = (
  velocityMultiplier: number | undefined,
): { velocityMultiplier?: number } =>
  velocityMultiplier === undefined || velocityMultiplier === 1 ? {} : { velocityMultiplier }

//
// types
//

export type MoscPitchAutomationPoint = {
  time: number
  hz: number
  pitchInterpolation?: EasingName
}
export type MoscBeatNote = {
  type: 'NOTE_BEAT_TIME'
  time: number
  timeEnd: number
  hz: number
  pitchAutomation?: MoscPitchAutomationPoint[]
  velocityMultiplier?: number
  label: string
}

export type MoscBeatSampleRateNote = {
  type: 'SAMPLE_RATE_NOTE_BEAT_TIME'
  time: number
  timeEnd: number
  velocityMultiplier?: number
  label: string
}

export type MoscNote = {
  type: 'NOTE_TIME'
  time: number
  timeEnd: number
  hz: number
  pitchAutomation?: MoscPitchAutomationPoint[]
  velocityMultiplier?: number
  label: string
}

export type MoscSampleRateNote = {
  type: 'SAMPLE_RATE_NOTE_TIME'
  time: number
  timeEnd: number
  velocityMultiplier?: number
  label: string
}

export type MoscBeatParam = {
  type: 'PARAM_BEAT_TIME'
  time: number
  value: unknown
}

export type MoscParam = {
  type: 'PARAM_TIME'
  time: number
  value: unknown
}

export type MoscTempo = {
  type: 'TEMPO'
  time: number
  bpm: number
  tempoInterpolation: TempoInterpolationName
}

export type MoscBeatEnd = {
  type: 'END_BEAT_TIME'
  time: number
}

export type MoscEnd = {
  type: 'END_TIME'
  time: number
}

export type MoscBeatItem =
  | MoscBeatNote
  | MoscBeatSampleRateNote
  | MoscTempo
  | MoscBeatParam
  | MoscBeatEnd

export type MoscBeatScore = {
  sequence: MoscBeatItem[]
  lengthTime: number
}

export type MoscItem = MoscNote | MoscSampleRateNote | MoscParam | MoscEnd

export type MoscScore = {
  sequence: MoscItem[]
  lengthTime: number
}

//
// utils
//

export const sortByTime = <T extends { time: number }>(items: T[]): T[] => {
  return items.slice().sort((a, b) => a.time - b.time)
}

export const sortByTimeValue = (items: Array<MoscNote>): Array<MoscNote> => {
  return sortByTime(items)
}

//
// beat-time to real-time conversion
//

const tempoTimeToTime = integrateTempo

type TempoChange = {
  bpm: number
  bpmEnd: number
  time: number
  timeEnd: number
  timeValue: number
  tempoInterpolation: EasingName
}

const findTempoRangeForTime = (tempoChanges: TempoChange[], time: number): TempoChange => {
  if (!tempoChanges.length) throw new Error('No tempo changes found.')

  let low = 0
  let high = tempoChanges.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const tempoChange = tempoChanges[middle]!

    if (time < tempoChange.time) {
      high = middle - 1
    } else {
      low = middle + 1
    }
  }

  return tempoChanges[Math.max(0, high)]!
}

export const beatToTime = (items: MoscBeatItem[]): ((time: number) => number) => {
  const tempoChanges: TempoChange[] = []
  tempoChanges.push({
    bpm: 60,
    bpmEnd: 60,
    time: 0,
    timeEnd: 0,
    timeValue: 0,
    tempoInterpolation: 'linear',
  })

  const tempoItems: MoscTempo[] = items.filter(
    (item: MoscBeatItem): item is MoscTempo => item.type === 'TEMPO',
  )

  sortByTime(tempoItems).forEach((tempo: MoscTempo, index: number, all: MoscTempo[]) => {
    const lastChange = tempoChanges[tempoChanges.length - 1] as TempoChange
    const nextTempo: MoscTempo | undefined = all[index + 1]

    const timeValue =
      tempoTimeToTime(
        lastChange.bpm,
        lastChange.bpmEnd,
        tempo.time - lastChange.time,
        lastChange.timeEnd - lastChange.time,
        lastChange.tempoInterpolation,
      ) + lastChange.timeValue
    const tempoInterpolation = nextTempo?.tempoInterpolation ?? 'constant'
    const isRamping = tempoInterpolation !== 'constant'
    const bpmEnd = isRamping && nextTempo ? nextTempo.bpm : tempo.bpm

    tempoChanges.push({
      bpm: tempo.bpm,
      bpmEnd,
      time: tempo.time,
      timeEnd: isRamping && nextTempo ? nextTempo.time : tempo.time,
      timeValue,
      tempoInterpolation: isRamping ? tempoInterpolation : 'linear',
    })
  })

  return (time: number): number => {
    const tempoChange: TempoChange = findTempoRangeForTime(tempoChanges, time)
    return (
      tempoTimeToTime(
        tempoChange.bpm,
        tempoChange.bpmEnd,
        time - tempoChange.time,
        tempoChange.timeEnd - tempoChange.time,
        tempoChange.tempoInterpolation,
      ) + tempoChange.timeValue
    )
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const paramBeatValueToTime = (
  value: unknown,
  beatToTimeValue: (time: number) => number,
): unknown => {
  if (!isRecord(value) || value.type !== 'volume' || !Array.isArray(value.volumeAutomation)) {
    return value
  }

  return {
    ...value,
    volumeAutomation: value.volumeAutomation.map((point) =>
      isRecord(point) && typeof point.time === 'number'
        ? { ...point, time: beatToTimeValue(point.time) }
        : point,
    ),
  }
}

export const scoreToTime = (score: MoscBeatScore): MoscScore => {
  const thisBeatToTime = beatToTime(score.sequence)

  const sequence: MoscItem[] = sortByTime(score.sequence)
    .map((item: MoscBeatItem): MoscItem | undefined => {
      if (item.type === 'NOTE_BEAT_TIME') {
        return {
          type: 'NOTE_TIME',
          hz: item.hz,
          pitchAutomation: item.pitchAutomation?.map((point) => ({
            ...point,
            time: thisBeatToTime(point.time),
          })),
          label: item.label,
          ...velocityMultiplierProp(item.velocityMultiplier),
          time: thisBeatToTime(item.time),
          timeEnd: thisBeatToTime(item.timeEnd),
        }
      }
      if (item.type === 'SAMPLE_RATE_NOTE_BEAT_TIME') {
        return {
          type: 'SAMPLE_RATE_NOTE_TIME',
          label: item.label,
          ...velocityMultiplierProp(item.velocityMultiplier),
          time: thisBeatToTime(item.time),
          timeEnd: thisBeatToTime(item.timeEnd),
        }
      }
      if (item.type === 'PARAM_BEAT_TIME') {
        return {
          type: 'PARAM_TIME',
          value: paramBeatValueToTime(item.value, thisBeatToTime),
          time: thisBeatToTime(item.time),
        }
      }
      if (item.type === 'END_BEAT_TIME') {
        return {
          type: 'END_TIME',
          time: thisBeatToTime(item.time),
        }
      }
      return undefined
    })
    .filter((item): item is MoscItem => !!item)

  return {
    sequence,
    lengthTime: thisBeatToTime(score.lengthTime),
  }
}

//
// soud engine base class
//

type SoundEngineEndEventCallback = (time?: number) => void
type SoundEngineNoteEventCallback = (note: MoscNote, on: boolean) => void
type SoundEngineEventCallbackCancel = () => void

export class SoundEngine {
  score?: MoscScore

  endPosition(): number {
    return 0
  }

  cutActiveNotes(_time?: number): void {}

  setScore(_score: MoscScore): void {}

  setOutputGain(_gain: number): void {}

  dispose(): void {}

  // events

  events = {
    end: new Set<SoundEngineEndEventCallback>(),
    note: new Set<SoundEngineNoteEventCallback>(),
  }

  _triggerEvent(type: 'end', time?: number): void
  _triggerEvent(type: 'note', note: MoscNote, on: boolean): void
  _triggerEvent(type: 'end' | 'note', note?: number | MoscNote, on?: boolean): void {
    if (type === 'end') {
      this.events.end.forEach((cb) => cb(note as number))
      return
    }

    if (!note || typeof on !== 'boolean') {
      throw new Error('Note event requires a note and on/off state.')
    }

    this.events.note.forEach((cb) => cb(note as MoscNote, on))
  }

  onEnd(callback: SoundEngineEndEventCallback): SoundEngineEventCallbackCancel {
    this.events.end.add(callback)
    return () => {
      this.events.end.delete(callback)
    }
  }

  onNote(callback: SoundEngineNoteEventCallback): SoundEngineEventCallbackCancel {
    this.events.note.add(callback)
    return () => {
      this.events.note.delete(callback)
    }
  }
}
