import { dot } from 'xen-dev-utils/number-array'
import { type Monzo, sub, toMonzo } from 'xen-dev-utils/monzo'
import { PRIMES, PRIME_CENTS } from 'xen-dev-utils/primes'
import { Fraction, mmod, geoMod } from 'xen-dev-utils/fraction'
import { centsToValue, equaveDivisionToValue, valueToCents } from 'xen-dev-utils/conversion'

import {
  DEFAULT_LIFT,
  DEFAULT_UP,
  DEFAULT_VOLUME_DB,
  ENV_VALUES,
  INTEGER_STEP_EPSILON,
  NUM_COMPONENTS,
} from './constants'
import { assertFinitePositive, limit } from './validation'
import { expandMusicalControlFlowItems, expandRepeatedSequenceItems } from './sequence-expansion'
import {
  expandChordPitchGroup,
  isPitchType,
  type ChordPitchType,
  type RatioFraction,
} from './chord-expansion'

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
  SetterType,
  SetGrooveType,
  DelimiterType,
  RepeatType,
  KeyTonicType,
  MosKeyTonicType,
  PlotNominalType,
  CustomMappingScaleType,
} from '../grammar.generated'
import { isEasingName, type EasingName } from '../../mosc'

import {
  nominalToMonzo,
  normalizeNominal,
  normalizeAccidentals,
  keySignatureAccidentals,
  keySignatureFromPitches,
  type KeySignature,
  type KeySignatureAdjustment,
} from '../pythagorean'
import { applyFjsInflections } from '../fjs/inflections'
import {
  createMosConfig,
  mosKeySignatureAccidentals,
  mosKeySignatureFromPitches,
  normalizeMosNominal,
  type MosConfig,
  type MosKeySignatureAdjustment,
} from '../mos'

import type {
  MoscBeatScore,
  MoscBeatItem,
  MoscBeatNote,
  MoscBeatSampleRateNote,
  MoscTempo,
  MoscBeatParam,
  MoscBeatEnd,
  MoscNote,
} from '../../mosc'

import { beatToTime } from '../../mosc'

//
// pitch math
//

type AbsolutePitchMonzo = {
  monzo: Monzo
  ups: number
  lifts: number
}

const EMPTY_MOS_KEY_SIGNATURE_ADJUSTMENT: MosKeySignatureAdjustment = {
  ups: 0,
  lifts: 0,
  accidentals: [],
}

const hasNaturalAccidental = (accidentals: AccidentalType[]): boolean =>
  accidentals.some((accidental) => accidental === '♮' || accidental === '_')

const absoluteMosPitchToCents = (
  pitch: PitchAbsoluteType,
  octave: number,
  context: Context,
): number => {
  if (!context.mos) throw new Error('MOS pitch used before a MOS declaration.')
  const { nominalSteps, equaveSteps, chromaSteps, up, lift, stepSize } = context.mos
  const { key, equaves } = normalizeMosNominal(pitch.nominal, context.mos)
  const signature = context.mos.keySignature.get(key) ?? EMPTY_MOS_KEY_SIGNATURE_ADJUSTMENT
  const undoKeyUpsAndLifts = hasNaturalAccidental(pitch.accidentals)
  const signatureUps = undoKeyUpsAndLifts ? 0 : signature.ups
  const signatureLifts = undoKeyUpsAndLifts ? 0 : signature.lifts
  const effectiveAccidentals = pitch.accidentals.length ? pitch.accidentals : signature.accidentals
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
      case '♮':
      case '_':
        break
      default:
        throw new Error(`Accidental ${accidental} is not a MOS accidental.`)
    }
  }
  steps += (pitch.ups + signatureUps) * up + (pitch.lifts + signatureLifts) * lift
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

const ratioFractionToMonzo = (fraction: RatioFraction): Monzo =>
  toMonzo(new Fraction(fraction.numerator, fraction.denominator))

const ratioToMappedCents = (fraction: RatioFraction, context: Context): number => {
  const monzo = ratioFractionToMonzo(fraction)
  let tail = 0
  for (let i = context.mapping.length; i < monzo.length; ++i) {
    tail += Math.round(PRIME_CENTS[i]! / context.stepSize) * monzo[i]!
  }

  return (dot(context.mapping, monzo) + tail) * context.stepSize
}

const ratioFractionToRatio = (fraction: RatioFraction): number => {
  assertFinitePositive('Ratio denominator', fraction.denominator)
  const ratio = fraction.numerator / fraction.denominator
  limit('Pitch ratio', ratio, 0, 100)
  return ratio
}

const temperedRatioFractionToRatio = (fraction: RatioFraction, context: Context): number =>
  centsToValue(ratioToMappedCents(fraction, context))

