{
  const node = (type, extra = {}) => ({ type, delimiter: false, ...extra, location: location() });
}

Start = pg:ParamGroup? seq:Sequence? _ {
  return node('XenpaperGrammar', { paramGroup: pg ?? undefined, sequence: seq ?? node('Sequence', { items: [] }) });
}
ParamGroup = first:Param rest:(Semicolon Param)* ":" {
  const params = [first, ...rest.map(([, p]) => p)];
  return node('ParamGroup', { params });
}
Param = ParamEmbed
ParamEmbed = [eE][mM][bB][eE][dD] { return node('ParamEmbed'); }
Sequence = items:ItemList { return node('Sequence', { items }); }
ItemList = head:Item tail:(_ Item)* { return [head, ...tail.map(([,i]) => i)]; } / '' { return []; }
Item = Comment / SetterGroup / SetRoot / SetScale / RatioChordItem / Note / Rest / Chord / BarLine / Whitespace
Note = pitch:Pitch tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('Note', { pitch, tail: noteTail });
}
Pitch = oct:OctaveModifier? val:(PitchCents / PitchHz / PitchOctaveDivision / PitchRatio / PitchDegree) {
  if (oct) return node('Pitch', { octave: oct, value: val });
  return node('Pitch', { value: val });
}
OctaveModifier = s:$([\'"`]+) { const octave = (s.split("'").length - 1) + ((s.split('"').length - 1) * 2) - (s.split('`').length - 1); return node('OctaveModifier', { octave }); }
PitchCents = n:Number [cC] { return node('PitchCents',{cents:n}); }
PitchHz = n:Number [hH][zZ] { return node('PitchHz',{hz:n}); }
PitchOctaveDivision = n:Int [\\/] d:Int [oO] os:Int? divPart:("/" od:Int)? {
  const octaveDenom = divPart ? divPart[1] : 1;
  return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:(os||2)/octaveDenom});
} / n:Int "\\" d:Int { return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:2}); }
PitchRatio = n:Int "/" d:Int { return node('PitchRatio',{numerator:n,denominator:d}); }
PitchDegree = n:Int { return node('PitchDegree',{degree:n}); }
Hold = parts:(HoldDash / BarLineInHold)+ {
  const length = parts.filter((part) => part.type === 'HoldDash').length;
  return node('Hold', { length, parts });
}
BarLineInHold = bar:BarLine &("-" / "|"+ "-") { return bar; }
HoldDash = "-" { return node('HoldDash'); }
Rest = "." { return node('Rest', { length: 1 }); }
PitchGroup = first:Pitch rest:(Whitespace Pitch)* {
  const result = [first];
  for (const pair of rest) {
    result.push(pair[0], pair[1]);
  }
  return result;
}
RatioChordPitch = n:Int { return node('RatioChordPitch', { pitch: n }); }
Colon = ":" { return node('Colon', { delimiter: true }); }
RatioChordPitches = first:RatioChordPitch rest:((Colon)+ RatioChordPitch)* {
  const result = [first];
  for (const part of rest) {
    const colons = part[0];
    const pitch = part[1];
    result.push(...colons, pitch);
  }
  return result;
}
RatioChord = pitches:RatioChordPitches tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('RatioChord', { pitches, tail: noteTail });
}
RatioChordItem = &([0-9]+ ":") rc:RatioChord { return rc; }
Chord = "[" pitches:((&([0-9]+ ":") rp:RatioChordPitches { return rp; }) / PitchGroup) "]" tail:Hold? {
  const noteTail = tail ?? undefined;
  return node('Chord', { pitches, tail: noteTail });
}
BarLine = "|" { return node('BarLine',{delimiter:true}); }
Semicolon = ";" Whitespace? { return node('Semicolon', { delimiter: true }); }
SetterGroup = "(" first:Setter rest:(Semicolon Setter)* ")" {
  const setters = [first];
  for (const part of rest) setters.push(part[0], part[1]);
  return node('SetterGroup', { setters });
}
Setter = SetBpm / SetBms / SetSubdivision / SetOsc / SetEnv / SetRulerRange / SetRulerPlot
SetBpm = [bB][pP][mM] ":" Whitespace? bpm:Number { return node('SetBpm', { bpm }); }
SetBms = [bB][mM][sS] ":" Whitespace? bms:Number { return node('SetBms', { bms }); }
SetSubdivision = ([dD][iI][vV] ":" Whitespace?)? n:Int frac:("/" d:Int)? {
  return node('SetSubdivision', {
    subdivision: n,
    denominator: frac ? frac[1] : undefined,
  });
}
SetOsc = [oO][sS][cC] ":" Whitespace? osc:$([a-zA-Z0-9\-]+) { return node('SetOsc', { osc: osc.toLowerCase() }); }
SetEnv = [eE][nN][vV] ":" Whitespace? vals:$([0-9][0-9][0-9][0-9]) {
  return node('SetEnv', { a: Number(vals[0]), d: Number(vals[1]), s: Number(vals[2]), r: Number(vals[3]) });
}
SetRulerRange = [rR][lL] ":" low:Pitch "," high:Pitch { return node('SetRulerRange', { low, high }); }
SetRulerPlot = [pP][lL][oO][tT] { return node('SetRulerPlot'); }
SetRoot = "{r" p:Pitch "}" { return node('SetRoot', { pitch: p }); }
SetScale = "{" scale:(EdoScale / RatioChordScale / PitchGroupScale) "}" {
  return node('SetScale', { scale });
}
EdoScale = div:Int [eE][dD] [oO]? os:Int? frac:("/" den:Int)? {
  const den = frac ? frac[1] : 1;
  const octaveSize = (os ?? 2) / den;
  return node('EdoScale', { divisions: div, octaveSize });
}
ScaleOctaveMarker = "'" { return node('ScaleOctaveMarker'); }
RatioChordScale = &([0-9]+ ":") pitches:RatioChordPitches som:ScaleOctaveMarker? {
  const scaleOctaveMarker = som ?? undefined;
  return node('RatioChordScale', { pitches, scaleOctaveMarker });
}
PitchGroupScalePrefix = p:[mM] Whitespace? {
  return node('PitchGroupScalePrefix', { prefix: p.toLowerCase() });
}
PitchGroupScale = pref:PitchGroupScalePrefix? pitches:PitchGroup som:ScaleOctaveMarker? {
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
Whitespace = [,\n\r\t ]+ { return node('Whitespace',{delimiter:true}); }
Number = n:$([0-9]+ ("." [0-9]*)?) { return Number(n); }
Int = n:$([0-9]+) { return Number(n); }
_ = [ \t\n\r]*
