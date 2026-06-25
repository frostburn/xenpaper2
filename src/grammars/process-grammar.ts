import { dot } from 'xen-dev-utils/number-array'
import { type Monzo, sub } from 'xen-dev-utils/monzo'
import { PRIME_CENTS } from 'xen-dev-utils/primes'
import { gcd, mmod, geoMod } from 'xen-dev-utils/fraction'
import { centsToValue, equaveDivisionToValue, valueToCents } from 'xen-dev-utils/conversion'

import type {
  XenpaperAST,
  SetScaleType,
  SetMosType,
  SetRootType,
  NoteType,
  SampleRateNoteType,
  ChordType,
  RatioChordType,
  DroneType,
  TailType,
  PitchType,
  PitchAbsoluteType,
  PitchDegreeType,
  AccidentalType,
  InflectionType,
  RatioChordPitchType,
  SetterType,
  DelimiterType,
  UpLiftStepType,
  SequenceItemsType,
} from './grammar.generated'

import {
  nominalToMonzo,
  normalizeNominal,
  normalizeAccidentals,
  keySignatureAccidentals,
} from './pythagorean'
import { applyFjsInflections } from './fjs/inflections'
import {
  createMosConfig,
  mosKeySignatureAccidentals,
  normalizeMosNominal,
  type MosConfig,
} from './mos'

import type {
  MoscBeatScore,
  MoscBeatItem,
  MoscBeatNote,
  MoscBeatSampleRateNote,
  MoscTempo,
  MoscBeatParam,
  MoscBeatEnd,
  MoscNote,
} from '../mosc'

import { beatToTime } from '../mosc'

const NUM_COMPONENTS = 24
const DEFAULT_UP = valueToCents(243 / 242) / 2
const DEFAULT_LIFT = valueToCents(50 / 49) / 2
const DEFAULT_VOLUME_DB = 0

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

type AbsolutePitchMonzo = {
  monzo: Monzo
  ups: number
  lifts: number
}

const absoluteMosPitchToCents = (
  pitch: PitchAbsoluteType,
  octave: number,
  context: Context,
): number => {
  if (!context.mos) throw new Error('MOS pitch used before a MOS declaration.')
  const { nominalSteps, equaveSteps, chromaSteps, up, lift, stepSize } = context.mos
  const { key, equaves } = normalizeMosNominal(pitch.nominal, context.mos)
  const effectiveAccidentals = pitch.accidentals.length
    ? pitch.accidentals
    : (context.mos!.keySignature.get(key) ?? [])
  const nominalSteps_ = nominalSteps.get(key)
  if (nominalSteps_ === undefined) throw new Error(`Undefined MOS nominal '${pitch.nominal}'.`)
  let steps = nominalSteps_ + (octave + equaves) * equaveSteps
  for (const accidental of effectiveAccidentals) {
    switch (accidental) {
      case '&':
        steps += chromaSteps
        break
      case '@':
        steps -= chromaSteps
        break
      case 'e':
        steps += chromaSteps / 2
        break
      case 'a':
        steps -= chromaSteps / 2
        break
      default:
        throw new Error(`Accidental ${accidental} is not a MOS accidental.`)
    }
  }
  steps += pitch.ups * up + pitch.lifts * lift
  return steps * stepSize
}

const absolutePitchToMonzo = (
  pitch: PitchAbsoluteType,
  octave: number,
  context: Context,
): AbsolutePitchMonzo => {
  const { nominal, accidentals, inflections, ups, lifts } = pitch
  const keySignature = applyKeySignature(nominal, accidentals, context)
  const effectiveInflections = [...keySignature.inflections, ...inflections]
  const monzo = applyFjsInflections(
    nominalToMonzo(nominal, keySignature.accidentals).slice(),
    effectiveInflections,
  ).slice() as Monzo
  monzo[0] = (monzo[0] ?? 0) + octave

  return {
    monzo,
    ups: ups + keySignature.ups,
    lifts: lifts + keySignature.lifts,
  }
}