export const pitchToRatio = (pitch: PitchType, context: Context): number => {
  const { scale, octaveSize, mapping, stepSize, up, lift, rootNominal } = context
  assertFinitePositive('context.octaveSize', octaveSize)
  limit('Equave size', octaveSize, -20, 20)

  const { type } = pitch.value
  const octaveMulti = Math.pow(octaveSize, pitch.octave?.octave ?? 0)

  if (type === 'PitchHz') {
    const { hz } = pitch.value
    assertFinitePositive('PitchHz.hz', hz)
    assertFinitePositive('context.rootHz', context.rootHz)
    limit('Hz', hz, 0, 20000)
    return (hz / context.rootHz) * octaveMulti
  }

  if (type === 'PitchRatio') {
    const { numerator, denominator, ups = 0, lifts = 0 } = pitch.value
    assertFinitePositive('PitchRatio.denominator', denominator)
    const fraction = { numerator, denominator }
    const ratio = pitch.value.tempered
      ? temperedRatioFractionToRatio(fraction, context)
      : ratioFractionToRatio(fraction)
    return ratio * Math.pow(up, ups) * Math.pow(lift, lifts) * octaveMulti
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
    const { degree, ups, lifts } = pitch.value
    const degreeRatio = pitchDegreeToRatio(degree, scale, octaveSize)
    return degreeRatio * Math.pow(up, ups) * Math.pow(lift, lifts) * octaveMulti
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

    return (
      centsToValue(steps * stepSize) *
      Math.pow(up, absolutePitch.ups - rootNominal.ups) *
      Math.pow(lift, absolutePitch.lifts - rootNominal.lifts)
    )
  }

  throw new Error(`Unknown pitch type "${type}"`)
}

const primeToIndex = (prime: number): number => {
  const index = PRIMES.indexOf(prime)
  if (index < 0 || index >= NUM_COMPONENTS) {
    throw new Error(`CustomMappingScale.anchor must be a supported prime, got ${prime}`)
  }
  return index
}

const customMappingToContext = (scale: CustomMappingScaleType, context: Context): void => {
  if (!scale.entries.length) throw new Error('CustomMappingScale.entries must not be empty')
  const firstUnit = scale.entries[0]!.unit
  if (scale.entries.some((entry) => entry.unit !== firstUnit)) {
    throw new Error('CustomMappingScale entries must all use the same unit')
  }

  if (firstUnit === 'cents') {
    if (scale.anchor !== null) {
      throw new Error('CustomMappingScale.anchor cannot be used with cent entries')
    }
    context.stepSize = 1
    context.mapping = PRIME_CENTS.slice(0, NUM_COMPONENTS)
    scale.entries.forEach((entry, index) => {
      context.mapping[index] = entry.value
    })
    context.mappingIsIntegerSteps = false
    return
  }

  const anchorIndex = scale.anchor === null ? 0 : primeToIndex(scale.anchor)
  const anchor = scale.entries[anchorIndex]
  if (!anchor) {
    throw new Error(
      `CustomMappingScale.anchor @${scale.anchor} requires at least ${anchorIndex + 1} mapping entries`,
    )
  }
  assertFinitePositive('CustomMappingScale.anchorEntry', anchor.value)
  context.stepSize = PRIME_CENTS[anchorIndex]! / anchor.value
  context.up = centsToValue(context.stepSize)
  context.lift = centsToValue(5 * context.stepSize)
  context.mapping = PRIME_CENTS.slice(0, NUM_COMPONENTS).map((c) =>
    Math.round(c / context.stepSize),
  )
  scale.entries.forEach((entry, index) => {
    context.mapping[index] = entry.value
  })
  context.mappingIsIntegerSteps = scale.entries.every((entry) => Number.isInteger(entry.value))
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

const GROOVE_NEUTRAL_VELOCITY = 0.5

const velocityMultiplierProp = (velocityMultiplier: number): { velocityMultiplier?: number } =>
  velocityMultiplier === 1 ? {} : { velocityMultiplier }

const mapGrooveBeat = (time: number, groove: Groove | null): number => {
  if (groove === null) return time
  const relativeTime = time - groove.sourceOrigin
  const cycle = Math.floor(relativeTime / groove.span)
  const sourceTime = mmod(relativeTime, groove.span)
  const points = groove.points

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (sourceTime >= a.source && sourceTime <= b.source) {
      const proportion = b.source === a.source ? 0 : (sourceTime - a.source) / (b.source - a.source)
      return (
        groove.targetOrigin + cycle * groove.span + a.target + proportion * (b.target - a.target)
      )
    }
  }

  return groove.targetOrigin + cycle * groove.span + sourceTime
}

const effectiveSubdivision = (context: Context, subdivision = context.subdivision): number =>
  subdivision * context.timeSignatureDenominator

const mapGrooveAccent = (time: number, groove: Groove | null): number => {
  if (groove === null || groove.accents.length === 0) return 1
  const relativeTime = time - groove.sourceOrigin
  const sourceTime = mmod(relativeTime, groove.span)
  const sourceStep = groove.span / groove.accents.length
  const index = Math.min(Math.floor(sourceTime / sourceStep), groove.accents.length - 1)
  return groove.accents[index] ?? 1
}

