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
  let canStackRatioChord = true

  const addRatioPitchType = (
    ratio: number,
    fraction: RatioFraction | null,
    tempered = false,
  ): void => {
    if (tempered && fraction) {
      ratio = temperRatioFraction(fraction)
    }
    result.push({ type: 'RatioChordPitch', ratio, fraction, tempered })
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
              pitch.tempered,
            )
          }
        }

        if (!isFirstPitch || !hasExplicitPreviousPitch) {
          addRatioPitchType(
            basePitchRatio *
              (inverted ? firstDenominator / numerator : numerator / firstDenominator),
            createFraction(numerator),
            pitch.tempered,
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