export const pitchToRatio = (pitch: PitchType, context: Context): number => {
  const { scale, octaveSize, mapping, stepSize, up, lift, rootNominal } = context
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

  if (type === 'PitchAbsolute') {
    if (pitch.value.nominalType === 'mos') {
      return centsToValue(absoluteMosPitchToCents(pitch.value, pitch.octave?.octave ?? 0, context))
    }
    const absolutePitch = absolutePitchToMonzo(pitch.value, pitch.octave?.octave ?? 0, context)
    const monzo = sub(absolutePitch.monzo, rootNominal.monzo)
    // Compute power-user mapping on the fly
    let tail = 0
    for (let i = mapping.length; i < monzo.length; ++i) {
      tail += Math.round(PRIME_CENTS[i]! / stepSize) * monzo[i]!
    }

    const steps = dot(mapping, monzo) + tail
    const annotatedPitch = pitch as PitchType & { outOfIntegerSteps?: boolean }
    annotatedPitch.outOfIntegerSteps =
      context.mappingIsIntegerSteps && Math.abs(steps - Math.round(steps)) > INTEGER_STEP_EPSILON

    const cents =
      steps * stepSize +
      (absolutePitch.ups - rootNominal.ups) * up +
      (absolutePitch.lifts - rootNominal.lifts) * lift
    return centsToValue(cents)
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

const setRoot = (item: SetRootType, context: Context): void => {
  const nextRootHz = item.pitch === null ? context.rootHz : pitchToHz(item.pitch, context)
  if (item.rootNominal === null) {
    context.rootHz = nextRootHz
    return
  }

  const rootNominal = absolutePitchToMonzo(item.rootNominal, item.rootNominal.octave, context)
  context.rootHz = nextRootHz
  context.rootNominal = rootNominal
}

const consumeDuration = (units: number, context: Context): { time: number; timeEnd: number } => {
  const time = context.time
  assertFinitePositive('context.subdivision', context.subdivision)

  if (context.graceSubdivision !== null) {
    assertFinitePositive('context.graceSubdivision', context.graceSubdivision)
    const graceDuration = units * context.graceSubdivision
    context.time += graceDuration
    context.stolenTime += graceDuration
    context.graceNotesRemaining -= 1
    if (context.graceNotesRemaining <= 0) {
      context.graceSubdivision = null
      context.graceNotesRemaining = 0
    }
    return { time, timeEnd: context.time }
  }

  const duration = units * context.subdivision - context.stolenTime
  if (duration < 0) {
    throw new Error('Grace notes stole more time than the following item has')
  }

  context.time += duration
  context.stolenTime = 0
  return { time, timeEnd: context.time }
}

const tailToTime = (tail: TailType | null, context: Context): { time: number; timeEnd: number } => {
  const duration = tail?.type === 'Hold' ? tail.length + 1 : 1
  return consumeDuration(duration, context)
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

  if (type === 'PitchAbsolute') {
    if (pitch.value.nominalType === 'mos') {
      const { ups, lifts, nominal, accidentals } = pitch.value
      const { key } = normalizeMosNominal(nominal, context.mos!)
      const effectiveAccidentals = accidentals.length
        ? accidentals
        : (context.mos!.keySignature.get(key) ?? [])
      return `${'^'.repeat(Math.max(ups, 0))}${'v'.repeat(Math.max(-ups, 0))}${'/'.repeat(Math.max(lifts, 0))}${'\\'.repeat(Math.max(-lifts, 0))}${nominal}${effectiveAccidentals.join('')}`
    }
    const { ups, lifts, nominal, accidentals, inflections } = pitch.value
    const keySignature = applyKeySignature(nominal, accidentals, context)
    const effectiveUps = ups + keySignature.ups
    const effectiveLifts = lifts + keySignature.lifts
    const effectiveInflections = [...keySignature.inflections, ...inflections]
    return (
      (effectiveUps > 0 ? '^' : 'v').repeat(Math.abs(effectiveUps)) +
      (effectiveLifts > 0 ? '/' : '\\').repeat(Math.abs(effectiveLifts)) +
      normalizeNominal(nominal) +
      normalizeAccidentals(keySignature.accidentals).join('') +
      effectiveInflections
        .map(({ type, value, flavor }) => `${type === 'superscript' ? '^' : 'v'}${value}${flavor}`)
        .join('')
    )
  }

  throw new Error(`Unknown pitch type "${type}"`)
}

const INTEGER_STEP_EPSILON = 1e-8

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
  rootNominal: {
    monzo: Monzo
    ups: number
    lifts: number
  }
  time: number
  subdivision: number
  scale: number[]
  scaleLabels: string[]
  octaveSize: number
  up: number
  lift: number
  mapping: number[]
  stepSize: number
  mappingIsIntegerSteps: boolean
  mos: MosConfig | null
  keySignature: Map<string, KeySignatureAdjustment>
  graceSubdivision: number | null
  graceNotesRemaining: number
  stolenTime: number
}

type KeySignatureAdjustment = {
  ups: number
  lifts: number
  accidentals: AccidentalType[]
  inflections: InflectionType[]
}

const EMPTY_KEY_SIGNATURE_ADJUSTMENT: KeySignatureAdjustment = {
  ups: 0,
  lifts: 0,
  accidentals: [],
  inflections: [],
}

const applyKeySignature = (
  nominal: string,
  accidentals: AccidentalType[],
  context: Context,
): KeySignatureAdjustment => {
  const signature =
    context.keySignature.get(nominal.toUpperCase()) ?? EMPTY_KEY_SIGNATURE_ADJUSTMENT
  if (accidentals.length) {
    return { ...signature, accidentals }
  }

  return signature
}

const times: [number, number][] = []

type RepetitionState = {
  startIndex: number
  repeatCount: number
  repetitionsAdded: number
  firstEndingIndex?: number
  firstEndingSegment?: SequenceItemsType[]
}

const cloneSequenceItem = <T>(item: T): T => {
  if (Array.isArray(item)) {
    return item.map(cloneSequenceItem) as T
  }

  if (item && typeof item === 'object') {
    return Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, cloneSequenceItem(value)]),
    ) as T
  }

  return item
}

