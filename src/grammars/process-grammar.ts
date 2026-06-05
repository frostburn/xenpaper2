import { mmod, geoMod } from 'xen-dev-utils/fraction'
import { centsToValue, equaveDivisionToValue, valueToCents } from 'xen-dev-utils/conversion'

import type {
  XenpaperAST,
  SetScaleType,
  NoteType,
  ChordType,
  RatioChordType,
  TailType,
  PitchType,
  PitchDegreeType,
  RatioChordPitchType,
  SetterType,
  DelimiterType,
} from './grammar.generated'

import type {
  MoscBeatScore,
  MoscBeatItem,
  MoscBeatNote,
  MoscTempo,
  MoscBeatParam,
  MoscBeatEnd,
  MoscNote,
} from '../mosc'

import { beatToTime } from '../mosc'

//
// utils
//

const assertFinitePositive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number, got ${value}`)
  }
}

const limit = (name: string, value: number, min: number, max: number): void => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}, got ${value}`)
  }
}

//
// pitch math
//

export const pitchToRatio = (pitch: PitchType, context: Context): number => {
  const { scale, octaveSize } = context
  assertFinitePositive('context.octaveSize', octaveSize)
  limit('Equave size', octaveSize, -20, 20)

  const { type } = pitch.value
  const octaveMulti = Math.pow(octaveSize, pitch.octave?.octave ?? 0)

  if (type === 'PitchRatio') {
    const { numerator, denominator } = pitch.value
    assertFinitePositive('PitchRatio.denominator', denominator)
    const ratio = numerator / denominator
    limit('Pitch ratio', ratio, 0, 100)
    return ratio * octaveMulti
  }

  if (type === 'PitchCents') {
    const { cents } = pitch.value
    limit('Cents', cents, -12000, 12000)
    return centsToValue(cents) * octaveMulti
  }

  if (type === 'PitchOctaveDivision') {
    const { numerator, denominator, octaveSize } = pitch.value
    assertFinitePositive('PitchOctaveDivision.denominator', denominator)
    assertFinitePositive('PitchOctaveDivision.octaveSize', octaveSize)
    return equaveDivisionToValue(numerator, denominator, octaveSize) * octaveMulti
  }

  if (type === 'PitchDegree') {
    const { degree } = pitch.value
    return pitchDegreeToRatio(degree, scale, octaveSize) * octaveMulti
  }

  throw new Error(`Unknown pitch type "${type}"`)
}

const edoToRatios = (edoSize: number, octaveSize: number): number[] => {
  const ratios: number[] = []
  for (let i = 0; i < edoSize; i++) {
    ratios.push(equaveDivisionToValue(i, edoSize, octaveSize))
  }
  return ratios
}

const pitchDegreeWrap = (degree: number, scale: number[]): [number, number] => {
  limit('Scale degree', degree, -1000, 1000)

  const steps = mmod(degree, scale.length)

  return [steps, (degree - steps) / scale.length]
}

const pitchDegreeToRatio = (degree: number, scale: number[], octaveSize: number): number => {
  assertFinitePositive('context.octaveSize', octaveSize)
  limit('Equave size', octaveSize, -20, 20)

  if (scale.length === 0) {
    return 1
  }

  const [wrappedDegree, octave] = pitchDegreeWrap(degree, scale)
  return scale[wrappedDegree]! * Math.pow(octaveSize, octave)
}

const pitchToHz = (pitch: PitchType, context: Context): number => {
  if (pitch.value.type === 'PitchHz') {
    assertFinitePositive('PitchHz.hz', pitch.value.hz)
    assertFinitePositive('context.octaveSize', context.octaveSize)
    const octaveMulti = Math.pow(context.octaveSize, pitch.octave?.octave ?? 0)
    const hz = pitch.value.hz * octaveMulti
    assertFinitePositive('Hz', hz)
    limit('Hz', hz, 0, 20000)
    return hz
  }
  return pitchToRatio(pitch, context) * context.rootHz
}

