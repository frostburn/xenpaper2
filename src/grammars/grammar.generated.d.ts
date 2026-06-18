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

export type AccidentalType =
  | '𝄪'
  | '𝄫'
  | '𝄲'
  | '𝄳'
  | 'x'
  | '♯'
  | '#'
  | '‡'
  | 't'
  | '♮'
  | '_'
  | 'd'
  | '♭'
  | 'b'
  | '𝄬'
  | '𝄭'
  | '𝄮'
  | '𝄯'
  | '𝄰'
  | '𝄱'

export type InflectionFlavorType = '' | 'n' | 'l' | 'h' | 'm' | 's' | 'c' | 'f' | 'q' | 't'

export type InflectionType = {
  type: 'superscript' | 'subscript'
  value: number
  flavor: InflectionFlavorType
}

export type PitchAbsoluteType = NodeType<'PitchAbsolute'> & {
  ups: number
  lifts: number
  nominal: string
  greek: boolean
  accidentals: AccidentalType[]
  inflections: InflectionType[]
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
  value:
    | PitchAbsoluteType
    | PitchCentsType
    | PitchOctaveDivisionType
    | PitchRatioType
    | PitchDegreeType
    | PitchHzType
  octave: OctaveModifierType | null
}

export type PitchGroupType = Array<PitchType | DelimiterType>
export type ChordPitchType = PitchType | SampleRateNoteType
export type ChordPitchGroupType = Array<ChordPitchType | DelimiterType>

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
  tail: TailType | null
}

export type SampleRateNoteType = NodeType<'SampleRateNote'> & {
  tail: TailType | null
}

//
// chords
//

export type RatioChordPitchType = NodeType<'RatioChordPitch'> & {
  pitch: number
}

export type ChordType = NodeType<'Chord'> & {
  pitches: Array<RatioChordPitchType | PitchType | SampleRateNoteType | DelimiterType>
  tail: TailType | null
}

export type RatioChordType = NodeType<'RatioChord'> & {
  pitches: Array<RatioChordPitchType | DelimiterType>
  tail: TailType | null
}

//
// scales
//

export type EdoScaleType = NodeType<'EdoScale'> & {
  divisions: number
  octaveSize: number
}

export type PythagoreanScaleType = NodeType<'PythagoreanScale'>

export type ScaleOctaveMarkerType = NodeType<'ScaleOctaveMarker'>

export type PitchGroupScalePrefixType = NodeType<'PitchGroupScalePrefix'> & {
  prefix: string
}

export type PitchGroupScaleType = NodeType<'PitchGroupScale'> & {
  pitchGroupScalePrefix: PitchGroupScalePrefixType | null
  pitches: PitchGroupType
  scaleOctaveMarker: ScaleOctaveMarkerType | null
}

export type RatioChordScaleType = NodeType<'RatioChordScale'> & {
  pitches: Array<RatioChordPitchType | DelimiterType>
  scaleOctaveMarker: ScaleOctaveMarkerType | null
}

//
// scale setters
//

export type SetScaleType = NodeType<'SetScale'> & {
  scale: EdoScaleType | PythagoreanScaleType | RatioChordScaleType | PitchGroupScaleType
}

export type SetRootType = NodeType<'SetRoot'> & {
  pitch: PitchType
}

//
// setters
//

// bpm

export type SetBpmType = NodeType<'SetBpm'> & {
  bpm: number
}

// bms (beat milliseconds)

export type SetBmsType = NodeType<'SetBms'> & {
  bms: number
}

// subdivision

export type SetSubdivisionType = NodeType<'SetSubdivision'> & {
  subdivision: number
  denominator: number
}

// osc

export type SetOscType = NodeType<'SetOsc'> & {
  osc: string
}

// noise

export type SetNoiseType = NodeType<'SetNoise'> & {
  noise: string
}

// env

export type SetEnvType = NodeType<'SetEnv'> & {
  a: number
  d: number
  s: number
  r: number
}

// key

export type KeyTonicType = {
  ups: number
  lifts: number
  nominal: string
  greek: boolean
  accidentals: AccidentalType[]
  inflections: InflectionType[]
}

export type KeyModeType =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'

export type SetKeyType = NodeType<'SetKey'> & {
  tonic: KeyTonicType
  mode: KeyModeType
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
  | SetNoiseType
  | SetEnvType
  | SetKeyType
  | SetRulerType

export type SetterGroupType = NodeType<'SetterGroup'> & {
  setters: Array<SetterType | DelimiterType>
}

//
// repeats
//

export type RepeatStartType = NodeType<'RepeatStart', true> & {
  repeatCount: number
}

export type RepeatEndType = NodeType<'RepeatEnd', true> & {
  alternateEnding: number | null
  tail: TailType | null
}

export type RepeatEndStartType = NodeType<'RepeatEndStart', true> & {
  repeatCount: number
}

export type RepeatEndingStartType = NodeType<'RepeatEndingStart', true> & {
  alternateEnding: number
  tail: TailType | null
}

export type RepeatType =
  | RepeatStartType
  | RepeatEndType
  | RepeatEndStartType
  | RepeatEndingStartType

//
// musical control flow
//

export type SegnoType = NodeType<'Segno', true>
export type CodaType = NodeType<'Coda', true>
export type FineType = NodeType<'Fine', true>

export type DaCapoType = NodeType<'DaCapo', true> & {
  target: 'start'
  stop: 'fine' | 'coda'
}

export type DalSegnoType = NodeType<'DalSegno', true> & {
  target: 'segno'
  stop: 'fine' | 'coda'
}

export type AlCodaType = NodeType<'AlCoda', true>

export type MusicalControlFlowType =
  | SegnoType
  | CodaType
  | FineType
  | DaCapoType
  | DalSegnoType
  | AlCodaType

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
  | SampleRateNoteType
  | ChordType
  | RestType
  | SetterGroupType
  | SetScaleType
  | SetRootType
  | CommentType
  | RepeatType
  | MusicalControlFlowType
  | DelimiterType

export type SequenceType = NodeType<'Sequence'> & {
  items: SequenceItemsType[]
}

export type XenpaperAST = NodeType<'XenpaperGrammar'> & {
  sequence: SequenceType
}

export function parse(input: string, options?: { grammarSource?: string }): XenpaperAST