const setGroove = (setter: SetGrooveType, context: Context): void => {
  let subdivision = effectiveSubdivision(context)
  let time = 0
  let accent = 1
  const targets: number[] = []
  const accents: number[] = []

  for (const item of setter.items) {
    if (item.type === 'SetSubdivision') {
      assertFinitePositive('SetGroove.SetSubdivision.subdivision', item.subdivision)
      assertFinitePositive('SetGroove.SetSubdivision.denominator', item.denominator)
      subdivision = effectiveSubdivision(context, item.denominator / item.subdivision)
      assertFinitePositive('SetGroove.subdivision', subdivision)
      continue
    }

    if (item.type === 'SetVelocity') {
      limit('SetGroove.SetVelocity.velocity', item.velocity, 0, 4)
      accent = item.velocity / GROOVE_NEUTRAL_VELOCITY
      continue
    }

    if (item.type === 'SampleRateNote') {
      targets.push(time)
      accents.push(accent)
      time += (item.tail?.type === 'Hold' ? item.tail.length + 1 : 1) * subdivision
      accent = 1
      continue
    }

    if (item.type === 'Whitespace') continue

    throw new Error(`Unsupported groove item "${item.type}"`)
  }

  if (targets.length < 2) {
    throw new Error('Groove must contain at least two notes')
  }
  assertFinitePositive('SetGroove.span', time)

  const sourceStep = time / targets.length
  const targetOrigin = mapGrooveBeat(context.time, context.groove)
  context.groove = {
    sourceOrigin: context.time,
    targetOrigin,
    span: time,
    accents,
    points: [
      ...targets.map((target, index) => ({ source: index * sourceStep, target })),
      { source: time, target: time },
    ],
  }
}

const consumeDuration = (
  units: number,
  context: Context,
  articulation = 1,
): { time: number; timeEnd: number } => {
  const time = context.time
  assertFinitePositive('context.subdivision', context.subdivision)

  if (context.graceSubdivision !== null) {
    assertFinitePositive('context.graceSubdivision', context.graceSubdivision)
    const graceDuration = units * effectiveSubdivision(context, context.graceSubdivision)
    context.time += graceDuration
    context.stolenTime += graceDuration
    context.graceNotesRemaining -= 1
    if (context.graceNotesRemaining <= 0) {
      context.graceSubdivision = null
      context.graceNotesRemaining = 0
    }
    return {
      time: mapGrooveBeat(time, context.groove),
      timeEnd: mapGrooveBeat(time + graceDuration * articulation, context.groove),
    }
  }

  const duration = units * effectiveSubdivision(context) - context.stolenTime
  if (duration < 0) {
    throw new Error('Grace notes stole more time than the following item has')
  }

  context.time += duration
  context.stolenTime = 0
  return {
    time: mapGrooveBeat(time, context.groove),
    timeEnd: mapGrooveBeat(time + duration * articulation, context.groove),
  }
}

const markHoldTailBarlines = (tail: TailType | null, context: Context): void => {
  if (tail?.type !== 'Hold' || !Array.isArray(tail.parts)) return

  let position = 1
  const unitDuration = effectiveSubdivision(
    context,
    context.graceSubdivision ?? context.subdivision,
  )
  for (const part of tail.parts) {
    if (part.type === 'HoldDash') {
      position += 1
      continue
    }

    markBarlineSyntax(part, context, context.time + position * unitDuration)
  }
}

