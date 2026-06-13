import type { LocationRange } from 'peggy'
import type { XenpaperAST } from './grammar.generated'

export type HighlightColor =
  | 'delimiter'
  | 'pitch'
  | 'chord'
  | 'scaleGroup'
  | 'scale'
  | 'setterGroup'
  | 'setter'
  | 'comment'
  | 'commentStart'
  | 'unknown'
  | 'error'
  | 'errorMessage'

export type CharData = {
  color: HighlightColor
  playTime?: [number, number]
  playTimes?: [number, number][]
}

type GrammarNode = {
  type: string
  time?: [number, number]
  location: LocationRange
  [key: string]: unknown
}

const isGrammarNode = (data: unknown): data is GrammarNode =>
  data instanceof Object &&
  typeof (data as Partial<GrammarNode>).type === 'string' &&
  typeof (data as Partial<GrammarNode>).location?.start.offset === 'number' &&
  typeof (data as Partial<GrammarNode>).location?.end.offset === 'number'

const isSamePlayTime = (a: [number, number], b: [number, number]): boolean =>
  a[0] === b[0] && a[1] === b[1]

const appendPlayTime = (
  existing: CharData | undefined,
  time: [number, number] | undefined,
): [number, number][] | undefined => {
  if (!time) return existing?.playTimes

  const existingPlayTimes = existing?.playTimes ?? (existing?.playTime ? [existing.playTime] : [])
  if (existingPlayTimes.some((playTime) => isSamePlayTime(playTime, time))) {
    return existing?.playTimes
  }

  if (existingPlayTimes.length > 0) return [...existingPlayTimes, time]

  return undefined
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
  ['PitchGroupScale', 'scale'],
  ['PitchGroupScale.Pitch', 'scale'],
  ['PitchGroupScale.Whitespace', 'scale'],
  ['PitchGroupScalePrefix', 'scale'],
  ['RatioChordScale', 'scale'],
  ['RatioChordScale.RatioChordPitch', 'scale'],
  ['RatioChordScale.Colon', 'scale'],
  ['ScaleOctaveMarker', 'scale'],
  ['SetScale', 'scaleGroup'],
  ['SetRoot', 'scaleGroup'],
  ['SetRoot.Pitch', 'scale'],
  ['SetBpm', 'setter'],
  ['SetBms', 'setter'],
  ['SetSubdivision', 'setter'],
  ['SetOsc', 'setter'],
  ['SetNoise', 'setter'],
  ['SetEnv', 'setter'],
  ['SetRulerPlot', 'setter'],
  ['SetRulerRange', 'setter'],
  ['SetRulerRange.Pitch', 'setter'],
  ['SetterGroup', 'setterGroup'],
  ['SetterGroup.Semicolon', 'setterGroup'],
  ['Comment', 'comment'],
])

// need to pass playhead time in
const extract = (
  chars: CharData[],
  data: unknown,
  parent: string,
  withinTime?: [number, number],
): void => {
  if (Array.isArray(data)) {
    data.forEach((value) => extract(chars, value, parent, withinTime))
    return
  }
  if (data instanceof Object) {
    const node = data as Record<string, unknown>
    const grammarNode = isGrammarNode(node) ? node : undefined
    const type = grammarNode?.type
    const color = type ? colorMap.get(`${parent}.${type}`) || colorMap.get(type) : undefined
    const time = withinTime ?? grammarNode?.time

    if (grammarNode && color) {
      const startOffset = grammarNode.location.start.offset
      const endOffset = grammarNode.location.end.offset
      for (let offset = startOffset; offset < endOffset; offset++) {
        const existing = chars[offset]
        const playTimes = appendPlayTime(existing, time)

        chars[offset] = {
          color: color === 'comment' && offset === startOffset ? 'commentStart' : color,
          playTime: existing?.playTime ?? time,
          ...(playTimes ? { playTimes } : {}),
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
