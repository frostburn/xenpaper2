import type { LocationRange } from 'peggy'

export type NodeType = {
  type: string
  delimiter: boolean
  len: number
  time?: [number, number]
  location: LocationRange
}

//
// delimiters and whitespace
//

export type DelimiterType = NodeType & {
  delimiter: true
}

//
// pitches
//

type OctaveModifierType = NodeType & {
  octave: number
}

export type PitchCentsType = NodeType & {
  cents: number
}

export type PitchOctaveDivisionType = NodeType & {
  numerator: number
  denominator: number
  octaveSize: number
}

export type PitchRatioType = NodeType & {
  numerator: number
  denominator: number
}

export type PitchDegreeType = NodeType & {
  degree: number
}

export type PitchHzType = NodeType & {
  hz: number
}

export type PitchType = NodeType & {
  value: PitchCentsType | PitchOctaveDivisionType | PitchRatioType | PitchDegreeType | PitchHzType
  octave?: OctaveModifierType
}

export type PitchGroupType = Array<PitchType | DelimiterType>

//
// note
//

export type HoldType = NodeType & {
  length: number
}

export type TailType = HoldType

export type RestType = NodeType & {
  length: number
}

export type NoteType = NodeType & {
  pitch: PitchType
  tail?: TailType
}

//
// chords
//

export type RatioChordPitchType = NodeType & {
  pitch: number
}

export type RatioChordPitchGroupType = Array<RatioChordPitchType | DelimiterType>

export type ChordType = NodeType & {
  pitches: Array<RatioChordPitchType | PitchType | DelimiterType>
  tail?: TailType
}

export type RatioChordType = NodeType & {
  pitches: Array<RatioChordPitchType>
  tail?: TailType
}

//
// scales
//

export type EdoScaleType = NodeType & {
  divisions: number
  octaveSize: number
}

export type ScaleOctaveMarkerType = NodeType

export type PitchGroupScalePrefixType = NodeType & {
  prefix: string
}

export type PitchGroupScaleType = NodeType & {
  pitchGroupScalePrefix?: PitchGroupScalePrefixType
  pitches: PitchGroupType
  scaleOctaveMarker?: ScaleOctaveMarkerType
}

export type RatioChordScaleType = NodeType & {
  pitches: Array<RatioChordPitchType | DelimiterType>
  scaleOctaveMarker?: ScaleOctaveMarkerType
}

//
// scale setters
//

export type SetScaleType = NodeType & {
  scale: EdoScaleType | RatioChordScaleType | PitchGroupScaleType
}

export type SetRootType = NodeType & {
  pitch: PitchType
}

//
// setters
//

// bpm

export type SetBpmValue = NodeType & {
  bpm: number
}

export type SetBpmType = NodeType & {
  bpm: number
}

export type SetBpmValueType = NodeType & {
  bpm: number
}

// bms (beat milliseconds)

export type SetBmsValue = NodeType & {
  bms: number
}

export type SetBmsType = NodeType & {
  bms: number
}

export type SetBmsValueType = NodeType & {
  bms: number
}

// subdivision

export type SetSubdivisionValueType = NodeType & {
  subdivision: number
  denominator: number
}

export type SetSubdivisionType = NodeType & {
  subdivision: number
  denominator: number
}

// osc

export type SetOscValueType = NodeType & {
  osc: string
}

export type SetOscType = NodeType & {
  osc: string
}

// env

export type SetEnvValueType = NodeType & {
  a: number
  d: number
  s: number
  r: number
}

export type SetEnvType = NodeType & {
  a: number
  d: number
  s: number
  r: number
}

// ruler

export type SetRulerRangeType = NodeType & {
  low: PitchType
  high: PitchType
}

export type SetRulerPlotType = NodeType

export type SetRulerType = SetRulerRangeType | SetRulerPlotType

// setters

export type SetterType =
  | SetBpmType
  | SetBmsType
  | SetSubdivisionType
  | SetOscType
  | SetEnvType
  | SetRulerType

export type SetterGroupType = NodeType & {
  setters: SetterType[]
}

//
// comments
//

export type CommentType = NodeType & {
  comment: string
}

//
// sequence
//

export type SequenceItemsType =
  | RatioChordType
  | NoteType
  | ChordType
  | RestType
  | SetterGroupType
  | SetScaleType
  | SetRootType
  | CommentType

export type SequenceType = NodeType & {
  items: SequenceItemsType[]
}

//
// params
//

export type ParamEmbedType = NodeType

export type ParamType = ParamEmbedType

export type ParamGroupType = NodeType & {
  params: ParamType[]
}

export type XenpaperAST = NodeType & {
  sequence?: SequenceType
  paramGroup?: ParamGroupType
}

export function parse(input: string, options?: { grammarSource?: string }): XenpaperAST