const tailToTime = (tail: TailType | null, context: Context): { time: number; timeEnd: number } => {
  markHoldTailBarlines(tail, context)
  const duration = tail?.type === 'Hold' ? tail.length + 1 : 1
  return consumeDuration(duration, context, context.articulation)
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
    const { numerator, denominator, ups = 0, lifts = 0 } = pitch.value
    const upDownPrefix = `${'^'.repeat(Math.max(0, ups))}${'v'.repeat(Math.max(0, -ups))}`
    const liftDropPrefix = `${'/'.repeat(Math.max(0, lifts))}${'\\'.repeat(Math.max(0, -lifts))}`
    return `${upDownPrefix}${liftDropPrefix}${pitch.value.tempered ? '~' : ''}${numerator}/${denominator}  ${centsLabel}`
  }

  if (type === 'PitchOctaveDivision') {
    const { numerator, denominator } = pitch.value
    return `${numerator}\\${denominator}  ${centsLabel}`
  }

  if (type === 'PitchDegree') {
    const { degree, ups, lifts } = pitch.value
    const [wrappedDegree] = pitchDegreeWrap(degree, context.scale)
    const upDownPrefix = `${'^'.repeat(Math.max(0, ups))}${'v'.repeat(Math.max(0, -ups))}`
    const liftDropPrefix = `${'/'.repeat(Math.max(0, lifts))}${'\\'.repeat(Math.max(0, -lifts))}`
    const baseLabel = context.scaleLabels[wrappedDegree]!
    if (ups === 0 && lifts === 0) {
      return baseLabel
    }
    const labelWithoutCents = baseLabel.includes('  ')
      ? baseLabel.slice(0, baseLabel.lastIndexOf('  '))
      : baseLabel
    return `${upDownPrefix}${liftDropPrefix}${labelWithoutCents}  ${centsLabel}`
  }

  if (type === 'PitchAbsolute') {
    if (pitch.value.nominalType === 'mos') {
      const { ups, lifts, nominal, accidentals } = pitch.value
      const { key } = normalizeMosNominal(nominal, context.mos!)
      const signature = context.mos!.keySignature.get(key) ?? EMPTY_MOS_KEY_SIGNATURE_ADJUSTMENT
      const undoKeyUpsAndLifts = hasNaturalAccidental(accidentals)
      const effectiveUps = ups + (undoKeyUpsAndLifts ? 0 : signature.ups)
      const effectiveLifts = lifts + (undoKeyUpsAndLifts ? 0 : signature.lifts)
      const effectiveAccidentals = accidentals.length ? accidentals : signature.accidentals
      const accidentalLabel = effectiveAccidentals.length
        ? effectiveAccidentals.map((accidental) => (accidental === '_' ? '♮' : accidental)).join('')
        : '♮'
      return `${'^'.repeat(Math.max(effectiveUps, 0))}${'v'.repeat(Math.max(-effectiveUps, 0))}${'/'.repeat(Math.max(effectiveLifts, 0))}${'\\'.repeat(Math.max(-effectiveLifts, 0))}${nominal}${accidentalLabel}  ${centsLabel}`
    }
    const { ups, lifts, nominal, accidentals, inflections } = pitch.value
    const keySignature = applyKeySignature(nominal, accidentals, context)
    const effectiveUps = ups + keySignature.ups
    const effectiveLifts = lifts + keySignature.lifts
    const effectiveInflections = [...keySignature.inflections, ...inflections]
    const absoluteLabel =
      (effectiveUps > 0 ? '^' : 'v').repeat(Math.abs(effectiveUps)) +
      (effectiveLifts > 0 ? '/' : '\\').repeat(Math.abs(effectiveLifts)) +
      normalizeNominal(nominal) +
      normalizeAccidentals(keySignature.accidentals).join('') +
      effectiveInflections
        .map(({ type, value, flavor }) => `${type === 'superscript' ? '^' : 'v'}${value}${flavor}`)
        .join('')
    return `${absoluteLabel}  ${centsLabel}`
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

type Context = {
  rootHz: number
  rootNominal: {
    monzo: Monzo
    ups: number
    lifts: number
  }
  time: number
  subdivision: number
  timeSignatureNumerator: number
  timeSignatureDenominator: number
  timeSignatureOrigin: number
  scale: number[]
  scaleLabels: string[]
  octaveSize: number
  up: number
  lift: number
  mapping: number[]
  stepSize: number
  mappingIsIntegerSteps: boolean
  mos: MosConfig | null
  keySignature: KeySignature
  graceSubdivision: number | null
  graceNotesRemaining: number
  stolenTime: number
  groove: Groove | null
  articulation: number
  glissando: GlissandoState | null
  volumeRamp: VolumeRampState | null
  queuedVolumeRamp: VolumeRampState | null
  tempoRamp: TempoRampState | null
  queuedTempoRamp: TempoRampState | null
}

type GlissandoState = {
  easing: EasingName
}

type VolumeRampSourceValue = {
  type: 'volume'
  db: number
  volumeAutomation?: Array<{ time: number; db: number; volumeInterpolation: EasingName }>
}

type VolumeRampSource = {
  time: number
  value: VolumeRampSourceValue
}

type VolumeRampState = {
  kind: 'cresc' | 'dim' | 'vramp'
  easing: EasingName
  source: VolumeRampSource | null
}

type TempoRampState = {
  kind: 'accel' | 'rall' | 'tramp'
  easing: EasingName
  source: MoscTempo | null
}

type Groove = {
  sourceOrigin: number
  targetOrigin: number
  span: number
  accents: number[]
  points: Array<{ source: number; target: number }>
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
    return {
      ...signature,
      ups: hasNaturalAccidental(accidentals) ? 0 : signature.ups,
      lifts: hasNaturalAccidental(accidentals) ? 0 : signature.lifts,
      accidentals,
      inflections: hasNaturalAccidental(accidentals) ? [] : signature.inflections,
    }
  }

  return signature
}

const times: [number, number][] = []

type MoscBeatPlayableNote = MoscBeatNote | MoscBeatSampleRateNote
type GlissandoGroup = {
  notes: MoscBeatNote[]
  easing: GlissandoState['easing'] | null
  remove: boolean
}