const tailToTime = (
  tail: TailType | undefined,
  context: Context,
): { time: number; timeEnd: number } => {
  const time = context.time

  const duration = tail?.type === 'Hold' ? tail.length + 1 : 1

  assertFinitePositive('context.subdivision', context.subdivision)
  context.time += duration * context.subdivision
  const timeEnd = context.time

  return {
    time,
    timeEnd,
  }
}

//
// labels
//

const ratioWrap = (ratio: number, octaveSize: number): number => {
  assertFinitePositive('ratioWrap.octaveSize', octaveSize)
  const wrapped = geoMod(ratio, octaveSize)
  if (wrapped === 1 && ratio >= octaveSize) {
    return octaveSize
  }
  return wrapped
}

const ratioToCentsLabel = (ratio: number, octaveSize: number): string => {
  return `${valueToCents(ratioWrap(ratio, octaveSize)).toFixed(1)}c`
}

export const pitchToLabel = (pitch: PitchType, context: Context): string => {
  const { type } = pitch.value

  if (type === 'PitchHz') {
    const { hz } = pitch.value
    return `${hz}Hz`
  }

  if (type === 'PitchCents') {
    const { cents } = pitch.value
    return `${cents}c`
  }

  const centsLabel = ratioToCentsLabel(pitchToRatio(pitch, context), context.octaveSize)

  if (type === 'PitchRatio') {
    const { numerator, denominator } = pitch.value
    return `${numerator}/${denominator}  ${centsLabel}`
  }

  if (type === 'PitchOctaveDivision') {
    const { numerator, denominator } = pitch.value
    return `${numerator}\\${denominator}  ${centsLabel}`
  }

  if (type === 'PitchDegree') {
    const { degree } = pitch.value
    const [wrappedDegree] = pitchDegreeWrap(degree, context.scale)
    return context.scaleLabels[wrappedDegree]!
  }

  throw new Error(`Unknown pitch type "${type}"`)
}

const edoToLabels = (edoSize: number, ratios: number[], octaveSize: number): string[] => {
  const labels: string[] = []
  for (let i = 0; i < edoSize; i++) {
    const centsLabel = ratioToCentsLabel(ratios[i]!, octaveSize)
    labels.push(`${i}\\${edoSize}  ${centsLabel}`)
  }
  return labels
}

//
// converters
//

const ENV_VALUES = [0, 0.003, 0.006, 0.01, 0.033, 0.1, 0.33, 1, 3.3, 10]

type Context = {
  rootHz: number
  time: number
  subdivision: number
  scale: number[]
  scaleLabels: string[]
  octaveSize: number
}

const times: [number, number][] = []

type ChordPitchType = PitchType | RatioChordPitchType | DelimiterType

const isPitchType = (pitch: ChordPitchType): pitch is PitchType => {
  return pitch.type === 'Pitch'
}

const isRatioChordPitchType = (pitch: ChordPitchType): pitch is RatioChordPitchType => {
  return pitch.type === 'RatioChordPitch'
}

const noteToMosc = (note: NoteType, context: Context): MoscBeatNote[] => {
  const timeProps = tailToTime(note.tail, context)

  // mutate ast node to add time
  const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
  times.push(arr)
  note.time = arr

  const hz = pitchToHz(note.pitch, context)
  const label = pitchToLabel(note.pitch, context)

  return [
    {
      type: 'NOTE_BEAT_TIME',
      hz,
      label,
      ...timeProps,
    },
  ]
}

