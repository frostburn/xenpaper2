{
  const node = (type, extra = {}) => ({ type, delimiter: false, ...extra, location: location() });
}

Start = seq:Sequence _ {
  return node('XenpaperGrammar', { sequence: seq });
}
Sequence = items:ItemList { return node('Sequence', { items }); }
ItemList = head:Item tail:(_ Item)* { return [head, ...tail.map(([,i]) => i)]; } / '' { return []; }
Item = Comment / SetterGroup / SetRoot / SetScale / RatioChordItem / SampleRateNote / Note / Rest / Chord / RepeatEndStart / RepeatStart / RepeatEnd / RepeatEndingStart / BarLine / Whitespace
Note = pitch:Pitch tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('Note', { pitch, tail: noteTail });
}
SampleRateNote = "!" tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('SampleRateNote', { tail: noteTail });
}
SampleRatePitch = "!" { return node('SampleRateNote'); }
Pitch = oct:OctaveModifier? val:(PitchCents / PitchHz / PitchOctaveDivision / PitchRatio / PitchDegree) {
  if (oct) return node('Pitch', { octave: oct, value: val });
  return node('Pitch', { value: val });
}
OctaveModifier = shifts:(Apostrophe / Quote / Grave)+ {
  const octave = shifts.reduce((sum, shift) => sum + shift, 0);
  return node('OctaveModifier', { octave });
}
Apostrophe "apostrophe" = "'" { return 1; }
Quote "quote" = '"' { return 2; }
Grave "grave" = "`" { return -1; }
PitchCents = n:Number _ "c"i { return node('PitchCents',{cents:n}); }
PitchHz = n:Number _ "hz"i { return node('PitchHz',{hz:n}); }
PitchOctaveDivision = n:Int _ [\\/] _ d:Int suffix:PitchOctaveDivisionSuffix {
  return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:suffix});
} / n:Int _ "\\" _ d:Int { return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:2}); }
PitchOctaveDivisionSuffix = _ "ed"i _ os:OctaveSize? { return os ?? 2; } / _ "<" _ os:OctaveSize _ ">" { return os; }
OctaveSize = os:Int frac:(_ "/" _ den:Int)? {
  return os / (frac ? frac[3] : 1);
}
PitchRatio = n:Int _ "/" _ d:Int { return node('PitchRatio',{numerator:n,denominator:d}); }
PitchDegree = n:Int { return node('PitchDegree',{degree:n}); }
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
RatioChord = pitches:RatioChordPitches tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('RatioChord', { pitches, tail: noteTail });
}
RatioChordItem = &(Int _ ":" !"|") rc:RatioChord { return rc; }
Chord = "[" _ pitches:((&(Int _ ":" !"|") rp:RatioChordPitches { return rp; }) / ChordPitchGroup) _ "]" tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('Chord', { pitches, tail: noteTail });
}
RepeatEndStart = ":|:" count:RepeatCount? {
  return node('RepeatEndStart',{delimiter:true, repeatCount: count ?? 2});
}
RepeatStart = "|:" count:RepeatCount? { return node('RepeatStart',{delimiter:true, repeatCount: count ?? 2}); }
RepeatEnd = ":|" ending:RepeatEndingNumber? tail:Hold? {
  const alternateEnding = ending ?? undefined;
  const noteTail = tail ?? undefined;
  return node('RepeatEnd',{delimiter:true, alternateEnding, tail: noteTail});
}
RepeatEndingStart = "|" ending:RepeatEndingNumber tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('RepeatEndingStart',{delimiter:true, alternateEnding: ending, tail: noteTail});
}
RepeatCount = "ˣ" count:SuperScriptInt { return count; } / "(" "x"i count:Int ")" { return count; }
RepeatEndingNumber = SuperScriptInt / "(" "^" count:Int ")" { return count; }
BarLine = "|" { return node('BarLine',{delimiter:true}); }
Semicolon = _ ";" _ { return node('Semicolon', { delimiter: true }); }
SetterGroup = "(" _ first:Setter rest:(Semicolon Setter)* _ ")" {
  const setters = [first];
  for (const part of rest) setters.push(part[0], part[1]);
  return node('SetterGroup', { setters });
}
Setter = SetBpm / SetBms / SetSubdivision / SetOsc / SetNoise / SetEnv / SetRulerRange / SetRulerPlot
SetBpm = "bpm"i _ ":" _ bpm:Number { return node('SetBpm', { bpm }); }
SetBms = "bms"i _ ":" _ bms:Number { return node('SetBms', { bms }); }
SetSubdivision = ("div"i _ ":" _)? n:Int frac:(_ "/" _ d:Int)? {
  return node('SetSubdivision', {
    subdivision: n,
    denominator: frac ? frac[3] : undefined,
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
SetRoot = "{" _ "r"i _ p:Pitch _ "}" { return node('SetRoot', { pitch: p }); }
SetScale = "{" _ scale:(EdoScale / RatioChordScale / PitchGroupScale) _ "}" {
  return node('SetScale', { scale });
}
EdoScale = div:Int _ "ed"i "o"i? _ os:Int? frac:(_ "/" _ den:Int)? {
  const den = frac ? frac[3] : 1;
  const octaveSize = (os ?? 2) / den;
  return node('EdoScale', { divisions: div, octaveSize });
}
ScaleOctaveMarker = "'" { return node('ScaleOctaveMarker'); }
RatioChordScale = &(Int _ ":") pitches:RatioChordPitches _ som:ScaleOctaveMarker? {
  const scaleOctaveMarker = som ?? undefined;
  return node('RatioChordScale', { pitches, scaleOctaveMarker });
}
PitchGroupScalePrefix = p:"m"i _ {
  return node('PitchGroupScalePrefix', { prefix: p.toLowerCase() });
}
PitchGroupScale = pref:PitchGroupScalePrefix? pitches:PitchGroup _ som:ScaleOctaveMarker? {
  const pitchGroupScalePrefix = pref ?? undefined;
  const scaleOctaveMarker = som ?? undefined;
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
Number "number" = n:$([0-9]+ ("." [0-9]*)?) { return Number(n); }
Int "integer" = n:$([0-9]+) { return parseInt(n, 10); }
SuperScriptInt "superscript integer" = digits:SuperScriptDigit+ { return parseInt(digits.join(''), 10); }
SuperScriptDigit = "⁰" { return '0'; } / "¹" { return '1'; } / "²" { return '2'; } / "³" { return '3'; } / "⁴" { return '4'; } / "⁵" { return '5'; } / "⁶" { return '6'; } / "⁷" { return '7'; } / "⁸" { return '8'; } / "⁹" { return '9'; }
_ "whitespace" = [ \t\n\r]*