const tieLegatoGlissandi = (groups: GlissandoGroup[]): void => {
  groups.forEach((group, index) => {
    if (!group.easing) return

    const target = groups[index + 1]
    if (!target) {
      throw new Error(
        'Glissando has no compatible following target before the end of the sequence.',
      )
    }

    if (group.notes.length !== target.notes.length) {
      throw new Error(
        `Glissando chord voice count mismatch: source has ${group.notes.length}, target has ${target.notes.length}.`,
      )
    }

    group.notes.forEach((note, voiceIndex) => {
      const targetNote = target.notes[voiceIndex]!
      note.pitchAutomation = [
        ...(note.pitchAutomation ?? []),
        { time: note.timeEnd, hz: targetNote.hz, pitchInterpolation: group.easing! },
      ]
    })

    target.remove = true
  })

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index]!
    if (!group.remove) continue

    const source = groups[index - 1]
    if (!source) continue

    source.notes.forEach((note, voiceIndex) => {
      const targetNote = group.notes[voiceIndex]!
      if (targetNote.pitchAutomation?.length) {
        note.pitchAutomation = [...(note.pitchAutomation ?? []), ...targetNote.pitchAutomation]
      }
    })

    const sourceEnd = Math.max(...source.notes.map((note) => note.timeEnd))
    const targetEnd = Math.max(...group.notes.map((note) => note.timeEnd))
    if (targetEnd <= sourceEnd) continue

    source.notes.forEach((note) => {
      note.timeEnd = targetEnd
    })
  }
}

const noteToMosc = (note: NoteType, context: Context): MoscBeatNote[] => {
  const velocityMultiplier = mapGrooveAccent(context.time, context.groove)
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
      ...velocityMultiplierProp(velocityMultiplier),
      ...timeProps,
    },
  ]
}