const chordToMosc = (chord: ChordType | RatioChordType, context: Context): MoscBeatNote[] => {
  const { tail, pitches } = chord
  const chordPitches: ChordPitchType[] = pitches
  const timeProps = tailToTime(tail, context)

  // mutate ast node to add time
  const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
  times.push(arr)
  chord.time = arr

  const pitchTypes: MoscBeatNote[] = chordPitches.filter(isPitchType).map((pitch) => {
    const hz = pitchToHz(pitch, context)
    const label = pitchToLabel(pitch, context)

    return {
      type: 'NOTE_BEAT_TIME',
      hz,
      label,
      ...timeProps,
    }
  })

  const firstRatioPitch = chordPitches.find(isRatioChordPitchType)
  const firstDenominator = firstRatioPitch?.pitch

  if (firstDenominator === undefined) {
    return pitchTypes
  }

  assertFinitePositive('Ratio denominator', firstDenominator)

  const ratioPitchTypes: MoscBeatNote[] = []
  const addRatioPitchType = (numerator: number): void => {
    ratioPitchTypes.push({
      type: 'NOTE_BEAT_TIME',
      hz: (numerator / firstDenominator) * context.rootHz,
      label: `${numerator}/${firstDenominator}  ${ratioToCentsLabel(
        numerator / firstDenominator,
        context.octaveSize,
      )}`,
      ...timeProps,
    })
  }

  let colons = 0
  let lastNumerator = 1
  chordPitches.forEach((pitch) => {
    if (isRatioChordPitchType(pitch)) {
      const numerator = pitch.pitch
      assertFinitePositive('Ratio numerator', numerator)

      if (colons == 2) {
        while (lastNumerator < numerator - 1) {
          lastNumerator++
          addRatioPitchType(lastNumerator)
        }
      }

      addRatioPitchType(numerator)
      lastNumerator = numerator
      colons = 0
      return
    }
    if (pitch.type === 'Colon') {
      colons++
    }
  })

  return pitchTypes.concat(ratioPitchTypes)
}

const setScale = (setScale: SetScaleType, context: Context): void => {
  const { scale } = setScale
  const { type } = scale
  if (type === 'PitchGroupScale') {
    const { pitches, scaleOctaveMarker, pitchGroupScalePrefix } = scale

    let filteredPitches = pitches.filter((pitch): pitch is PitchType => pitch.type === 'Pitch')

    if (pitchGroupScalePrefix && pitchGroupScalePrefix.prefix === 'm') {
      const degreePitches: PitchDegreeType[] = [
        {
          type: 'PitchDegree',
          degree: 0,
          delimiter: false,
          location: pitchGroupScalePrefix.location,
        },
      ]

      let degree = 0
      filteredPitches.forEach((pitch) => {
        if (pitch.value.type !== 'PitchDegree') {
          throw new Error(
            'Mode scales {m} should only contain pitch degrees (0, 1, etc), not ratios, hz or any other kind of pitch',
          )
        }
        degree += pitch.value.degree

        degreePitches.push({
          ...pitch.value,
          degree,
        })
      })

      degreePitches.pop() // ignore last degree which is assumed to complete the octave
      filteredPitches = degreePitches.map((value) => ({
        type: 'Pitch',
        delimiter: false,
        location: value.location,
        value,
      }))
    }

    context.scale = filteredPitches.map((pitch) => pitchToRatio(pitch, context))
    context.scaleLabels = filteredPitches.map((pitch) => pitchToLabel(pitch, context))

    if (scaleOctaveMarker) {
      context.octaveSize = context.scale.pop() || 2
      context.scaleLabels.pop()
    }

    return
  }

  if (type === 'EdoScale') {
    const { divisions, octaveSize } = scale
    assertFinitePositive('EdoScale.divisions', divisions)
    assertFinitePositive('EdoScale.octaveSize', octaveSize)
    context.scale = edoToRatios(divisions, octaveSize)
    context.scaleLabels = edoToLabels(divisions, context.scale, octaveSize)
    context.octaveSize = octaveSize
    return
  }

  if (type === 'RatioChordScale') {
    const { pitches, scaleOctaveMarker } = scale

    context.scale = []
    context.scaleLabels = []

    let firstDenominator = -1
    let colons = 0
    let lastNumerator = 0

    const addRatio = (numerator: number): void => {
      const ratio = numerator / firstDenominator
      context.scale.push(ratio)
      const centsLabel = ratioToCentsLabel(ratio, 2)
      context.scaleLabels.push(`${numerator}/${firstDenominator}  ${centsLabel}`)
    }

    pitches.forEach((pitch) => {
      if (pitch.type !== 'RatioChordPitch') {
        colons++
        return
      }

      const numerator = pitch.pitch
      if (firstDenominator === -1) {
        assertFinitePositive('Ratio denominator', numerator)
        firstDenominator = numerator
      }

      assertFinitePositive('Ratio numerator', numerator)

      if (colons === 2) {
        while (lastNumerator < numerator - 1) {
          lastNumerator++
          addRatio(lastNumerator)
        }
      }

      addRatio(numerator)
      lastNumerator = numerator
      colons = 0
    })

    if (scaleOctaveMarker) {
      context.octaveSize = context.scale.pop() || 2
      context.scaleLabels.pop()
    }

    return
  }

  throw new Error(`Unknown scale type "${type}"`)
}