type SequenceItemWithTail = Extract<
  SequenceItemsType,
  { type: 'Note' | 'SampleRateNote' | 'Chord' | 'RatioChord' }
>

const isSequenceItemWithTail = (item: SequenceItemsType): item is SequenceItemWithTail =>
  item.type === 'Note' ||
  item.type === 'SampleRateNote' ||
  item.type === 'Chord' ||
  item.type === 'RatioChord'

const addTail = (item: SequenceItemWithTail, tail: TailType): void => {
  if (!item.tail) {
    item.tail = cloneSequenceItem(tail)
    return
  }

  item.tail = {
    ...item.tail,
    length: item.tail.length + tail.length,
    parts: [...item.tail.parts, ...cloneSequenceItem(tail.parts)],
  }
}

const addTailToLastPlayableItem = (items: SequenceItemsType[], tail: TailType | null): void => {
  if (!tail) return

  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]
    if (!item) continue

    if (item.type === 'Rest') {
      throw new Error('Cannot attach a hold to a rest')
    }

    if (isSequenceItemWithTail(item)) {
      addTail(item, tail)
      return
    }
  }

  throw new Error('Cannot attach a hold without a previous note, sample-rate note, or chord')
}

type MusicalControlInstruction = Extract<SequenceItemsType, { type: 'DaCapo' | 'DalSegno' }>

const expandMusicalControlFlowItems = (items: SequenceItemsType[]): SequenceItemsType[] => {
  const expandedItems: SequenceItemsType[] = []

  const findIndex = (type: SequenceItemsType['type'], startIndex = 0): number =>
    items.findIndex((item, index) => index >= startIndex && item.type === type)

  const appendClonedRange = (startIndex: number, endIndex: number): void => {
    expandedItems.push(...items.slice(startIndex, endIndex).map(cloneSequenceItem))
  }

  const expandInstruction = (item: MusicalControlInstruction): void => {
    const targetIndex = item.type === 'DaCapo' ? 0 : findIndex('Segno')
    if (targetIndex < 0) {
      throw new Error('D.S. requires a Segno marker')
    }

    if (item.stop === 'fine') {
      const fineIndex = findIndex('Fine', targetIndex)
      appendClonedRange(targetIndex, fineIndex < 0 ? items.length : fineIndex)
      return
    }

    const alCodaIndex = findIndex('AlCoda', targetIndex)
    const codaIndex = findIndex('Coda', alCodaIndex < 0 ? targetIndex : alCodaIndex)
    if (alCodaIndex < 0 || codaIndex < 0) {
      throw new Error(
        `${item.type === 'DaCapo' ? 'D.C.' : 'D.S.'} al Coda requires To Coda and Coda markers`,
      )
    }

    appendClonedRange(targetIndex, alCodaIndex)
    appendClonedRange(codaIndex, items.length)
  }

  for (const item of items) {
    expandedItems.push(item)

    if (item.type === 'DaCapo' || item.type === 'DalSegno') {
      expandInstruction(item)
      break
    }
  }

  return expandedItems
}

