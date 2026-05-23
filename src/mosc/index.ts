//
// types
//

export type MoscNote = {
  type: 'NOTE_TIME'
  time: number
  timeEnd: number
  hz: number
  label: string
}

export type MoscNoteTime = {
  type: 'NOTE_TIME_VALUE'
  time: number
  timeEnd: number
  hz: number
  label: string
}

export type MoscParam = {
  type: 'PARAM_TIME'
  time: number
  value: unknown
}

export type MoscParamTime = {
  type: 'PARAM_TIME_VALUE'
  time: number
  value: unknown
}

export type MoscTempo = {
  type: 'TEMPO'
  time: number
  bpm: number
  lerp: boolean
}

export type MoscEnd = {
  type: 'END_TIME'
  time: number
}

export type MoscEndTime = {
  type: 'END_TIME_VALUE'
  time: number
}

export type MoscItem = MoscNote | MoscTempo | MoscParam | MoscEnd

export type MoscScore = {
  sequence: MoscItem[]
  lengthTime: number
}

export type MoscItemTime = MoscNoteTime | MoscParamTime | MoscEndTime

export type MoscScoreTime = {
  sequence: MoscItemTime[]
  lengthTime: number
}

//
// utils
//

export const centsToRatio = (cents: number, octave: number = 0): number => {
  return octaveDivisionToRatio(cents, 1200, 2, octave)
}

export const octaveDivisionToRatio = (
  steps: number,
  stepsInOctave: number,
  octaveSize: number,
  octave: number = 0,
): number => {
  return Math.pow(octaveSize, (steps + octave * stepsInOctave) / stepsInOctave)
}

export const ratioToCents = (ratio: number, octave: number = 0): number => {
  return ratioToOctaveDivision(ratio, 1200, 2, octave)
}

export const ratioToOctaveDivision = (
  ratio: number,
  stepsInOctave: number,
  octaveSize: number,
  octave: number = 0,
): number => {
  return (Math.log(ratio) / Math.log(octaveSize)) * stepsInOctave - octave * stepsInOctave
}

export const sortByTime = <T extends { time: number }>(items: T[]): T[] => {
  return items.slice().sort((a, b) => {
    if (a.time < b.time) return -1
    if (a.time > b.time) return 1
    return 0
  })
}

export const sortByTimeValue = (items: Array<MoscNoteTime>): Array<MoscNoteTime> => {
  return items.slice().sort((a, b) => {
    if (a.time < b.time) return -1
    if (a.time > b.time) return 1
    return 0
  })
}

//
// beat-time to real-time conversion
//

const tempoTimeToTime = (bpm1: number, bpm2: number, duration: number): number => {
  const u = bpm1 / 60
  const v = bpm2 / 60
  const s = duration
  if (u === v) return s / v
  return (2 * s * (v - u)) / (v * v - u * u)
}

type TempoChange = {
  bpm: number
  bpmEnd: number
  time: number
  timeValue: number
}

const findTempoRangeForTime = (tempoChanges: TempoChange[], time: number): TempoChange => {
  for (let i = tempoChanges.length - 1; i >= 0; i--) {
    if (time >= tempoChanges[i]!.time) {
      return tempoChanges[i]!
    }
  }
  if (tempoChanges.length) {
    return tempoChanges[0]!
  }
  throw new Error('No tempo changes found.')
}

export const timeToTime = (items: MoscItem[]): ((time: number) => number) => {
  const tempoChanges: TempoChange[] = []
  tempoChanges.push({
    bpm: 60,
    bpmEnd: 60,
    time: 0,
    timeValue: 0,
  })

  const tempoItems: MoscTempo[] = items.filter(
    (item: MoscItem): item is MoscTempo => item.type === 'TEMPO',
  )

  sortByTime(tempoItems).forEach((tempo: MoscTempo, index: number, all: MoscTempo[]) => {
    const lastChange = tempoChanges[tempoChanges.length - 1] as TempoChange
    const nextTempo: MoscTempo | undefined = all[index + 1]

    const timeValue =
      tempoTimeToTime(lastChange.bpm, lastChange.bpmEnd, tempo.time - lastChange.time) +
      lastChange.timeValue
    const bpmEnd = nextTempo && nextTempo.lerp ? nextTempo.bpm : tempo.bpm

    tempoChanges.push({
      bpm: tempo.bpm,
      bpmEnd,
      time: tempo.time,
      timeValue,
    })
  })

  return (time: number): number => {
    const tempoChange: TempoChange = findTempoRangeForTime(tempoChanges, time)
    return (
      tempoTimeToTime(tempoChange.bpm, tempoChange.bpmEnd, time - tempoChange.time) +
      tempoChange.timeValue
    )
  }
}

export const scoreToTime = (score: MoscScore): MoscScoreTime => {
  const thisTimeToTime = timeToTime(score.sequence)

  const sequence: MoscItemTime[] = sortByTime(score.sequence)
    .map((item: MoscItem): MoscItemTime | undefined => {
      if (item.type === 'NOTE_TIME') {
        const note = item as MoscNote
        return {
          type: 'NOTE_TIME_VALUE',
          hz: note.hz,
          label: note.label,
          time: thisTimeToTime(note.time),
          timeEnd: thisTimeToTime(note.timeEnd),
        }
      }
      if (item.type === 'PARAM_TIME') {
        const param = item as MoscParam
        return {
          type: 'PARAM_TIME_VALUE',
          value: param.value,
          time: thisTimeToTime(param.time),
        }
      }
      if (item.type === 'END_TIME') {
        const end = item as MoscEnd
        return {
          type: 'END_TIME_VALUE',
          time: thisTimeToTime(end.time),
        }
      }
      return undefined
    })
    .filter((item): item is MoscItemTime => !!item)

  return {
    sequence,
    lengthTime: thisTimeToTime(score.lengthTime),
  }
}

//
// soud engine base class
//

type SoundEngineEndEventCallback = (time?: number) => void
type SoundEngineNoteEventCallback = (noteTime: MoscNoteTime, on: boolean) => void
type SoundEngineEventCallbackCancel = () => void

export class SoundEngine {
  scoreTime?: MoscScoreTime

  endPosition(): number {
    return 0
  }

  cutActiveNotes(_time?: number): void {}

  async setScore(_scoreTime: MoscScoreTime): Promise<void> {}

  setOutputGain(_gain: number): void {}

  dispose(): void {}

  // events

  events = {
    end: new Set<SoundEngineEndEventCallback>(),
    note: new Set<SoundEngineNoteEventCallback>(),
  }

  _triggerEvent(type: 'end', time?: number): void
  _triggerEvent(type: 'note', noteTime: MoscNoteTime, on: boolean): void
  _triggerEvent(type: 'end' | 'note', noteTime?: number | MoscNoteTime, on?: boolean): void {
    if (type === 'end') {
      this.events.end.forEach((cb) => cb(noteTime as number))
      return
    }

    if (!noteTime || typeof on !== 'boolean') {
      throw new Error('Note event requires a note and on/off state.')
    }

    this.events.note.forEach((cb) => cb(noteTime as MoscNoteTime, on))
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