const setterToMosc = (setter: SetterType | DelimiterType, context: Context): MoscBeatItem[] => {
  const { type, delimiter } = setter

  if (delimiter) return []

  if (type === 'SetBpm') {
    const { bpm } = setter
    assertFinitePositive('SetBpm.bpm', bpm)
    return [
      {
        type: 'TEMPO',
        time: context.time,
        bpm,
        lerp: false,
      },
    ]
  }

  if (type === 'SetBms') {
    const { bms } = setter
    assertFinitePositive('SetBms.bms', bms)
    return [
      {
        type: 'TEMPO',
        time: context.time,
        bpm: 60000 / bms,
        lerp: false,
      },
    ]
  }

  if (type === 'SetSubdivision') {
    const { subdivision, denominator } = setter
    assertFinitePositive('SetSubdivision.subdivision', subdivision)
    if (denominator !== undefined) {
      assertFinitePositive('SetSubdivision.denominator', denominator)
    }
    context.subdivision = (denominator ?? 1) / subdivision
    assertFinitePositive('context.subdivision', context.subdivision)
    return []
  }

  if (type === 'SetOsc') {
    const { osc } = setter
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: context.time,
        value: {
          type: 'osc',
          osc,
        },
      },
    ]
  }

  if (type === 'SetEnv') {
    const { a, d, s, r } = setter
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: context.time,
        value: {
          type: 'env',
          a: ENV_VALUES[a] || 0,
          d: ENV_VALUES[d] || 0,
          s: s / 9,
          r: ENV_VALUES[r] || 0,
        },
      },
    ]
  }

  return []
}

const hasRulerRoot = (initial: BuildingInitialRulerState): initial is InitialRulerState =>
  initial.rootHz !== undefined && initial.octaveSize !== undefined

const rulerStateCaptureRootHz = (
  initial: BuildingInitialRulerState,
  context: Context,
): InitialRulerState => {
  if (hasRulerRoot(initial)) {
    return initial
  }
  return {
    ...initial,
    rootHz: context.rootHz,
    octaveSize: context.octaveSize,
  }
}

type BuildingInitialRulerState = {
  lowHz?: number
  highHz?: number
  rootHz?: number
  octaveSize?: number
  plots: MoscNote[][]
}

export type InitialRulerState = BuildingInitialRulerState & {
  rootHz: number
  octaveSize: number
}

const setterToRulerState = (
  initial: BuildingInitialRulerState,
  setter: SetterType | DelimiterType,
  context: Context,
): BuildingInitialRulerState => {
  const { type, delimiter } = setter

  if (delimiter) return initial

  if (type === 'SetRulerPlot') {
    const newPlot = context.scale.map(
      (ratio, i): MoscNote => ({
        type: 'NOTE_TIME',
        time: context.time,
        timeEnd: context.time,
        hz: ratio * context.rootHz,
        label: context.scaleLabels[i]!,
      }),
    )

    return {
      ...initial,
      plots: [...initial.plots, newPlot],
    }
  }

  if (type === 'SetRulerRange') {
    if (initial.lowHz) {
      return initial
    }

    const { low, high } = setter
    return {
      ...initial,
      lowHz: pitchToHz(low, context),
      highHz: pitchToHz(high, context),
    }
  }

  return initial
}

