{
  const node = (type, extra = {}) => ({ type, delimiter: false, ...extra, location: location() });
}

Start = seq:Sequence _ { return node('XenpaperGrammar', { sequence: seq }); }
Sequence = items:ItemList { return node('Sequence', { items }); }
ItemList = head:Item tail:(_ Item)* { return [head, ...tail.map(([,i]) => i)]; } / '' { return []; }
Item = Note / Rest / Chord / BarLine / Whitespace
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
Chord = "[" pitches:PitchGroup "]" tail:Hold? {
  const noteTail = tail ?? undefined;
  const pitchLen = pitches.reduce((sum, p) => sum + p.len, 0);
  const tlen = noteTail ? noteTail.len : 0;
  return node('Chord', { pitches, tail: noteTail, len: 2 + pitchLen + tlen });
}
BarLine = "|" { return node('BarLine',{delimiter:true,len:1}); }
Whitespace = s:$([,\n\r\t ]+) { return node('Whitespace',{delimiter:true,len:s.length}); }
Number = n:$([0-9]+ ("." [0-9]*)?) { return Number(n); }
Int = n:$([0-9]+) { return Number(n); }
_ = [ \t\n\r]*