const sampleRateNoteToMosc = (
  note: SampleRateNoteType,
  context: Context,
): MoscBeatSampleRateNote[] => {
  const velocityMultiplier = mapGrooveAccent(context.time, context.groove)
  const timeProps = tailToTime(note.tail, context)

  // mutate ast node to add time
  const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
  times.push(arr)
  note.time = arr

  return [
    {
      type: 'SAMPLE_RATE_NOTE_BEAT_TIME',
      label: 'sample rate',
      ...velocityMultiplierProp(velocityMultiplier),
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
  const velocityMultiplier = mapGrooveAccent(context.time, context.groove)
  const timeProps = tailToTime(tail, context)

  // mutate ast node to add time
  const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
  times.push(arr)
  chord.time = arr

  return expandChordPitchGroup(
    chordPitches,
    (pitch) => pitchToHz(pitch, context) / context.rootHz,
    (fraction) => temperedRatioFractionToRatio(fraction, context),
    (hasExplicitPreviousPitch) => chord.type === 'RatioChord' || !hasExplicitPreviousPitch,
  ).map((pitch): MoscBeatPlayableNote => {
    if (pitch.type === 'SampleRateNote') {
      return {
        type: 'SAMPLE_RATE_NOTE_BEAT_TIME',
        label: 'sample rate',
        ...velocityMultiplierProp(velocityMultiplier),
        ...timeProps,
      }
    }

    if (pitch.type === 'Pitch') {
      return {
        type: 'NOTE_BEAT_TIME',
        hz: pitch.ratio * context.rootHz,
        label: pitchToLabel(pitch.pitch, context),
        ...velocityMultiplierProp(velocityMultiplier),
        ...timeProps,
      }
    }

    const centsLabel = ratioToCentsLabel(pitch.ratio, context.octaveSize)
    const label = pitch.fraction
      ? `${pitch.tempered ? '~' : ''}${pitch.fraction.numerator}/${pitch.fraction.denominator}  ${centsLabel}`
      : centsLabel
    return {
      type: 'NOTE_BEAT_TIME',
      hz: pitch.ratio * context.rootHz,
      label,
      ...velocityMultiplierProp(velocityMultiplier),
      ...timeProps,
    }
  })
}

const pointTime = (
  item: NoteType | SampleRateNoteType | ChordType | RatioChordType,
  context: Context,
): [number, number] => {
  const mappedTime = mapGrooveBeat(context.time, context.groove)
  const arr: [number, number] = [mappedTime, mappedTime]
  times.push(arr)
  item.time = arr
  return arr
}

const playableToMoscAtCurrentTime = (
  item: NoteType | SampleRateNoteType | ChordType | RatioChordType,
  context: Context,
): MoscBeatPlayableNote[] => {
  const startTime = context.time
  const mappedStartTime = mapGrooveBeat(startTime, context.groove)
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
    time: mappedStartTime,
    timeEnd: mappedStartTime,
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
          ups: 0,
          lifts: 0,
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
        (fraction) => temperedRatioFractionToRatio(fraction, context),
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
            ? `${pitch.tempered ? '~' : ''}${pitch.fraction.numerator}/${pitch.fraction.denominator}  ${centsLabel}`
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
    context.up = centsToValue(context.stepSize)
    context.lift = centsToValue(5 * context.stepSize)
    context.mapping = PRIME_CENTS.slice(0, NUM_COMPONENTS).map((c) =>
      Math.round(c / context.stepSize),
    )
    context.mappingIsIntegerSteps = true
    return
  }

  if (type === 'CustomMappingScale') {
    customMappingToContext(scale, context)
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

const volumeParam = (time: number, db: number): MoscBeatParam & VolumeRampSource => ({
  type: 'PARAM_BEAT_TIME',
  time,
  value: {
    type: 'volume',
    db,
  },
})

const tempoParam = (time: number, bpm: number): MoscTempo => ({
  type: 'TEMPO',
  time,
  bpm,
  tempoInterpolation: 'constant',
})

const tempoRampToMosc = (bpm: number, context: Context): MoscTempo[] => {
  const ramp = context.tempoRamp
  const item = tempoParam(mapGrooveBeat(context.time, context.groove), bpm)
  if (!ramp) return [item]

  if (!ramp.source) {
    ramp.source = item
    return [item]
  }

  const sourceBpm = ramp.source.bpm
  if (ramp.kind === 'accel' && bpm < sourceBpm) {
    throw new Error('Accelerando target tempo must be greater than or equal to its starting tempo.')
  }
  if (ramp.kind === 'rall' && bpm > sourceBpm) {
    throw new Error('Rallentando target tempo must be less than or equal to its starting tempo.')
  }

  context.tempoRamp = context.queuedTempoRamp
  context.queuedTempoRamp = null
  item.tempoInterpolation = ramp.easing

  if (context.tempoRamp) {
    context.tempoRamp.source = item
  }

  return [item]
}

const volumeRampToMosc = (db: number, context: Context): MoscBeatParam[] => {
  const ramp = context.volumeRamp
  const time = mapGrooveBeat(context.time, context.groove)
  const item = volumeParam(time, db)
  if (!ramp) return [item]

  if (!ramp.source) {
    ramp.source = item
    return [item]
  }

  const sourceDb = ramp.source.value.db
  if (ramp.kind === 'cresc' && db < sourceDb) {
    throw new Error('Crescendo target volume must be greater than or equal to its starting volume.')
  }
  if (ramp.kind === 'dim' && db > sourceDb) {
    throw new Error('Diminuendo target volume must be less than or equal to its starting volume.')
  }

  context.volumeRamp = context.queuedVolumeRamp
  context.queuedVolumeRamp = null
  ramp.source.value.volumeAutomation = [
    ...(ramp.source.value.volumeAutomation ?? []),
    { time, db, volumeInterpolation: ramp.easing },
  ]

  if (context.volumeRamp) {
    context.volumeRamp.source = item
    return [item]
  }

  return []
}

const setterToMosc = (setter: SetterType | DelimiterType, context: Context): MoscBeatItem[] => {
  const { type, delimiter } = setter

  if (delimiter) return []

  if (type === 'SetBpm') {
    const { bpm } = setter
    assertFinitePositive('SetBpm.bpm', bpm)
    return tempoRampToMosc(bpm, context)
  }

  if (type === 'SetBms') {
    const { bms } = setter
    assertFinitePositive('SetBms.bms', bms)
    return tempoRampToMosc(60000 / bms, context)
  }

  if (type === 'SetTime') {
    const { numerator, denominator } = setter
    if (numerator < 0 || !Number.isFinite(numerator))
      throw new Error('SetTime.numerator must be finite and non-negative.')
    assertFinitePositive('SetTime.denominator', denominator)
    context.timeSignatureNumerator = numerator
    context.timeSignatureDenominator = denominator
    context.timeSignatureOrigin = context.time
    return []
  }

  if (type === 'SetGroove') {
    setGroove(setter, context)
    return []
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

  if (type === 'SetTempoRamp') {
    const easing = setter.easing.toLowerCase()
    if (!isEasingName(easing)) {
      throw new Error(`Unknown tempo ramp easing: ${setter.easing}.`)
    }
    const ramp = {
      kind: setter.kind,
      easing,
      source: null,
    }

    if (!context.tempoRamp) {
      context.tempoRamp = ramp
      return []
    }

    if (context.tempoRamp.source && !context.queuedTempoRamp) {
      context.queuedTempoRamp = ramp
      return []
    }

    throw new Error('Tempo ramp setter used before the previous tempo ramp found a target tempo.')
  }

  if (type === 'SetVolumeRamp') {
    const easing = setter.easing.toLowerCase()
    if (!isEasingName(easing)) {
      throw new Error(`Unknown volume ramp easing: ${setter.easing}.`)
    }
    const ramp = {
      kind: setter.kind,
      easing,
      source: null,
    }

    if (!context.volumeRamp) {
      context.volumeRamp = ramp
      return []
    }

    if (context.volumeRamp.source && !context.queuedVolumeRamp) {
      context.queuedVolumeRamp = ramp
      return []
    }

    throw new Error(
      'Volume ramp setter used before the previous volume ramp found a target volume.',
    )
  }

  if (type === 'SetGliss') {
    if (context.glissando) {
      throw new Error('Glissando setter used before the previous glissando found a target.')
    }
    const easing = setter.easing.toLowerCase()
    if (!isEasingName(easing)) {
      throw new Error(`Unknown glissando easing: ${setter.easing}.`)
    }
    context.glissando = { easing }
    return []
  }

  if (type === 'SetArticulation') {
    const { articulation } = setter
    limit('SetArticulation.articulation', articulation, 0, 4)
    context.articulation = articulation
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
    context.up = pitchToRatio(setter.value, context)
    return []
  }

  if (type === 'SetLift') {
    context.lift = pitchToRatio(setter.value, context)
    return []
  }

  if (type === 'SetOsc') {
    const { osc } = setter
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: mapGrooveBeat(context.time, context.groove),
        value: {
          type: 'osc',
          osc,
        },
      },
    ]
  }

  if (type === 'SetNoise') {
    const { noise, interpolation } = setter
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: mapGrooveBeat(context.time, context.groove),
        value: {
          type: 'noise',
          noise,
          interpolation: interpolation ?? 'constant',
        },
      },
    ]
  }

  if (type === 'SetEnv') {
    const { a, d, s, r } = setter
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: mapGrooveBeat(context.time, context.groove),
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
    return volumeRampToMosc(db, context)
  }

  if (type === 'SetVelocity') {
    const { velocity } = setter
    limit('SetVelocity.velocity', velocity, 0, 4)
    return [
      {
        type: 'PARAM_BEAT_TIME',
        time: mapGrooveBeat(context.time, context.groove),
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

  if (type === 'SetSignature') {
    const mosItems = setter.items.filter(
      (item): item is MosKeyTonicType => item.nominalType === 'mos',
    )
    if (mosItems.length) {
      if (!context.mos) throw new Error('MOS signature used before a MOS declaration.')
      if (mosItems.length !== setter.items.length) {
        throw new Error('MOS signatures cannot mix MOS and Pythagorean nominals.')
      }
      context.mos.keySignature = mosKeySignatureFromPitches(mosItems, context.mos)
    } else {
      context.keySignature = keySignatureFromPitches(
        setter.items.filter((item): item is KeyTonicType => item.nominalType !== 'mos'),
      )
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

const LATIN_NOMINALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const GREEK_NOMINALS = ['Gam', 'Del', 'Eps', 'Zet', 'Eta', 'Alp', 'Bet']

const PLOT_LOCATION = {
  source: undefined,
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
}

const nominalPlotPitches = (nominalType: PlotNominalType, context: Context): PitchType[] => {
  const nominals =
    nominalType === 'mos'
      ? (context.mos?.nominalOrder ?? [])
      : nominalType === 'greek'
        ? GREEK_NOMINALS
        : LATIN_NOMINALS

  return nominals.map((nominal) => ({
    type: 'Pitch',
    delimiter: false,
    location: PLOT_LOCATION,
    octave: null,
    value: {
      type: 'PitchAbsolute',
      delimiter: false,
      location: PLOT_LOCATION,
      ups: 0,
      lifts: 0,
      nominal,
      nominalType,
      accidentals: [],
      inflections: [],
    },
  }))
}

const replaceCentsLabel = (label: string, cents: number): string => {
  const centsLabel = `${cents.toFixed(1)}c`
  const separator = label.lastIndexOf('  ')
  if (separator < 0) return `${label}  ${centsLabel}`
  return `${label.slice(0, separator)}  ${centsLabel}`
}

const nominalPlotToMosc = (nominalType: PlotNominalType, context: Context): MoscNote[] => {
  const pitches = nominalPlotPitches(nominalType, context)
  if (!pitches.length) return []

  const notes = pitches.map((pitch): MoscNote => {
    const ratio = geoMod(pitchToRatio(pitch, context), context.octaveSize)
    const cents = valueToCents(ratio)

    return {
      type: 'NOTE_TIME',
      time: mapGrooveBeat(context.time, context.groove),
      timeEnd: mapGrooveBeat(context.time, context.groove),
      hz: ratio * context.rootHz,
      label: replaceCentsLabel(pitchToLabel(pitch, context), cents),
    }
  })

  return notes
}

const setterToRulerState = (
  initial: BuildingInitialRulerState,
  setter: SetterType | DelimiterType,
  context: Context,
): BuildingInitialRulerState => {
  const { type, delimiter } = setter

  if (delimiter) return initial

  if (type === 'SetRulerPlot') {
    const newPlot = setter.nominalType
      ? nominalPlotToMosc(setter.nominalType, context)
      : context.scale.map(
          (ratio, i): MoscNote => ({
            type: 'NOTE_TIME',
            time: mapGrooveBeat(context.time, context.groove),
            timeEnd: mapGrooveBeat(context.time, context.groove),
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

const BARLINE_EPSILON = 1e-9

const isBarlineSyntaxItem = (item: { type: string }): item is DelimiterType | RepeatType =>
  item.type === 'BarLine' ||
  item.type === 'RepeatStart' ||
  item.type === 'RepeatEnd' ||
  item.type === 'RepeatEndStart' ||
  item.type === 'RepeatEndingStart'

const markBarlineSyntax = (
  item: DelimiterType | RepeatType,
  context: Context,
  sourceTime = context.time,
): void => {
  const mappedTime = mapGrooveBeat(sourceTime, context.groove)
  item.time = [mappedTime, mappedTime]
  times.push(item.time)

  if (context.timeSignatureNumerator === 0) return

  const measureLength = context.timeSignatureNumerator
  assertFinitePositive('time signature measure length', measureLength)
  const relativeTime = sourceTime - context.timeSignatureOrigin
  const measures = relativeTime / measureLength
  const nearestMeasure = Math.round(measures)
  if (Math.abs(measures - nearestMeasure) > BARLINE_EPSILON) {
    item.barlineSyntaxError = true
  }
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
    tempoInterpolation: 'constant',
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
    timeSignatureNumerator: 0,
    timeSignatureDenominator: 1,
    timeSignatureOrigin: 0,
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
    groove: null,
    articulation: 1,
    glissando: null,
    volumeRamp: null,
    queuedVolumeRamp: null,
    tempoRamp: null,
    queuedTempoRamp: null,
  }

  const moscItems: MoscBeatItem[] = []
  const glissandoGroups: GlissandoGroup[] = []
  let activeDroneItems: MoscBeatPlayableNote[] = []
  let activeDroneTimes: [number, number][] = []
  const stopActiveDrone = (): void => {
    activeDroneItems.forEach((droneItem) => {
      droneItem.timeEnd = mapGrooveBeat(context.time, context.groove)
    })
    activeDroneTimes.forEach((time) => {
      time[1] = mapGrooveBeat(context.time, context.groove)
    })
    activeDroneItems = []
    activeDroneTimes = []
  }
  let initialRulerState: BuildingInitialRulerState = {
    plots: [],
  }
  const registerGlissandoGroup = (sourceItems: MoscBeatPlayableNote[]): void => {
    const notes = sourceItems.filter(
      (moscItem): moscItem is MoscBeatNote => moscItem.type === 'NOTE_BEAT_TIME',
    )
    if (!notes.length) return
    glissandoGroups.push({
      notes,
      easing: context.glissando?.easing ?? null,
      remove: false,
    })
    context.glissando = null
  }

  grammarSequence.items.forEach((item): void => {
    const { type } = item
    if (isBarlineSyntaxItem(item)) {
      markBarlineSyntax(item, context)
      return
    }

    if (
      type === 'Comment' ||
      type === 'Whitespace' ||
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
      const items = noteToMosc(item, context)
      registerGlissandoGroup(items)
      moscItems.push(...items)
      initialRulerState = rulerStateCaptureRootHz(initialRulerState, context)
      return
    }

    if (type === 'SampleRateNote') {
      moscItems.push(...sampleRateNoteToMosc(item, context))
      return
    }

    if (type === 'Rest') {
      if (context.glissando) throw new Error('Glissando cannot target a rest.')
      const previousGlissandoSource = glissandoGroups[glissandoGroups.length - 1]
      if (previousGlissandoSource?.easing) {
        throw new Error('Glissando target lookup was stopped by a rest.')
      }
      const rest = item
      const timeProps = consumeDuration(rest.length, context)
      // mutate ast node to add time
      const arr: [number, number] = [timeProps.time, timeProps.timeEnd]
      times.push(arr)
      rest.time = arr
      return
    }

    if (type === 'Chord') {
      const items = chordToMosc(item, context)
      registerGlissandoGroup(items)
      moscItems.push(...items)
      return
    }

    if (type === 'RatioChord') {
      const items = chordToMosc(item, context)
      registerGlissandoGroup(items)
      moscItems.push(...items)
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

  if (context.glissando) {
    throw new Error('Glissando has no compatible following target before the end of the sequence.')
  }

  const incompleteTempoRamp = context.tempoRamp ?? context.queuedTempoRamp
  if (incompleteTempoRamp) {
    throw new Error(
      incompleteTempoRamp.source
        ? 'Tempo ramp has no target tempo before the end of the sequence.'
        : 'Tempo ramp has no source tempo before the end of the sequence.',
    )
  }

  const incompleteVolumeRamp = context.volumeRamp ?? context.queuedVolumeRamp
  if (incompleteVolumeRamp) {
    throw new Error(
      incompleteVolumeRamp.source
        ? 'Volume ramp has no target volume before the end of the sequence.'
        : 'Volume ramp has no source volume before the end of the sequence.',
    )
  }

  tieLegatoGlissandi(glissandoGroups)
  glissandoGroups.forEach((group) => {
    if (!group.remove) return
    group.notes.forEach((note) => {
      const index = moscItems.indexOf(note)
      if (index >= 0) moscItems.splice(index, 1)
    })
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
      time: mapGrooveBeat(context.time, context.groove),
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
