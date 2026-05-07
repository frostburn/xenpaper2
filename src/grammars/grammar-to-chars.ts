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
}

type GrammarNode = {
  type?: string
  len?: number
  time?: [number, number]
  location?: GrammarLocation
  [key: string]: unknown
}

export type XenpaperAST = {
  sequence?: {
    items?: unknown[]
  }
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

const getPosition = (data: GrammarNode): number | undefined => {
  if (typeof data.pos === 'number') return data.pos
  return data.location?.start?.offset
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
    const pos = getPosition(node)

    if (typeof pos === 'number' && typeof node.len === 'number' && color) {
      for (let i = 0; i < node.len; i++) {
        chars[pos + i] = {
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