const expandRepeatedSequenceItems = (items: SequenceItemsType[]): SequenceItemsType[] => {
  const expandedItems: SequenceItemsType[] = []
  const repetitionStack: RepetitionState[] = []

  const openRepeat = (
    item: Extract<SequenceItemsType, { type: 'RepeatStart' | 'RepeatEndStart' }>,
  ): void => {
    limit('Repeat count', item.repeatCount, 1, 100)
    expandedItems.push(item)
    repetitionStack.push({
      startIndex: expandedItems.length,
      repeatCount: item.repeatCount,
      repetitionsAdded: 0,
    })
  }

  const closeRepeat = (
    item: Extract<SequenceItemsType, { type: 'RepeatEnd' | 'RepeatEndStart' }>,
  ): void => {
    const repetitionState = repetitionStack.pop() ?? {
      startIndex: 0,
      repeatCount: 2,
      repetitionsAdded: 0,
    }
    const hasAlternateEnding = item.type === 'RepeatEnd' && item.alternateEnding !== null
    const endIndex =
      hasAlternateEnding && repetitionState.firstEndingIndex !== undefined
        ? repetitionState.firstEndingIndex
        : expandedItems.length
    const repeatCount = hasAlternateEnding
      ? item.alternateEnding! < repetitionState.repeatCount
        ? 1
        : repetitionState.repeatCount - 1 - repetitionState.repetitionsAdded
      : repetitionState.repeatCount - 1
    const segment =
      repetitionState.firstEndingSegment ??
      expandedItems.slice(repetitionState.startIndex, endIndex)
    const repeatedItems = Array.from({ length: repeatCount }).flatMap(() =>
      segment.map(cloneSequenceItem),
    )
    addTailToLastPlayableItem(
      repeatedItems.length ? repeatedItems : expandedItems,
      item.type === 'RepeatEnd' ? item.tail : null,
    )
    expandedItems.push(item, ...repeatedItems)

    if (hasAlternateEnding && item.alternateEnding! < repetitionState.repeatCount) {
      repetitionStack.push({
        ...repetitionState,
        repetitionsAdded: repetitionState.repetitionsAdded + repeatCount,
      })
    }
  }

  items.forEach((item) => {
    if (item.type === 'RepeatStart') {
      openRepeat(item)
      return
    }

    if (item.type === 'RepeatEndStart') {
      closeRepeat(item)
      openRepeat(item)
      return
    }

    if (item.type === 'RepeatEndingStart') {
      const repetitionState = repetitionStack[repetitionStack.length - 1]
      if (item.alternateEnding === 1 && repetitionState) {
        repetitionState.firstEndingIndex = expandedItems.length
        repetitionState.firstEndingSegment = expandedItems
          .slice(repetitionState.startIndex, repetitionState.firstEndingIndex)
          .map(cloneSequenceItem)
      }
      addTailToLastPlayableItem(expandedItems, item.tail)
      expandedItems.push(item)
      return
    }

    if (item.type === 'RepeatEnd') {
      closeRepeat(item)
      return
    }

    expandedItems.push(item)
  })

  if (repetitionStack.length > 0) {
    throw new Error('Unpaired repeat start marker "|:"')
  }

  return expandedItems
}

type ChordPitchType = PitchType | SampleRateNoteType | RatioChordPitchType | DelimiterType

const isPitchType = (pitch: ChordPitchType): pitch is PitchType => {
  return pitch.type === 'Pitch'
}

const isRatioChordPitchType = (pitch: ChordPitchType): pitch is RatioChordPitchType => {
  return pitch.type === 'RatioChordPitch'
}

const isSampleRateNoteType = (pitch: ChordPitchType): pitch is SampleRateNoteType => {
  return pitch.type === 'SampleRateNote'
}

const startsRatioChordSegment = (pitches: ChordPitchType[], index: number): boolean =>
  isRatioChordPitchType(pitches[index]!) ||
  (pitches[index]?.type === 'InversionPrefix' && isRatioChordPitchType(pitches[index + 1]!))

type RatioFraction = { numerator: number; denominator: number }

type ExpandedChordPitch =
  | { type: 'Pitch'; pitch: PitchType; ratio: number; fraction: RatioFraction | null }
  | { type: 'SampleRateNote'; pitch: SampleRateNoteType }
  | { type: 'RatioChordPitch'; ratio: number; fraction: RatioFraction | null }

const pitchRatioFraction = (pitch: PitchType): RatioFraction | null =>
  pitch.value.type === 'PitchRatio'
    ? { numerator: pitch.value.numerator, denominator: pitch.value.denominator }
    : null

