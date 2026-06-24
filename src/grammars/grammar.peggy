{
  const node = (type, extra = {}) => ({ type, delimiter: false, ...extra, location: location() });
}

Start = seq:Sequence _ {
  return node('XenpaperGrammar', { sequence: seq });
}
Sequence = items:ItemList { return node('Sequence', { items }); }
ItemList = head:Item tail:(_ Item)* { return [head, ...tail.map(([,i]) => i)]; } / '' { return []; }
Item = Comment / MusicalControlFlow / SetterGroup / SetRoot / SetScale / SetMos / RatioChordItem / SampleRateNote / Note / Rest / Chord / RepeatEndStart / RepeatStart / RepeatEnd / RepeatEndingStart / BarLine / Whitespace
Note = pitch:Pitch tail:Hold? {
  return node('Note', { pitch, tail });
}
SampleRateNote = "!" tail:Hold? {
  return node('SampleRateNote', { tail });
}
SampleRatePitch = "!" { return node('SampleRateNote', { tail: null }); }
Pitch = octave:OctaveModifier? value:(PitchAbsolute / PitchCents / PitchHz / PitchOctaveDivision / PitchRatio / PitchDegree) {
  return node('Pitch', { octave, value });
}
OctaveModifier = shifts:(Apostrophe / Quote / Grave)+ {
  const octave = shifts.reduce((sum, shift) => sum + shift, 0);
  return node('OctaveModifier', { octave });
}
Apostrophe "apostrophe" = "'" { return 1; }
Quote "quote" = '"' { return 2; }
Grave "grave" = "`" { return -1; }
LatinNominal = nominal:[a-g]i { return { nominal, greek: false } }
MosNominal = nominal:$([j-z]i+) { return { nominal, greek: false, mos: true } }
GreekNominal "Greek nominal" = ([α-ω]i / "alp"i / "bet"i / "gam"i / "del"i / "eps"i / "zet"i / "eta"i / "the"i / "iot"i / "kap"i / "muu"i / "nuu"i / "xii"i / "omi"i / "pii"i / "rho"i / "fsi"i / "sig"i / "tau"i / "ups"i / "phi"i / "chi"i / "psi"i / "ome"i) {
  return { nominal: text(), greek: true };
}
Accidental "accidental" = '𝄪' / '𝄫' / '𝄲' / '𝄳' / '𝄬' / '𝄭' / '𝄮' / '𝄯' / '𝄰' / '𝄱' / [x♯#‡t♮_d♭b]
UpsAndDowns "Ups and Downs" = ('^' / 'v' / '/' / '\\')* {
  let ups = 0;
  let lifts = 0;
  for (const c of text()) {
    switch (c) {
      case '^': ++ups; break;
      case 'v': --ups; break;
      case '/': ++lifts; break;
      case '\\': --lifts; break;
    }
  }
  return { ups, lifts }
}
InflectionFlavor = 'n' / 'l' / 'h' / 'm' / 's' / 'f' / 'c' / 'q' / 't' / ''
Inflection "inflection" = type: ('^' / 'v') value: Int flavor: InflectionFlavor {
  return {
    type: type === '^' ? 'superscript' : 'subscript',
    value,
    flavor
  };
}
PitchAbsolute
 = updowns: UpsAndDowns nominal: (GreekNominal / LatinNominal) accidentals: Accidental* inflections: Inflection* { return node('PitchAbsolute', {...updowns, ...nominal, accidentals, inflections}) }
 / PitchAbsoluteMos
PitchAbsoluteMos
 = updowns: UpsAndDowns nominal:MosNominal accidentals:MosAccidental* { return node('PitchAbsolute', {...updowns, ...nominal, accidentals, inflections: []}) }
MosAccidental = [\&@ea]
PitchCents = cents:Number "c"i { return node('PitchCents',{cents}); }
PitchHz = hz:Number _ "hz"i { return node('PitchHz',{hz}); }
PitchOctaveDivision = numerator:Int _ [\\/] _ denominator:Int octaveSize:PitchOctaveDivisionSuffix {
  return node('PitchOctaveDivision',{numerator,denominator,octaveSize});
} / numerator:Int _ "\\" _ denominator:Int { return node('PitchOctaveDivision',{numerator,denominator,octaveSize:2}); }
PitchOctaveDivisionSuffix = _ "ed"i _ os:OctaveSize? { return os ?? 2; } / _ "<" _ os:OctaveSize _ ">" { return os; }
OctaveSize = fraction:Fraction {
  return fraction.numerator / fraction.denominator;
}
PitchRatio = fraction:SlashFraction { return node('PitchRatio', fraction); }
PitchDegree = degree:Int { return node('PitchDegree',{degree}); }
Hold = parts:(HoldDash / BarLineInHold)+ {
  const length = parts.filter((part) => part.type === 'HoldDash').length;
  return node('Hold', { length, parts });
}
BarLineInHold = bar:BarLine &("|"* "-") { return bar; }
HoldDash = "-" { return node('HoldDash'); }
Rest = "." { return node('Rest', { length: 1 }); }
PitchGroup = first:Pitch rest:(Whitespace Pitch)* {
  const result = [first];
  for (const pair of rest) {
    result.push(pair[0], pair[1]);
  }
  return result;
}
ChordPitch = Pitch / SampleRatePitch
ChordRatioChordPitches = &("/"? Int _ ":" !"|") inversionPrefix:InversionPrefix? pitches:RatioChordPitches {
  return [
    ...(inversionPrefix ? [inversionPrefix] : []),
    ...pitches.map((pitch) => pitch.type === 'RatioChordPitch' && inversionPrefix ? { ...pitch, inverted: true } : pitch),
  ];
}
ChordPitchElement = ChordRatioChordPitches / ChordPitch
ChordPitchSeparator = Whitespace / &ChordPitchElement { return node('Whitespace', { delimiter: true }); }
ChordPitchGroup = first:ChordPitchElement rest:(ChordPitchSeparator ChordPitchElement)* {
  const result = Array.isArray(first) ? [...first] : [first];
  for (const pair of rest) {
    result.push(pair[0], ...(Array.isArray(pair[1]) ? pair[1] : [pair[1]]));
  }
  return result;
}
InversionPrefix = "/" { return node('InversionPrefix', { delimiter: true }); }
RatioChordPitch = n:Int { return node('RatioChordPitch', { pitch: n }); }
Colon = ":" { return node('Colon', { delimiter: true }); }
RatioChordPitches = first:RatioChordPitch rest:((_ Colon _)+ RatioChordPitch)* {
  const result = [first];
  for (const part of rest) {
    const colons = part[0].map(([, colon]) => colon);
    const pitch = part[1];
    result.push(...colons, pitch);
  }
  return result;
}
RatioChord = inversionPrefix:InversionPrefix? pitches:RatioChordPitches tail:Hold? {
  return node('RatioChord', {
    ...(inversionPrefix ? { inverted: true, inversionPrefix } : {}),
    pitches: pitches.map((pitch) => pitch.type === 'RatioChordPitch' && inversionPrefix ? { ...pitch, inverted: true } : pitch),
    tail,
  });
}
RatioChordItem = &("/"? Int _ ":" !"|") rc:RatioChord { return rc; }
Chord = "[" _ pitches:ChordPitchGroup _ "]" tail:Hold? {
  return node('Chord', { pitches, tail });
}
RepeatEndStart = ":|:" count:RepeatCount? {
  return node('RepeatEndStart',{delimiter:true, repeatCount: count ?? 2});
}
RepeatStart = "|:" count:RepeatCount? { return node('RepeatStart',{delimiter:true, repeatCount: count ?? 2}); }
RepeatEnd = ":|" alternateEnding:RepeatEndingNumber? tail:Hold? {
  return node('RepeatEnd',{delimiter:true, alternateEnding, tail});
}
RepeatEndingStart = "|" ending:RepeatEndingNumber tail:Hold? {
  return node('RepeatEndingStart',{delimiter:true, alternateEnding: ending, tail});
}
RepeatCount = "ˣ" count:SuperScriptInt { return count; } / "(" "x"i count:Int ")" { return count; }
RepeatEndingNumber = SuperScriptInt / "(" "^" count:Int ")" { return count; }
BarLine = "|" { return node('BarLine',{delimiter:true}); }
MusicalControlFlow =
  "(" _ "segno"i _ ")" { return node('Segno', { delimiter: true }); }
  / "(" _ "coda"i _ ")" { return node('Coda', { delimiter: true }); }
  / "(" _ "fine"i _ ")" { return node('Fine', { delimiter: true }); }
  / "(" _ DaCapoToken _ "al"i _ "fine"i _ ")" { return node('DaCapo', { delimiter: true, target: 'start', stop: 'fine' }); }
  / "(" _ DaCapoToken _ "al"i _ "coda"i _ ")" { return node('DaCapo', { delimiter: true, target: 'start', stop: 'coda' }); }
  / "(" _ DalSegnoToken _ "al"i _ "fine"i _ ")" { return node('DalSegno', { delimiter: true, target: 'segno', stop: 'fine' }); }
  / "(" _ DalSegnoToken _ "al"i _ "coda"i _ ")" { return node('DalSegno', { delimiter: true, target: 'segno', stop: 'coda' }); }
  / "(" _ ("to"i / "al"i) _ "coda"i _ ")" { return node('AlCoda', { delimiter: true }); }
DaCapoToken = "d"i "."? _ "c"i "."? / "da"i _ "capo"i
DalSegnoToken = "d"i "."? _ "s"i "."? / "dal"i _ "segno"i
Semicolon = _ ";" _ { return node('Semicolon', { delimiter: true }); }
Drone = "drone"i _ ":" _ value:("off"i { return null; } / RatioChordItem / SampleRateNote / Note / Chord) {
  return node('Drone', { value });
}
SetterGroup = "(" _ first:Setter rest:(Semicolon Setter)* _ ")" {
  const setters = [first];
  for (const part of rest) setters.push(part[0], part[1]);
  return node('SetterGroup', { setters });
}
Setter = SetBpm / SetBms / SetGrace / SetSubdivision / Drone / SetUp / SetLift / SetOsc / SetNoise / SetEnv / SetVolume / SetVelocity / SetKey / SetRulerRange / SetRulerPlot / SetVelocityShorthand
SetBpm = "bpm"i _ ":" _ bpm:Number { return node('SetBpm', { bpm }); }
SetBms = "bms"i _ ":" _ bms:Number { return node('SetBms', { bms }); }
SetSubdivision = ("div"i _ ":" _)? fraction:Fraction {
  return node('SetSubdivision', {
    subdivision: fraction.numerator,
    denominator: fraction.denominator,
  });
}
SetGrace = data:(("grace"i _ ":" _ fraction:Fraction count:(_ @Int)? { return { fraction, count: count ?? 1 }; }) / (fraction:Fraction _ questionMarks:$("?"+) { return { fraction, count: questionMarks.length }; })) {
  return node('SetGrace', {
    subdivision: data.fraction.numerator,
    denominator: data.fraction.denominator,
    count: data.count,
  });
}
SetUp = "^" _ ":" _ value:SetterStep { return node('SetUp', { value }); }
SetLift = "/" _ ":" _ value:SetterStep { return node('SetLift', { value }); }
SetterStep = PitchCents / PitchOctaveDivision / PitchRatio
SetOsc = "osc"i _ ":" _ osc:OscName { return node('SetOsc', { osc }); }
OscName "oscillator name" = [a-zA-Z0-9\-]+ { return text().toLowerCase(); }
SetNoise = "noise"i _ ":" _ noise:NoiseName { return node('SetNoise', { noise }); }
NoiseName "noise generator name" = [a-zA-Z0-9\-]+ { return text().toLowerCase(); }
SetEnv = "env"i _ ":" _ vals:EnvValues {
  return node('SetEnv', vals);
}
SetVolume = "vol"i _ ":" _ db:SignedNumber _ "db"i { return node('SetVolume', { db }); }
SetVelocity = "vel"i _ ":" _ percent:Number _ "%" { return node('SetVelocity', { velocity: percent / 100 }); }
SetVelocityShorthand = shorthand:VelocityShorthand { return node('SetVelocity', { velocity: shorthand }); }
VelocityShorthand
  = "ppp"i { return 0.1; }
  / "pp"i { return 0.2; }
  / "p"i { return 0.3; }
  / "mp"i { return 0.4; }
  / "mf"i { return 0.5; }
  / "fff"i { return 1; }
  / "ff"i { return 0.8; }
  / "f"i { return 0.6; }
SetKey = "key"i _ ":" _ tonic:KeyTonic _ mode:KeyMode { return node('SetKey', { tonic, mode }); }
KeyTonic = updowns:UpsAndDowns nominal:(GreekNominal / LatinNominal) accidentals:Accidental* inflections:Inflection* { return { ...updowns, ...nominal, accidentals, inflections }; }
KeyMode
  = "major"i { return "ionian"; }
  / "ionian"i { return "ionian"; }
  / "dorian"i { return "dorian"; }
  / "phrygian"i { return "phrygian"; }
  / "lydian"i { return "lydian"; }
  / "mixolydian"i { return "mixolydian"; }
  / "minor"i { return "aeolian"; }
  / "aeolian"i { return "aeolian"; }
  / "locrian"i { return "locrian"; }
EnvValues "four digits" = a:EnvDigit _ d:EnvDigit _ s:EnvDigit _ r:EnvDigit { return { a, d, s, r }; }
EnvDigit = digit:[0-9] { return parseInt(digit, 10); }
SetRulerRange = "rl"i _ ":" _ low:Pitch _ "," _ high:Pitch { return node('SetRulerRange', { low, high }); }
SetRulerPlot = "plot"i { return node('SetRulerPlot'); }
SetRoot = "{" _ "r"i body:(RootNominalOnly / RootPitch) _ "}" { return node('SetRoot', body); }
RootPitch = _ pitch:Pitch rootNominal:RootNominal? { return { pitch, rootNominal }; }
RootNominalOnly = rootNominal:RootNominal { return { pitch: null, rootNominal }; }
RootNominal = RootNominalPrefix @RootNominalValue
RootNominalPrefix = _ "as"i _
RootNominalValue = octave:OctaveModifier? nominal:PitchAbsolute {
  return { ...nominal, octave: octave?.octave ?? 0, location: location() };
}

SetMos = "MOS"i _ "{" _ expressions:(_ @MosExpression)* _ "}" {
  return node('SetMos', { expressions });
}
MosExpression
  = MosLargeDeclaration
  / MosSmallDeclaration
  / MosRationalEquave
  / MosPatternUpDownPeriod
  / MosHardnessDeclaration
  / MosLongIntegerPattern
  / MosSmallIntegerPattern
  / MosAbstractStepPattern
MosLargeDeclaration = "L"i _ ":" _ value:PitchOctaveDivision { return { type: 'MosLargeDeclaration', value }; }
MosSmallDeclaration = "s"i _ ":" _ value:PitchOctaveDivision { return { type: 'MosSmallDeclaration', value }; }
MosRationalEquave = "<" _ numerator:Int _ "/" _ denominator:Int _ ">" { return { type: 'MosRationalEquave', numerator, denominator }; }
MosAbstractStepPattern = pattern:$([Ls]+) { return { type: 'MosAbstractStepPattern', pattern }; }
MosSmallIntegerPattern = pattern:$([0-9]+) { return { type: 'MosIntegerPattern', pattern: pattern.split('').map(d => parseInt(d, 10)) }; }
MosLongIntegerPattern = pattern:Int _ "," _ rest:(_ @Int _ ","? _)* { return { type: 'MosIntegerPattern', pattern: [pattern, ...rest] }; }
MosHardnessDeclaration = numerator:Int _ "/" _ denominator:Int { return { type: 'MosHardnessDeclaration', numerator, denominator }; }
MosPatternUpDownPeriod = countLarge:Int _ "L"i _ countSmall:Int _ "s"i _ mode:MosModeBrightness? { return { type: 'MosPatternUpDownPeriod', countLarge, countSmall, mode }; }
MosModeBrightness = up:Int _ "|" _ down:Int _ period:("(" _ @Int _ ")")? { return { up, down, period }; }

SetScale = "{" _ scale:(EdoScale / PythagoreanScale / PitchGroupScale) _ "}" {
  return node('SetScale', { scale });
}
EdoScale = divisions:Int _ "ed"i "o"i? _ octaveSize:OctaveSize? {
  return node('EdoScale', { divisions, octaveSize: octaveSize ?? 2 });
}
PythagoreanScale = "pythagorean"i { return node('PythagoreanScale') };
ScaleOctaveMarker = "'" { return node('ScaleOctaveMarker'); }
PitchGroupScalePrefix = p:"m"i _ {
  return node('PitchGroupScalePrefix', { prefix: p.toLowerCase() });
}
PitchGroupScale = pitchGroupScalePrefix:PitchGroupScalePrefix? pitches:ChordPitchGroup _ scaleOctaveMarker:ScaleOctaveMarker? {
  return node('PitchGroupScale', {
    pitchGroupScalePrefix,
    pitches,
    scaleOctaveMarker,
  });
}
Comment = "#" comment:$([^\n\r]*) {
  return node('Comment', { comment });
}
Whitespace "whitespace" = [,\n\r\t ]+ { return node('Whitespace',{delimiter:true}); }
SignedNumber "number" = sign:("+" / "-")? n:Number { return sign === "-" ? -n : n; }
Number "number" = n:$([0-9]+ ("." [0-9]*)?) { return Number(n); }
Fraction = numerator:Int denominator:(_ "/" _ @Int)? { return { numerator, denominator: denominator ?? 1 }; }
SlashFraction = numerator:Int _ "/" _ denominator:Int { return { numerator, denominator }; }
Int "integer" = n:$([0-9]+) { return parseInt(n, 10); }
SuperScriptInt "superscript integer" = digits:SuperScriptDigit+ { return parseInt(digits.join(''), 10); }
SuperScriptDigit = "⁰" { return '0'; } / "¹" { return '1'; } / "²" { return '2'; } / "³" { return '3'; } / "⁴" { return '4'; } / "⁵" { return '5'; } / "⁶" { return '6'; } / "⁷" { return '7'; } / "⁸" { return '8'; } / "⁹" { return '9'; }
_ "whitespace" = [ \t\n\r]*
