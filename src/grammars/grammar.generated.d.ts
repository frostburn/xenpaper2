import type { LocationRange } from 'peggy'

export type NodeType<Type extends string = string, Delimiter extends boolean = false> = {
  type: Type
  delimiter: Delimiter
  time?: [number, number]
  barlineSyntaxError?: boolean
  location: LocationRange
}

export type DelimiterType =
  | NodeType<'Colon', true>
  | NodeType<'InversionPrefix', true>
  | NodeType<'TemperedPrefix', true>
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
  | '&'
  | '@'
  | 'e'
  | 'a'
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
  | 'p'
  | 'q'
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
  nominalType: 'latin' | 'greek' | 'mos'
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
  ups?: number
  lifts?: number
  tempered?: boolean
  temperedPrefix?: DelimiterType
}

export type PitchDegreeType = NodeType<'PitchDegree'> & {
  ups: number
  lifts: number
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
  inverted?: boolean
  tempered?: boolean
}

export type ChordType = NodeType<'Chord'> & {
  tempered?: boolean
  temperedPrefix?: DelimiterType
  pitches: Array<RatioChordPitchType | PitchType | SampleRateNoteType | DelimiterType>
  tail: TailType | null
}

export type RatioChordType = NodeType<'RatioChord'> & {
  tempered?: boolean
  temperedPrefix?: DelimiterType
  inverted?: boolean
  inversionPrefix?: DelimiterType
  pitches: Array<RatioChordPitchType | DelimiterType>
  tail: TailType | null
}

export type DroneType = NodeType<'Drone'> & {
  value: NoteType | SampleRateNoteType | ChordType | RatioChordType | null
}

//
// scales
//

export type EdoScaleType = NodeType<'EdoScale'> & {
  divisions: number
  octaveSize: number
}

export type PythagoreanScaleType = NodeType<'PythagoreanScale'>

export type CustomMappingEntryType = {
  value: number
  unit: 'steps' | 'cents'
}

export type CustomMappingScaleType = NodeType<'CustomMappingScale'> & {
  entries: CustomMappingEntryType[]
  anchor: number | null
}

export type ScaleOctaveMarkerType = NodeType<'ScaleOctaveMarker'>

export type PitchGroupScalePrefixType = NodeType<'PitchGroupScalePrefix'> & {
  prefix: string
}

export type MosExpressionValueType =
  | { type: 'MosRationalEquave'; numerator: number; denominator: number }
  | { type: 'MosAbstractStepPattern'; pattern: string }
  | { type: 'MosIntegerPattern'; pattern: number[] }
  | { type: 'MosCountLarge'; count: number }
  | { type: 'MosCountSmall'; count: number }
  | { type: 'MosMode'; up: number; down: number; period: number | null }
  | { type: 'MosHardness'; numerator: number; denominator: number }
  | { type: 'MosUp'; up: number }
  | { type: 'MosLift'; lift: number }

export type MosExpressionType = NodeType<'MosExpression'> & {
  value: MosExpressionValueType
}

export type SetMosType = NodeType<'SetMos'> & {
  expressions: MosExpressionType[]
}

export type PitchGroupScaleType = NodeType<'PitchGroupScale'> & {
  pitchGroupScalePrefix: PitchGroupScalePrefixType | null
  pitches: Array<RatioChordPitchType | PitchType | SampleRateNoteType | DelimiterType>
  scaleOctaveMarker: ScaleOctaveMarkerType | null
}

//
// scale setters
//

export type SetScaleType = NodeType<'SetScale'> & {
  scale: EdoScaleType | CustomMappingScaleType | PythagoreanScaleType | PitchGroupScaleType
}

export type RootNominalType = PitchAbsoluteType & {
  octave: number
}

export type SetRootType = NodeType<'SetRoot'> &
  (
    | {
        pitch: PitchType
        rootNominal: RootNominalType
      }
    | {
        pitch: PitchType
        rootNominal: null
      }
    | {
        pitch: null
        rootNominal: RootNominalType
      }
  )

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

export type SetTimeType = NodeType<'SetTime'> & {
  numerator: number
  denominator: number
}

// subdivision

export type SetSubdivisionType = NodeType<'SetSubdivision'> & {
  subdivision: number
  denominator: number
}

export type SetGraceType = NodeType<'SetGrace'> & {
  subdivision: number
  denominator: number
  count: number
}

export type GlissEasingType = string

export type SetGlissType = NodeType<'SetGliss'> & {
  easing: GlissEasingType
}

export type SetArticulationType = NodeType<'SetArticulation'> & {
  articulation: number
}

export type SetVolumeRampType = NodeType<'SetVolumeRamp'> & {
  kind: 'cresc' | 'dim' | 'vramp'
  easing: GlissEasingType
}

export type SetTempoRampType = NodeType<'SetTempoRamp'> & {
  kind: 'accel' | 'rall' | 'tramp'
  easing: GlissEasingType
}

export type GrooveItemType = SetSubdivisionType | SampleRateNoteType | DelimiterType

export type SetGrooveType = NodeType<'SetGroove'> & {
  items: GrooveItemType[]
}

// up/down step

export type SetUpType = NodeType<'SetUp'> & {
  value: PitchType
}

// lift/drop step

export type SetLiftType = NodeType<'SetLift'> & {
  value: PitchType
}

// osc

export type SetOscType = NodeType<'SetOsc'> & {
  osc: string
}

// noise

export type SetNoiseType = NodeType<'SetNoise'> & {
  noise: string
  interpolation: string | null
}

// env

export type SetEnvType = NodeType<'SetEnv'> & {
  a: number
  d: number
  s: number
  r: number
}

// volume and velocity

export type SetVolumeType = NodeType<'SetVolume'> & {
  db: number
}

export type SetVelocityType = NodeType<'SetVelocity'> & {
  velocity: number
}

// key

export type KeyTonicType = {
  ups: number
  lifts: number
  nominal: string
  nominalType: 'latin' | 'greek'
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

export type MosKeyTonicType = {
  ups: number
  lifts: number
  nominal: string
  nominalType: 'mos'
  accidentals: AccidentalType[]
}

export type SetKeyType = NodeType<'SetKey'> &
  (
    | {
        keyType: 'pythagorean'
        tonic: KeyTonicType
        mode: KeyModeType
      }
    | {
        keyType: 'mos'
        tonic: MosKeyTonicType
        expressions: MosExpressionType[]
      }
  )

export type SetSignatureType = NodeType<'SetSignature'> & {
  items: Array<KeyTonicType | MosKeyTonicType>
}

// ruler

export type SetRulerRangeType = NodeType<'SetRulerRange'> & {
  low: PitchType
  high: PitchType
}

export type PlotNominalType = 'latin' | 'greek' | 'mos'

export type SetRulerPlotType = NodeType<'SetRulerPlot'> & {
  nominalType: PlotNominalType | null
}

export type SetRulerType = SetRulerRangeType | SetRulerPlotType

// setters

export type SetterType =
  | SetBpmType
  | SetBmsType
  | SetTimeType
  | SetSubdivisionType
  | SetGraceType
  | SetGlissType
  | SetArticulationType
  | SetTempoRampType
  | SetVolumeRampType
  | SetGrooveType
  | DroneType
  | SetUpType
  | SetLiftType
  | SetOscType
  | SetNoiseType
  | SetEnvType
  | SetVolumeType
  | SetVelocityType
  | SetKeyType
  | SetSignatureType
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
  | SetMosType
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