const expandChordPitchGroup = (
  chordPitches: ChordPitchType[],
  getPitchRatio: (pitch: PitchType) => number,
  preserveLeadingRatioChordLabel: (hasExplicitPreviousPitch: boolean) => boolean,
): ExpandedChordPitch[] => {
  const result: ExpandedChordPitch[] = []
  let previousPitchRatio = 1
  let previousPitchFraction: RatioFraction | null = {
    numerator: 1,
    denominator: 1,
  }
  let canStackRatioChord = true

  const addRatioPitchType = (ratio: number, fraction: RatioFraction | null): void => {
    result.push({ type: 'RatioChordPitch', ratio, fraction })
    previousPitchRatio = ratio
    previousPitchFraction = fraction
  }

  const addRatioChord = (
    ratioChordPitches: Array<RatioChordPitchType | DelimiterType>,
    hasExplicitPreviousPitch: boolean,
  ): void => {
    const firstDenominator = ratioChordPitches.find(isRatioChordPitchType)?.pitch
    const inverted = ratioChordPitches.some(
      (pitch) => isRatioChordPitchType(pitch) && pitch.inverted,
    )

    if (firstDenominator === undefined) {
      return
    }

    if (hasExplicitPreviousPitch && !canStackRatioChord) {
      throw new Error('Cannot expand a ratio chord from a sample-rate pitch')
    }

    assertFinitePositive('Ratio denominator', firstDenominator)

    const basePitchRatio = previousPitchRatio
    const basePitchFraction = previousPitchFraction
    const preserveFirstRatioLabel = preserveLeadingRatioChordLabel(hasExplicitPreviousPitch)
    let colons = 0
    let lastNumerator = 1
    let isFirstPitch = true

    const createFraction = (numerator: number): RatioFraction | null => {
      if (!basePitchFraction) return null

      const nextNumerator = basePitchFraction.numerator * (inverted ? firstDenominator : numerator)
      const nextDenominator =
        basePitchFraction.denominator * (inverted ? numerator : firstDenominator)
      if (preserveFirstRatioLabel) {
        return {
          numerator: nextNumerator,
          denominator: nextDenominator,
        }
      }
      const divisor = gcd(nextNumerator, nextDenominator)
      return {
        numerator: nextNumerator / divisor,
        denominator: nextDenominator / divisor,
      }
    }

    ratioChordPitches.forEach((pitch) => {
      if (isRatioChordPitchType(pitch)) {
        const numerator = pitch.pitch
        assertFinitePositive('Ratio numerator', numerator)

        if (colons === 2) {
          const step = Math.sign(numerator - lastNumerator)
          while (step !== 0 && lastNumerator + step !== numerator) {
            lastNumerator += step
            addRatioPitchType(
              basePitchRatio *
                (inverted ? firstDenominator / lastNumerator : lastNumerator / firstDenominator),
              createFraction(lastNumerator),
            )
          }
        }

        if (!isFirstPitch || !hasExplicitPreviousPitch) {
          addRatioPitchType(
            basePitchRatio *
              (inverted ? firstDenominator / numerator : numerator / firstDenominator),
            createFraction(numerator),
          )
        }

        lastNumerator = numerator
        colons = 0
        isFirstPitch = false
        return
      }
      if (pitch.type === 'Colon') {
        colons++
      }
    })
  }

  let ratioChordPitches: Array<RatioChordPitchType | DelimiterType> = []
  chordPitches.forEach((pitch, index) => {
    if (isPitchType(pitch) || isSampleRateNoteType(pitch)) {
      addRatioChord(ratioChordPitches, result.length > 0)
      ratioChordPitches = []

      if (isPitchType(pitch)) {
        const ratio = getPitchRatio(pitch)
        result.push({ type: 'Pitch', pitch, ratio, fraction: pitchRatioFraction(pitch) })
        previousPitchRatio = ratio
        previousPitchFraction = pitchRatioFraction(pitch)
        canStackRatioChord = true
      } else {
        result.push({ type: 'SampleRateNote', pitch })
        canStackRatioChord = false
      }
      return
    }

    if (pitch.type === 'Colon') {
      ratioChordPitches.push(pitch)
      return
    }
    if (pitch.type === 'Whitespace') {
      const previousPitch = chordPitches[index - 1]
      if (
        previousPitch &&
        isRatioChordPitchType(previousPitch) &&
        startsRatioChordSegment(chordPitches, index + 1)
      ) {
        addRatioChord(ratioChordPitches, result.length > 0)
        ratioChordPitches = []
      }
      return
    }
    if (isRatioChordPitchType(pitch)) {
      ratioChordPitches.push(pitch)
    }
  })
  addRatioChord(ratioChordPitches, result.length > 0)

  return result
}

