{
  const node = (type, extra = {}) => ({ type, delimiter: false, ...extra, location: location() });
}

Start = seq:Sequence _ {
  return node('XenpaperGrammar', { sequence: seq });
}
Sequence = items:ItemList { return node('Sequence', { items }); }
ItemList = head:Item tail:(_ Item)* { return [head, ...tail.map(([,i]) => i)]; } / '' { return []; }
Item = Comment / MusicalControlFlow / SetterGroup / SetRoot / SetScale / RatioChordItem / SampleRateNote / Note / Rest / Chord / RepeatEndStart / RepeatStart / RepeatEnd / RepeatEndingStart / BarLine / Whitespace
Note = pitch:Pitch tail:Hold? {
  return node('Note', { pitch, tail });
}
SampleRateNote = "!" tail:Hold? {
  return node('SampleRateNote', { tail });
}
SampleRatePitch = "!" { return node('SampleRateNote', { tail: null }); }
Pitch = octave:OctaveModifier? value:(PitchCents / PitchHz / PitchOctaveDivision / PitchRatio / PitchDegree) {
  return node('Pitch', { octave, value });
}
OctaveModifier = shifts:(Apostrophe / Quote / Grave)+ {
  const octave = shifts.reduce((sum, shift) => sum + shift, 0);
  return node('OctaveModifier', { octave });
}
Apostrophe "apostrophe" = "'" { return 1; }
Quote "quote" = '"' { return 2; }
Grave "grave" = "`" { return -1; }
PitchCents = cents:Number _ "c"i { return node('PitchCents',{cents}); }
PitchHz = hz:Number _ "hz"i { return node('PitchHz',{hz}); }
PitchOctaveDivision = numerator:Int _ [\\/] _ denominator:Int octaveSize:PitchOctaveDivisionSuffix {
  return node('PitchOctaveDivision',{numerator,denominator,octaveSize});
} / numerator:Int _ "\\" _ denominator:Int { return node('PitchOctaveDivision',{numerator,denominator,octaveSize:2}); }
PitchOctaveDivisionSuffix = _ "ed"i _ os:OctaveSize? { return os ?? 2; } / _ "<" _ os:OctaveSize _ ">" { return os; }
OctaveSize = fraction:Fraction {
  return fraction.numerator / fraction.denominator;
}
PitchRatio = prefix:(@NumericPrefix _)? fraction:SlashFraction { return node('PitchRatio', {prefix, ...fraction}); }
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
ChordPitchSeparator = Whitespace / &ChordPitch { return node('Whitespace', { delimiter: true }); }
ChordPitchGroup = first:ChordPitch rest:(ChordPitchSeparator ChordPitch)* {
  const result = [first];
  for (const pair of rest) {
    result.push(pair[0], pair[1]);
  }
  return result;
}
RatioChordPitch = prefix:(@NumericPrefix _)? pitch:Int { return node('RatioChordPitch', { prefix, pitch }); }
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
RatioChord = pitches:RatioChordPitches tail:Hold? {
  return node('RatioChord', { pitches, tail });
}
RatioChordItem = &(RatioChordPitch _ ":" !"|") rc:RatioChord { return rc; }
Chord = "[" _ pitches:((&(RatioChordPitch _ ":" !"|") rp:RatioChordPitches { return rp; }) / ChordPitchGroup) _ "]" tail:Hold? {
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
SetterGroup = "(" _ first:Setter rest:(Semicolon Setter)* _ ")" {
  const setters = [first];
  for (const part of rest) setters.push(part[0], part[1]);
  return node('SetterGroup', { setters });
}
Setter = SetBpm / SetBms / SetSubdivision / SetOsc / SetNoise / SetEnv / SetRulerRange / SetRulerPlot
SetBpm = "bpm"i _ ":" _ bpm:Number { return node('SetBpm', { bpm }); }
SetBms = "bms"i _ ":" _ bms:Number { return node('SetBms', { bms }); }
SetSubdivision = ("div"i _ ":" _)? fraction:Fraction {
  return node('SetSubdivision', {
    subdivision: fraction.numerator,
    denominator: fraction.denominator,
  });
}
SetOsc = "osc"i _ ":" _ osc:OscName { return node('SetOsc', { osc }); }
OscName "oscillator name" = [a-zA-Z0-9\-]+ { return text().toLowerCase(); }
SetNoise = "noise"i _ ":" _ noise:NoiseName { return node('SetNoise', { noise }); }
NoiseName "noise generator name" = [a-zA-Z0-9\-]+ { return text().toLowerCase(); }
SetEnv = "env"i _ ":" _ vals:EnvValues {
  return node('SetEnv', vals);
}
EnvValues "four digits" = a:EnvDigit _ d:EnvDigit _ s:EnvDigit _ r:EnvDigit { return { a, d, s, r }; }
EnvDigit = digit:[0-9] { return parseInt(digit, 10); }
SetRulerRange = "rl"i _ ":" _ low:Pitch _ "," _ high:Pitch { return node('SetRulerRange', { low, high }); }
SetRulerPlot = "plot"i { return node('SetRulerPlot'); }
SetRoot = "{" _ "r"i _ pitch:Pitch _ "}" { return node('SetRoot', { pitch }); }
SetScale = "{" _ scale:(EdoScale / RatioChordScale / PitchGroupScale) _ "}" {
  return node('SetScale', { scale });
}
EdoScale = divisions:Int _ "ed"i "o"i? _ octaveSize:OctaveSize? {
  return node('EdoScale', { divisions, octaveSize: octaveSize ?? 2 });
}
ScaleOctaveMarker = "'" { return node('ScaleOctaveMarker'); }
RatioChordScale = &(RatioChordPitch _ ":") pitches:RatioChordPitches _ scaleOctaveMarker:ScaleOctaveMarker? {
  return node('RatioChordScale', { pitches, scaleOctaveMarker });
}
PitchGroupScalePrefix = p:"m"i _ {
  return node('PitchGroupScalePrefix', { prefix: p.toLowerCase() });
}
PitchGroupScale = pitchGroupScalePrefix:PitchGroupScalePrefix? pitches:PitchGroup _ scaleOctaveMarker:ScaleOctaveMarker? {
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
NumericPrefix = "√"/"sqrt"i { return text().toLowerCase() }
Number "number" = n:$([0-9]+ ("." [0-9]*)?) { return Number(n); }
Fraction = numerator:Int denominator:(_ "/" _ @Int)? { return { numerator, denominator: denominator ?? 1 }; }
SlashFraction = numerator:Int _ "/" _ denominator:Int { return { numerator, denominator }; }
Int "integer" = n:$([0-9]+) { return parseInt(n, 10); }
SuperScriptInt "superscript integer" = digits:SuperScriptDigit+ { return parseInt(digits.join(''), 10); }
SuperScriptDigit = "⁰" { return '0'; } / "¹" { return '1'; } / "²" { return '2'; } / "³" { return '3'; } / "⁴" { return '4'; } / "⁵" { return '5'; } / "⁶" { return '6'; } / "⁷" { return '7'; } / "⁸" { return '8'; } / "⁹" { return '9'; }
_ "whitespace" = [ \t\n\r]*
