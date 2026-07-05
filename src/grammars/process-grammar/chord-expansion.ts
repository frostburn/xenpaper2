import { gcd } from 'xen-dev-utils/fraction'

import type {
  DelimiterType,
  PitchType,
  RatioChordPitchType,
  SampleRateNoteType,
} from '../grammar.generated'

import { assertFinitePositive } from './validation'

export type ChordPitchType = PitchType | SampleRateNoteType | RatioChordPitchType | DelimiterType

export const isPitchType = (pitch: ChordPitchType): pitch is PitchType => {
  return pitch.type === 'Pitch'
}

const isRatioChordPitchType = (pitch: ChordPitchType): pitch is RatioChordPitchType => {
  return pitch.type === 'RatioChordPitch'
}

const isSampleRateNoteType = (pitch: ChordPitchType): pitch is SampleRateNoteType => {
  return pitch.type === 'SampleRateNote'
}

const startsRatioChordSegment = (pitches: ChordPitchType[], index: number): boolean => {
  const pitch = pitches[index]
  if (isRatioChordPitchType(pitch!)) return true
  if (pitch?.type === 'InversionPrefix') return isRatioChordPitchType(pitches[index + 1]!)
  if (pitch?.type === 'TemperedPrefix') return startsRatioChordSegment(pitches, index + 1)
  return false
}

export type RatioFraction = { numerator: number; denominator: number }

type ExpandedChordPitch =
  | { type: 'Pitch'; pitch: PitchType; ratio: number; fraction: RatioFraction | null }
  | { type: 'SampleRateNote'; pitch: SampleRateNoteType }
  | { type: 'RatioChordPitch'; ratio: number; fraction: RatioFraction | null; tempered: boolean }

const pitchRatioFraction = (pitch: PitchType): RatioFraction | null =>
  pitch.value.type === 'PitchRatio'
    ? { numerator: pitch.value.numerator, denominator: pitch.value.denominator }
    : null

export const expandChordPitchGroup = (
  chordPitches: ChordPitchType[],
  getPitchRatio: (pitch: PitchType) => number,
  temperRatioFraction: (fraction: RatioFraction) => number,
  preserveLeadingRatioChordLabel: (hasExplicitPreviousPitch: boolean) => boolean,
): ExpandedChordPitch[] => {
  const result: ExpandedChordPitch[] = []
  let previousPitchRatio = 1
  let previousPitchFraction: RatioFraction | null = {
    numerator: 1,
    denominator: 1,
  }
  let previousPitchTempered = false
  let previousPitchCanLabelFraction = true
  let canStackRatioChord = true

  const addRatioPitchType = (
    ratio: number,
    fraction: RatioFraction | null,
    tempered = false,
    labelFraction = fraction,
  ): void => {
    result.push({
      type: 'RatioChordPitch',
      ratio,
      fraction: labelFraction,
      tempered,
    })
    previousPitchRatio = ratio
    previousPitchFraction = fraction
    previousPitchTempered = tempered
    previousPitchCanLabelFraction = labelFraction !== null
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
    const basePitchTempered = previousPitchTempered
    const basePitchCanLabelFraction = previousPitchCanLabelFraction
    const preserveFirstRatioLabel = preserveLeadingRatioChordLabel(hasExplicitPreviousPitch)
    let colons = 0
    let lastNumerator = 1
    let isFirstPitch = true

    const createIntervalRatio = (numerator: number, tempered: boolean): number => {
      const intervalFraction = {
        numerator: inverted ? firstDenominator : numerator,
        denominator: inverted ? numerator : firstDenominator,
      }
      return tempered
        ? temperRatioFraction(intervalFraction)
        : intervalFraction.numerator / intervalFraction.denominator
    }

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
        const pitchTempered = !!pitch.tempered
        assertFinitePositive('Ratio numerator', numerator)

        if (colons === 2) {
          const step = Math.sign(numerator - lastNumerator)
          while (step !== 0 && lastNumerator + step !== numerator) {
            lastNumerator += step
            addRatioPitchType(
              basePitchRatio * createIntervalRatio(lastNumerator, pitchTempered),
              createFraction(lastNumerator),
              pitchTempered,
              !hasExplicitPreviousPitch ||
                (basePitchCanLabelFraction && basePitchTempered === pitchTempered)
                ? createFraction(lastNumerator)
                : null,
            )
          }
        }

        if (!isFirstPitch || !hasExplicitPreviousPitch) {
          addRatioPitchType(
            basePitchRatio * createIntervalRatio(numerator, pitchTempered),
            createFraction(numerator),
            pitchTempered,
            !hasExplicitPreviousPitch ||
              (basePitchCanLabelFraction && basePitchTempered === pitchTempered)
              ? createFraction(numerator)
              : null,
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
        previousPitchTempered = pitch.value.type === 'PitchRatio' && !!pitch.value.tempered
        previousPitchCanLabelFraction = pitchRatioFraction(pitch) !== null
        canStackRatioChord = true
      } else {
        result.push({ type: 'SampleRateNote', pitch })
        previousPitchTempered = false
        previousPitchCanLabelFraction = false
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