type MoscBeatPlayableNote = MoscBeatNote | MoscBeatSampleRateNote

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

const sampleRateNoteToMosc = (
  note: SampleRateNoteType,
  context: Context,
): MoscBeatSampleRateNote[] => {
  const timeProps = tailToTime(note.tail, context)

  // mutate ast node to add time
  const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
  times.push(arr)
  note.time = arr

  return [
    {
      type: 'SAMPLE_RATE_NOTE_BEAT_TIME',
      label: 'sample rate',
      ...timeProps,
    },
  ]
}

const chordToMosc = (
  chord: ChordType | RatioChordType,
  context: Context,
): MoscBeatPlayableNote[] => {
  const { tail, pitches } = chord
  const chordPitches: ChordPitchType[] = pitches
  const timeProps = tailToTime(tail, context)

  // mutate ast node to add time
  const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
  times.push(arr)
  chord.time = arr

  return expandChordPitchGroup(
    chordPitches,
    (pitch) => pitchToHz(pitch, context) / context.rootHz,
    (hasExplicitPreviousPitch) => chord.type === 'RatioChord' || !hasExplicitPreviousPitch,
  ).map((pitch): MoscBeatPlayableNote => {
    if (pitch.type === 'SampleRateNote') {
      return {
        type: 'SAMPLE_RATE_NOTE_BEAT_TIME',
        label: 'sample rate',
        ...timeProps,
      }
    }

    if (pitch.type === 'Pitch') {
      return {
        type: 'NOTE_BEAT_TIME',
        hz: pitch.ratio * context.rootHz,
        label: pitchToLabel(pitch.pitch, context),
        ...timeProps,
      }
    }

    const centsLabel = ratioToCentsLabel(pitch.ratio, context.octaveSize)
    const label = pitch.fraction
      ? `${pitch.fraction.numerator}/${pitch.fraction.denominator}  ${centsLabel}`
      : centsLabel
    return {
      type: 'NOTE_BEAT_TIME',
      hz: pitch.ratio * context.rootHz,
      label,
      ...timeProps,
    }
  })
}

const pointTime = (
  item: NoteType | SampleRateNoteType | ChordType | RatioChordType,
  context: Context,
): [number, number] => {
  const arr: [number, number] = [context.time, context.time]
  times.push(arr)
  item.time = arr
  return arr
}

const playableToMoscAtCurrentTime = (
  item: NoteType | SampleRateNoteType | ChordType | RatioChordType,
  context: Context,
): MoscBeatPlayableNote[] => {
  const startTime = context.time
  const originalTail = item.tail
  const graceSubdivision = context.graceSubdivision
  const graceNotesRemaining = context.graceNotesRemaining
  const stolenTime = context.stolenTime
  item.tail = null
  const moscItems =
    item.type === 'Note'
      ? noteToMosc(item, context)
      : item.type === 'SampleRateNote'
        ? sampleRateNoteToMosc(item, context)
        : chordToMosc(item, context)
  item.tail = originalTail
  context.time = startTime
  context.graceSubdivision = graceSubdivision
  context.graceNotesRemaining = graceNotesRemaining
  context.stolenTime = stolenTime
  return moscItems.map((moscItem) => ({
    ...moscItem,
    time: startTime,
    timeEnd: startTime,
  }))
}

const droneToMosc = (drone: DroneType, context: Context): MoscBeatPlayableNote[] => {
  if (!drone.value) {
    return []
  }

  pointTime(drone.value, context)
  return playableToMoscAtCurrentTime(drone.value, context)
}

const setMos = (setMos: SetMosType, context: Context): void => {
  const mos = createMosConfig(setMos.expressions.map((expression) => expression.value))
  context.mos = mos
}

