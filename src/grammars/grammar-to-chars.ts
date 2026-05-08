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
}

type GrammarLocation = {
  start?: {
    offset?: number
  }
  end?: {
    offset?: number
  }
}

type GrammarNode = {
  type?: string
  len?: number
  time?: [number, number]
  location?: GrammarLocation
  [key: string]: unknown
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
  ['RatioChordPitch', 'pitch'],
  ['Chord', 'chord'],
  ['Chord.Whitespace', 'pitch'],
  // ['RatioChord'],
  ['Hold', 'pitch'],
  ['Rest', 'delimiter'],
  ['BarLine', 'delimiter'],
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
  ['SetEnv', 'setter'],
  ['SetRulerPlot', 'setter'],
  ['SetRulerRange', 'setter'],
  ['SetRulerRange.Pitch', 'setter'],
  ['SetterGroup', 'setterGroup'],
  ['SetterGroup.Semicolon', 'setterGroup'],
  ['Comment', 'comment'],
])

const getSpan = (data: GrammarNode): { pos: number; len: number } | undefined => {
  const pos = typeof data.pos === 'number' ? data.pos : data.location?.start?.offset
  if (typeof pos !== 'number') return undefined

  if (typeof data.len === 'number') return { pos, len: data.len }

  const end = data.location?.end?.offset
  if (typeof end === 'number') return { pos, len: end - pos }

  return undefined
}

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
    const node = data as GrammarNode
    const color = node.type
      ? colorMap.get(`${parent}.${node.type}`) || colorMap.get(node.type)
      : undefined
    const time = withinTime ?? node.time
    const span = getSpan(node)

    if (span && color) {
      for (let i = 0; i < span.len; i++) {
        chars[span.pos + i] = {
          color: color === 'comment' && i === 0 ? 'commentStart' : color,
          playTime: time,
        }
      }
    }
    Object.keys(node).forEach((key) => {
      extract(chars, node[key], node.type ?? parent, time)
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