export type Processed = {
  score: MoscBeatScore
  initialRulerState: InitialRulerState
}

export const processGrammar = (grammar: XenpaperAST): Processed => {
  // console.log('grammar', JSON.stringify(grammar));
  times.length = 0

  const grammarSequence = grammar.sequence

  const INITIAL_TEMPO: MoscTempo = {
    type: 'TEMPO',
    time: 0,
    bpm: 120,
    lerp: false,
  }

  const INITIAL_OSC: MoscBeatParam = {
    type: 'PARAM_BEAT_TIME',
    time: 0,
    value: {
      type: 'osc',
      osc: 'triangle',
    },
  }

  const INITIAL_ENV: MoscBeatParam = {
    type: 'PARAM_BEAT_TIME',
    time: 0,
    value: {
      type: 'env',
      a: ENV_VALUES[2],
      d: ENV_VALUES[8],
      s: 0.5,
      r: ENV_VALUES[6],
    },
  }

  const scale = edoToRatios(12, 2)

  const context: Context = {
    rootHz: 220,
    time: 0,
    subdivision: 0.5,
    scale,
    scaleLabels: edoToLabels(12, scale, 2),
    octaveSize: 2,
  }

  const moscItems: MoscBeatItem[] = []
  let initialRulerState: BuildingInitialRulerState = {
    plots: [],
  }

  grammarSequence.items.forEach((item): void => {
    const { type } = item
    if (type === 'Comment' || type === 'BarLine' || type === 'Whitespace') {
      // do nothing
      return
    }

    if (type === 'SetScale') {
      setScale(item, context)
      return
    }

    if (type === 'SetRoot') {
      const { pitch } = item
      context.rootHz = pitchToHz(pitch, context)
      return
    }

    if (type === 'Note') {
      moscItems.push(...noteToMosc(item, context))
      initialRulerState = rulerStateCaptureRootHz(initialRulerState, context)
      return
    }

    if (type === 'Rest') {
      const { time } = context
      const rest = item
      assertFinitePositive('context.subdivision', context.subdivision)
      context.time += rest.length * context.subdivision
      // mutate ast node to add time
      const arr: [number, number] = [time, context.time]
      times.push(arr)
      rest.time = arr
      return
    }

    if (type === 'Chord') {
      moscItems.push(...chordToMosc(item, context))
      return
    }

    if (type === 'RatioChord') {
      moscItems.push(...chordToMosc(item, context))
      initialRulerState = rulerStateCaptureRootHz(initialRulerState, context)
      return
    }

    if (type === 'SetterGroup') {
      item.setters.forEach((setter) => {
        moscItems.push(...setterToMosc(setter, context))
        initialRulerState = setterToRulerState(initialRulerState, setter, context)
      })
      return
    }

    throw new Error(`Unknown sequence item "${type}"`)
  })

  const completeInitialRulerState = rulerStateCaptureRootHz(initialRulerState, context)

  const sequence = [
    INITIAL_TEMPO,
    INITIAL_OSC,
    INITIAL_ENV,
    ...moscItems,
    {
      type: 'END_BEAT_TIME',
      time: context.time,
    } as MoscBeatEnd,
  ]

  // translate times from steps to ms
  const thisBeatToTime = beatToTime(sequence)

  // omg are we really mutating many time items throughout the AST tree via mutations? golly!
  times.forEach((time) => {
    time[0] = thisBeatToTime(time[0])
    time[1] = thisBeatToTime(time[1])
  })

  const score = {
    sequence,
    lengthTime: context.time,
  }

  return {
    score,
    initialRulerState: completeInitialRulerState,
  }
}