const setScale = (setScale: SetScaleType, context: Context): void => {
  const { scale } = setScale
  const { type } = scale
  if (type === 'PitchGroupScale') {
    const { pitches, scaleOctaveMarker, pitchGroupScalePrefix } = scale
    const scalePitches: ChordPitchType[] = pitches

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
      scalePitches.forEach((pitch) => {
        if (pitch.type === 'Whitespace') return
        if (!isPitchType(pitch) || pitch.value.type !== 'PitchDegree') {
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
      context.scale = degreePitches.map((value) =>
        pitchToRatio(
          {
            type: 'Pitch',
            delimiter: false,
            location: value.location,
            value,
            octave: null,
          },
          context,
        ),
      )
      context.scaleLabels = degreePitches.map((value) =>
        pitchToLabel(
          {
            type: 'Pitch',
            delimiter: false,
            location: value.location,
            value,
            octave: null,
          },
          context,
        ),
      )
    } else {
      const expandedPitches = expandChordPitchGroup(
        scalePitches,
        (pitch) => pitchToRatio(pitch, context),
        (hasExplicitPreviousPitch) => !hasExplicitPreviousPitch,
      )

      context.scale = []
      context.scaleLabels = []
      expandedPitches.forEach((pitch) => {
        if (pitch.type === 'SampleRateNote') return

        context.scale.push(pitch.ratio)
        if (pitch.type === 'Pitch') {
          context.scaleLabels.push(pitchToLabel(pitch.pitch, context))
          return
        }

        const centsLabel = ratioToCentsLabel(pitch.ratio, context.octaveSize)
        context.scaleLabels.push(
          pitch.fraction
            ? `${pitch.fraction.numerator}/${pitch.fraction.denominator}  ${centsLabel}`
            : centsLabel,
        )
      })
    }

    if (scaleOctaveMarker) {
      context.octaveSize = context.scale.pop() || 2
      context.scaleLabels.pop()
    }

    return
  }

  if (type === 'EdoScale') {
    const { divisions, octaveSize } = scale
    limit('EdoScale.divisions', divisions, 1, 10000)
    assertFinitePositive('EdoScale.octaveSize', octaveSize)
    context.scale = edoToRatios(divisions, octaveSize)
    context.scaleLabels = edoToLabels(divisions, context.scale, octaveSize)
    context.octaveSize = octaveSize
    context.stepSize = valueToCents(octaveSize) / divisions
    context.up = context.stepSize
    context.lift = 5 * context.stepSize
    context.mapping = PRIME_CENTS.slice(0, NUM_COMPONENTS).map((c) =>
      Math.round(c / context.stepSize),
    )
    context.mappingIsIntegerSteps = true
    return
  }

  if (type === 'PythagoreanScale') {
    context.up = DEFAULT_UP
    context.lift = DEFAULT_LIFT
    context.mapping = PRIME_CENTS
    context.stepSize = 1
    context.mappingIsIntegerSteps = false
    return
  }

  throw new Error(`Unknown scale type "${type}"`)
}

const upLiftStepToCents = (name: string, value: UpLiftStepType): number => {
  if (value.type === 'PitchRatio') {
    const { numerator, denominator } = value
    assertFinitePositive(`${name}.denominator`, denominator)
    const ratio = numerator / denominator
    limit(name, ratio, 0, 100)
    return valueToCents(ratio)
  }

  if (value.type === 'PitchCents') {
    const { cents } = value
    limit(name, cents, -12000, 12000)
    return cents
  }

  const { numerator, denominator, octaveSize } = value
  assertFinitePositive(`${name}.denominator`, denominator)
  assertFinitePositive(`${name}.octaveSize`, octaveSize)
  return valueToCents(equaveDivisionToValue(numerator, denominator, octaveSize))
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
    const normalizedDenominator = denominator ?? 1
    assertFinitePositive('SetSubdivision.denominator', normalizedDenominator)
    context.subdivision = normalizedDenominator / subdivision
    assertFinitePositive('context.subdivision', context.subdivision)
    return []
  }

  if (type === 'SetGrace') {
    const { subdivision, denominator, count } = setter
    assertFinitePositive('SetGrace.subdivision', subdivision)
    assertFinitePositive('SetGrace.count', count)
    const normalizedDenominator = denominator ?? 1
    assertFinitePositive('SetGrace.denominator', normalizedDenominator)
    context.graceSubdivision = normalizedDenominator / subdivision
    context.graceNotesRemaining = count
    return []
  }

  if (type === 'SetUp') {
    context.up = upLiftStepToCents('SetUp', setter.value)
    return []
  }

  if (type === 'SetLift') {
    context.lift = upLiftStepToCents('SetLift', setter.value)
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

  if (type === 'SetNoise') {
    const { noise } = setter
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: context.time,
        value: {
          type: 'noise',
          noise,
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

  if (type === 'SetVolume') {
    const { db } = setter
    limit('SetVolume.db', db, -100, 20)
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: context.time,
        value: {
          type: 'volume',
          db,
        },
      },
    ]
  }

  if (type === 'SetVelocity') {
    const { velocity } = setter
    limit('SetVelocity.velocity', velocity, 0, 4)
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: context.time,
        value: {
          type: 'velocity',
          velocity,
        },
      },
    ]
  }

  if (type === 'SetKey') {
    if (setter.keyType === 'mos') {
      if (!context.mos) throw new Error('MOS key used before a MOS declaration.')
      context.mos.keySignature = mosKeySignatureAccidentals(
        setter.tonic,
        setter.expressions,
        context.mos,
      )
    } else {
      const { tonic, mode } = setter
      context.keySignature = keySignatureAccidentals(tonic, mode)
    }
    return []
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
  times.length = 0

  const grammarSequence = grammar.sequence
  grammarSequence.items = expandMusicalControlFlowItems(
    expandRepeatedSequenceItems(grammarSequence.items),
  )

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

  const INITIAL_VOLUME: MoscBeatParam = {
    type: 'PARAM_BEAT_TIME',
    time: 0,
    value: {
      type: 'volume',
      db: DEFAULT_VOLUME_DB,
    },
  }

  const INITIAL_VELOCITY: MoscBeatParam = {
    type: 'PARAM_BEAT_TIME',
    time: 0,
    value: {
      type: 'velocity',
      velocity: 0.5,
    },
  }

  const scale = edoToRatios(12, 2)

  const context: Context = {
    rootHz: 220,
    rootNominal: {
      monzo: [],
      ups: 0,
      lifts: 0,
    },
    time: 0,
    subdivision: 0.5,
    scale,
    scaleLabels: edoToLabels(12, scale, 2),
    octaveSize: 2,
    up: DEFAULT_UP,
    lift: DEFAULT_LIFT,
    mapping: PRIME_CENTS,
    stepSize: 1,
    mappingIsIntegerSteps: false,
    mos: null,
    keySignature: new Map(),
    graceSubdivision: null,
    graceNotesRemaining: 0,
    stolenTime: 0,
  }

  const moscItems: MoscBeatItem[] = []
  let activeDroneItems: MoscBeatPlayableNote[] = []
  let activeDroneTimes: [number, number][] = []
  const stopActiveDrone = (): void => {
    activeDroneItems.forEach((droneItem) => {
      droneItem.timeEnd = context.time
    })
    activeDroneTimes.forEach((time) => {
      time[1] = context.time
    })
    activeDroneItems = []
    activeDroneTimes = []
  }
  let initialRulerState: BuildingInitialRulerState = {
    plots: [],
  }

  grammarSequence.items.forEach((item): void => {
    const { type } = item
    if (
      type === 'Comment' ||
      type === 'BarLine' ||
      type === 'Whitespace' ||
      type === 'RepeatStart' ||
      type === 'RepeatEnd' ||
      type === 'RepeatEndStart' ||
      type === 'RepeatEndingStart' ||
      type === 'Segno' ||
      type === 'Coda' ||
      type === 'Fine' ||
      type === 'DaCapo' ||
      type === 'DalSegno' ||
      type === 'AlCoda'
    ) {
      // do nothing
      return
    }

    if (type === 'SetScale') {
      setScale(item, context)
      return
    }

    if (type === 'SetMos') {
      setMos(item, context)
      return
    }

    if (type === 'SetRoot') {
      setRoot(item, context)
      return
    }

    if (type === 'Note') {
      moscItems.push(...noteToMosc(item, context))
      initialRulerState = rulerStateCaptureRootHz(initialRulerState, context)
      return
    }

    if (type === 'SampleRateNote') {
      moscItems.push(...sampleRateNoteToMosc(item, context))
      return
    }

    if (type === 'Rest') {
      const rest = item
      const timeProps = consumeDuration(rest.length, context)
      // mutate ast node to add time
      const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
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
        if (setter.type === 'Drone') {
          stopActiveDrone()
          activeDroneItems = droneToMosc(setter, context)
          activeDroneTimes = setter.value?.time ? [setter.value.time] : []
          moscItems.push(...activeDroneItems)
          if (setter.value?.type === 'Note' || setter.value?.type === 'RatioChord') {
            initialRulerState = rulerStateCaptureRootHz(initialRulerState, context)
          }
          return
        }

        moscItems.push(...setterToMosc(setter, context))
        initialRulerState = setterToRulerState(initialRulerState, setter, context)
      })
      return
    }

    throw new Error(`Unknown sequence item "${type}"`)
  })

  stopActiveDrone()

  const completeInitialRulerState = rulerStateCaptureRootHz(initialRulerState, context)

  const sequence = [
    INITIAL_TEMPO,
    INITIAL_OSC,
    INITIAL_ENV,
    INITIAL_VOLUME,
    INITIAL_VELOCITY,
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
