{
  const node = (type, extra = {}) => ({ type, delimiter: false, ...extra, location: location() });
}

Start = seq:Sequence _ { return node('XenpaperGrammar', { sequence: seq }); }
Sequence = items:ItemList { return node('Sequence', { items }); }
ItemList = head:Item tail:(_ Item)* { return [head, ...tail.map(([,i]) => i)]; } / '' { return []; }
Item = SetterGroup / SetRoot / SetScale / RatioChordItem / Note / Rest / Chord / BarLine / Whitespace
Note = pitch:Pitch tail:Hold? cont:($("|" "-"+))* {
  const extraText = cont.join('');
  const extraLen = extraText.length;
  const extraHolds = extraText.replace(/[|]+/g, '').length;
  const baseTail = tail ?? undefined;
  const totalLen = (baseTail?.len ?? 0) + extraLen;
  const totalHolds = (baseTail?.length ?? 0) + extraHolds;
  const noteTail = totalLen > 0 ? node('Hold', { length: totalHolds, len: totalLen }) : undefined;
  return node('Note', { pitch, tail: noteTail, len: pitch.len + totalLen });
}
Pitch = oct:OctaveModifier? val:(PitchCents / PitchHz / PitchOctaveDivision / PitchRatio / PitchDegree) {
  if (oct) return node('Pitch', { octave: oct, value: val, len: oct.len + val.len });
  return node('Pitch', { value: val, len: val.len });
}
OctaveModifier = s:$([\'"`]+) { const octave = (s.split("'").length - 1) + ((s.split('"').length - 1) * 2) - (s.split('`').length - 1); return node('OctaveModifier', { octave, len: s.length }); }
PitchCents = n:Number [cC] { const s=n.toString(); return node('PitchCents',{cents:n,len:s.length+1}); }
PitchHz = n:Number [hH][zZ] { const s=n.toString(); return node('PitchHz',{hz:n,len:s.length+2}); }
PitchOctaveDivision = n:Int [\\/] d:Int [oO] os:Int? divPart:("/" od:Int)? {
  const octaveDenom = divPart ? divPart[1] : 1;
  return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:(os||2)/octaveDenom,len:text().length});
} / n:Int "\\" d:Int { const ns=n.toString(), ds=d.toString(); return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:2,len:ns.length+ds.length+1}); }
PitchRatio = n:Int "/" d:Int { const ns=n.toString(), ds=d.toString(); return node('PitchRatio',{numerator:n,denominator:d,len:ns.length+ds.length+1}); }
PitchDegree = n:Int { const s=n.toString(); return node('PitchDegree',{degree:n,len:s.length}); }
Hold = s:$("|"? "-"+) { return node('Hold',{length:s.replace(/[|]+/g,'').length,len:s.length}); }
Rest = "." { return node('Rest', { length: 1, len: 1 }); }
PitchGroup = first:Pitch rest:(Whitespace Pitch)* {
  const result = [first];
  for (const pair of rest) {
    result.push(pair[0], pair[1]);
  }
  return result;
}
RatioChordPitch = n:Int { return node('RatioChordPitch', { pitch: n, len: text().length }); }
Colon = ":" { return node('Colon', { delimiter: true, len: 1 }); }
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
  const pitchLen = pitches.reduce((sum, p) => sum + p.len, 0);
  const tlen = noteTail ? noteTail.len : 0;
  return node('RatioChord', { pitches, tail: noteTail, len: pitchLen + tlen });
}
RatioChordItem = &([0-9]+ ":") rc:RatioChord { return rc; }
Chord = "[" pitches:((&([0-9]+ ":") rp:RatioChordPitches { return rp; }) / PitchGroup) "]" tail:Hold? {
  const noteTail = tail ?? undefined;
  const pitchLen = pitches.reduce((sum, p) => sum + p.len, 0);
  const tlen = noteTail ? noteTail.len : 0;
  return node('Chord', { pitches, tail: noteTail, len: 2 + pitchLen + tlen });
}
BarLine = "|" { return node('BarLine',{delimiter:true,len:1}); }
Semicolon = ";" ws:Whitespace? { return node('Semicolon', { delimiter: true, len: 1 + (ws?.len ?? 0) }); }
SetterGroup = "(" first:Setter rest:(Semicolon Setter)* ")" {
  const setters = [first];
  for (const part of rest) setters.push(part[0], part[1]);
  const contentLen = setters.reduce((sum, s) => sum + s.len, 0);
  return node('SetterGroup', { setters, len: contentLen + 2 });
}
Setter = SetBpm / SetBms / SetSubdivision / SetOsc / SetEnv / SetRulerRange / SetRulerPlot
SetBpm = [bB][pP][mM] ":" ws:Whitespace? bpm:Number { return node('SetBpm', { bpm, len: 4 + (ws?.len ?? 0) + bpm.toString().length }); }
SetBms = [bB][mM][sS] ":" ws:Whitespace? bms:Number { return node('SetBms', { bms, len: 4 + (ws?.len ?? 0) + bms.toString().length }); }
SetSubdivision = ([dD][iI][vV] ":" ws:Whitespace? n:Int frac:("/" d:Int)? {
  return node('SetSubdivision', { subdivision: n, denominator: frac ? frac[1] : undefined, len: 4 + (ws?.len ?? 0) + n.toString().length + (frac ? (1 + frac[1].toString().length) : 0) });
}) / (n:Int { return node('SetSubdivision', { subdivision: n, denominator: undefined, len: n.toString().length }); })
SetOsc = [oO][sS][cC] ":" ws:Whitespace? osc:$([a-zA-Z0-9]+) { return node('SetOsc', { osc: osc.toLowerCase(), len: 4 + (ws?.len ?? 0) + osc.length }); }
SetEnv = [eE][nN][vV] ":" ws:Whitespace? vals:$([0-9][0-9][0-9][0-9]) {
  return node('SetEnv', { a: Number(vals[0]), d: Number(vals[1]), s: Number(vals[2]), r: Number(vals[3]), len: 4 + (ws?.len ?? 0) + 4 });
}
SetRulerRange = [rR][lL] ":" low:Pitch "," high:Pitch { return node('SetRulerRange', { low, high, len: 3 + low.len + 1 + high.len }); }
SetRulerPlot = [pP][lL][oO][tT] { return node('SetRulerPlot', { len: 4 }); }
SetRoot = "{r" p:Pitch "}" { return node('SetRoot', { pitch: p, len: p.len + 3 }); }
SetScale = "{" scale:(EdoScale / RatioChordScale / PitchGroupScale) "}" {
  return node('SetScale', { scale, len: scale.len + 2 });
}
EdoScale = div:Int [eE][dD] [oO0]? os:Int? frac:("/" den:Int)? {
  const den = frac ? frac[1] : 1;
  const octaveSize = (os ?? 2) / den;
  return node('EdoScale', { divisions: div, octaveSize, len: text().length });
}
ScaleOctaveMarker = "'" { return node('ScaleOctaveMarker', { len: 1 }); }
RatioChordScale = first:RatioChordPitch colons:(Colon)+ rest:(RatioChordPitch (Colon RatioChordPitch)*) som:ScaleOctaveMarker? {
  const pitches = [first, ...colons, rest[0], ...rest[1].flat()];
  const scaleOctaveMarker = som ?? undefined;
  const baseLen = pitches.reduce((sum, p) => sum + p.len, 0);
  return node('RatioChordScale', { pitches, scaleOctaveMarker, len: baseLen + (scaleOctaveMarker?.len ?? 0) });
}
PitchGroupScalePrefix = p:[mM] ws:Whitespace? {
  const w = ws ?? undefined;
  return node('PitchGroupScalePrefix', { prefix: p.toLowerCase(), len: 1 + (w?.len ?? 0) });
}
PitchGroupScale = pref:PitchGroupScalePrefix? pitches:PitchGroup som:ScaleOctaveMarker? {
  const pitchGroupScalePrefix = pref ?? undefined;
  const scaleOctaveMarker = som ?? undefined;
  const pitchLen = pitches.reduce((sum, p) => sum + p.len, 0);
  return node('PitchGroupScale', {
    pitchGroupScalePrefix,
    pitches,
    scaleOctaveMarker,
    len: (pitchGroupScalePrefix?.len ?? 0) + pitchLen + (scaleOctaveMarker?.len ?? 0)
  });
}
Whitespace = s:$([,\n\r\t ]+) { return node('Whitespace',{delimiter:true,len:s.length}); }
Number = n:$([0-9]+ ("." [0-9]*)?) { return Number(n); }
Int = n:$([0-9]+) { return Number(n); }
_ = [ \t\n\r]*
