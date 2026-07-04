import type { LocationRange } from 'peggy'
import type { XenpaperAST } from './grammar.generated'

export type HighlightColor =
  | 'delimiter'
  | 'pitch'
  | 'alternatePitch'
  | 'invalidPitch'
  | 'invalidAlternatePitch'
  | 'chord'
  | 'scaleGroup'
  | 'scale'
  | 'mosGroup'
  | 'mos'
  | 'setterGroup'
  | 'setter'
  | 'comment'
  | 'commentStart'
  | 'unknown'
  | 'error'
  | 'errorMessage'

export type PlayTime = [number, number]

export type CharData = {
  color: HighlightColor
  playTimes: PlayTime[]
}

type GrammarNode = {
  type: string
  time?: PlayTime
  value?: { nominalType?: 'latin' | 'greek' | 'mos' }
  outOfIntegerSteps?: boolean
  location: LocationRange
  [key: string]: unknown
}

const isGrammarNode = (data: unknown): data is GrammarNode =>
  data instanceof Object &&
  typeof (data as Partial<GrammarNode>).type === 'string' &&
  typeof (data as Partial<GrammarNode>).location?.start.offset === 'number' &&
  typeof (data as Partial<GrammarNode>).location?.end.offset === 'number'

const isSamePlayTime = (a: PlayTime, b: PlayTime): boolean => a[0] === b[0] && a[1] === b[1]

const appendPlayTime = (existing: CharData | undefined, time: PlayTime | undefined): PlayTime[] => {
  const existingPlayTimes = existing?.playTimes ?? []
  if (!time || existingPlayTimes.some((playTime) => isSamePlayTime(playTime, time))) {
    return existingPlayTimes
  }

  return [...existingPlayTimes, time]
}

const colorMap = new Map<string, HighlightColor>([
  ['Semicolon', 'delimiter'],
  ['Colon', 'delimiter'],
  // ['PitchCents', 'pitch'],
  // ['PitchOctaveDivision', 'pitch'],
  // ['PitchRatio', 'pitch'],
  // ['PitchDegree', 'pitch'],
  // ['PitchHz', 'pitch'],
  // ['OctaveModifier', 'pitch'],
  ['Pitch', 'pitch'],
  ['SampleRateNote', 'pitch'],
  ['InversionPrefix', 'delimiter'],
  ['TemperedPrefix', 'delimiter'],
  ['RatioChordPitch', 'pitch'],
  ['Chord', 'chord'],
  ['Chord.Whitespace', 'pitch'],
  // ['RatioChord'],
  ['Hold', 'pitch'],
  ['Rest', 'delimiter'],
  ['BarLine', 'delimiter'],
  ['RepeatStart', 'delimiter'],
  ['RepeatEnd', 'delimiter'],
  ['RepeatEndStart', 'delimiter'],
  ['RepeatEndingStart', 'delimiter'],
  ['Whitespace', 'delimiter'],
  ['EdoScale', 'scale'],
  ['PythagoreanScale', 'scale'],
  ['CustomMappingScale', 'scale'],
  ['PitchGroupScale', 'scale'],
  ['PitchGroupScale.Pitch', 'scale'],
  ['PitchGroupScale.RatioChordPitch', 'scale'],
  ['PitchGroupScale.Colon', 'scale'],
  ['PitchGroupScale.InversionPrefix', 'scale'],
  ['PitchGroupScale.Whitespace', 'scale'],
  ['PitchGroupScalePrefix', 'scale'],
  ['ScaleOctaveMarker', 'scale'],
  ['SetScale', 'scaleGroup'],
  ['SetMos', 'mosGroup'],
  ['SetMos.MosExpression', 'mos'],
  ['SetKey', 'scale'],
  ['SetSignature', 'scale'],
  ['SetRoot', 'scaleGroup'],
  ['SetRoot.Pitch', 'scale'],
  ['SetRoot.PitchAbsolute', 'scale'],
  ['SetBpm', 'setter'],
  ['SetBms', 'setter'],
  ['SetSubdivision', 'setter'],
  ['SetGrace', 'setter'],
  ['SetGroove', 'setter'],
  ['SetUp', 'setter'],
  ['SetLift', 'setter'],
  ['SetOsc', 'setter'],
  ['SetNoise', 'setter'],
  ['SetEnv', 'setter'],
  ['SetVolume', 'setter'],
  ['SetVelocity', 'setter'],
  ['SetRulerPlot', 'setter'],
  ['SetRulerRange', 'setter'],
  ['SetRulerRange.Pitch', 'setter'],
  ['Drone', 'setter'],
  ['SetterGroup', 'setterGroup'],
  ['SetterGroup.Semicolon', 'setterGroup'],
  ['Comment', 'comment'],
])

// need to pass playhead time in
const extract = (chars: CharData[], data: unknown, parent: string, withinTime?: PlayTime): void => {
  if (Array.isArray(data)) {
    data.forEach((value) => extract(chars, value, parent, withinTime))
    return
  }
  if (data instanceof Object) {
    const node = data as Record<string, unknown>
    const grammarNode = isGrammarNode(node) ? node : undefined
    const type = grammarNode?.type
    let color = type ? colorMap.get(`${parent}.${type}`) || colorMap.get(type) : undefined
    if (type === 'Pitch' && grammarNode?.outOfIntegerSteps) {
      color = grammarNode?.value?.nominalType === 'greek' ? 'invalidAlternatePitch' : 'invalidPitch'
    } else if (type === 'Pitch' && grammarNode?.value?.nominalType === 'greek') {
      color = 'alternatePitch'
    }
    const time = withinTime ?? grammarNode?.time

    if (grammarNode && color) {
      const startOffset = grammarNode.location.start.offset
      const endOffset = grammarNode.location.end.offset
      for (let offset = startOffset; offset < endOffset; offset++) {
        const existing = chars[offset]
        const playTimes = appendPlayTime(existing, time)

        chars[offset] = {
          color: color === 'comment' && offset === startOffset ? 'commentStart' : color,
          playTimes,
        }
      }
    }
    Object.keys(node).forEach((key) => {
      extract(chars, node[key], type ?? parent, time)
    })
  }
}

export const grammarToChars = ({ sequence }: XenpaperAST): CharData[] => {
  if (!sequence) return []
  const { items } = sequence
  const chars: CharData[] = []
  extract(chars, items ?? [], '')
  return chars
}
