import type { LocationRange } from 'peggy'

export type NodeType<Type extends string = string, Delimiter extends boolean = false> = {
  type: Type
  delimiter: Delimiter
  time?: [number, number]
  location: LocationRange
}

export type DelimiterType =
  | NodeType<'Colon', true>
  | NodeType<'Semicolon', true>
  | NodeType<'BarLine', true>
  | NodeType<'Whitespace', true>

//
// pitches
//

type OctaveModifierType = NodeType<'OctaveModifier'> & {
  octave: number
}

export type PitchCentsType = NodeType<'PitchCents'> & {
  cents: number
}

export type PitchOctaveDivisionType = NodeType<'PitchOctaveDivision'> & {
  numerator: number
  denominator: number
  octaveSize: number
}

export type PitchRatioType = NodeType<'PitchRatio'> & {
  numerator: number
  denominator: number
}

export type PitchDegreeType = NodeType<'PitchDegree'> & {
  degree: number
}

export type PitchHzType = NodeType<'PitchHz'> & {
  hz: number
}

export type PitchType = NodeType<'Pitch'> & {
  value: PitchCentsType | PitchOctaveDivisionType | PitchRatioType | PitchDegreeType | PitchHzType
  octave?: OctaveModifierType
}

export type PitchGroupType = Array<PitchType | DelimiterType>

//
// note
//

export type HoldDashType = NodeType<'HoldDash'>

export type HoldType = NodeType<'Hold'> & {
  length: number
  parts: Array<HoldDashType | Extract<DelimiterType, { type: 'BarLine' }>>
}

export type TailType = HoldType

export type RestType = NodeType<'Rest'> & {
  length: number
}

export type NoteType = NodeType<'Note'> & {
  pitch: PitchType
  tail?: TailType
}

//
// chords
//

export type RatioChordPitchType = NodeType<'RatioChordPitch'> & {
  pitch: number
}

export type RatioChordPitchGroupType = Array<RatioChordPitchType | DelimiterType>

export type ChordType = NodeType<'Chord'> & {
  pitches: Array<RatioChordPitchType | PitchType | DelimiterType>
  tail?: TailType
}

export type RatioChordType = NodeType<'RatioChord'> & {
  pitches: Array<RatioChordPitchType | DelimiterType>
  tail?: TailType
}

//
// scales
//

export type EdoScaleType = NodeType<'EdoScale'> & {
  divisions: number
  octaveSize: number
}

export type ScaleOctaveMarkerType = NodeType<'ScaleOctaveMarker'>

export type PitchGroupScalePrefixType = NodeType<'PitchGroupScalePrefix'> & {
  prefix: string
}

export type PitchGroupScaleType = NodeType<'PitchGroupScale'> & {
  pitchGroupScalePrefix?: PitchGroupScalePrefixType
  pitches: PitchGroupType
  scaleOctaveMarker?: ScaleOctaveMarkerType
}

export type RatioChordScaleType = NodeType<'RatioChordScale'> & {
  pitches: Array<RatioChordPitchType | DelimiterType>
  scaleOctaveMarker?: ScaleOctaveMarkerType
}

//
// scale setters
//

export type SetScaleType = NodeType<'SetScale'> & {
  scale: EdoScaleType | RatioChordScaleType | PitchGroupScaleType
}

export type SetRootType = NodeType<'SetRoot'> & {
  pitch: PitchType
}

//
// setters
//

// bpm

export type SetBpmValue = NodeType<'SetBpmValue'> & {
  bpm: number
}

export type SetBpmType = NodeType<'SetBpm'> & {
  bpm: number
}

export type SetBpmValueType = NodeType<'SetBpmValue'> & {
  bpm: number
}

// bms (beat milliseconds)

export type SetBmsValue = NodeType<'SetBmsValue'> & {
  bms: number
}

export type SetBmsType = NodeType<'SetBms'> & {
  bms: number
}

export type SetBmsValueType = NodeType<'SetBmsValue'> & {
  bms: number
}

// subdivision

export type SetSubdivisionValueType = NodeType<'SetSubdivisionValue'> & {
  subdivision: number
  denominator?: number
}

export type SetSubdivisionType = NodeType<'SetSubdivision'> & {
  subdivision: number
  denominator?: number
}

// osc

export type SetOscValueType = NodeType<'SetOscValue'> & {
  osc: string
}

export type SetOscType = NodeType<'SetOsc'> & {
  osc: string
}

// env

export type SetEnvValueType = NodeType<'SetEnvValue'> & {
  a: number
  d: number
  s: number
  r: number
}

export type SetEnvType = NodeType<'SetEnv'> & {
  a: number
  d: number
  s: number
  r: number
}

// ruler

export type SetRulerRangeType = NodeType<'SetRulerRange'> & {
  low: PitchType
  high: PitchType
}

export type SetRulerPlotType = NodeType<'SetRulerPlot'>

export type SetRulerType = SetRulerRangeType | SetRulerPlotType

// setters

export type SetterType =
  | SetBpmType
  | SetBmsType
  | SetSubdivisionType
  | SetOscType
  | SetEnvType
  | SetRulerType

export type SetterGroupType = NodeType<'SetterGroup'> & {
  setters: Array<SetterType | DelimiterType>
}

//
// comments
//

export type CommentType = NodeType<'Comment'> & {
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
  | DelimiterType

export type SequenceType = NodeType<'Sequence'> & {
  items: SequenceItemsType[]
}

//
// params
//

export type ParamEmbedType = NodeType<'ParamEmbed'>

export type ParamType = ParamEmbedType

export type ParamGroupType = NodeType<'ParamGroup'> & {
  params: ParamType[]
}

export type XenpaperAST = NodeType<'XenpaperGrammar'> & {
  sequence: SequenceType
  paramGroup?: ParamGroupType
}

export function parse(input: string, options?: { grammarSource?: string }): XenpaperAST
