{
  const node = (type, extra = {}) => ({ type, delimiter: false, ...extra, pos: location().start.offset });
}

Start = seq:Sequence _ { return node('XenpaperGrammar', { sequence: seq }); }
Sequence = items:ItemList { return node('Sequence', { items }); }
ItemList = head:Item tail:(_ Item)* { return [head, ...tail.map(([,i]) => i)]; } / '' { return []; }
Item = Note / BarLine / Whitespace
Note = pitch:Pitch tail:Hold? { const tlen = tail ? tail.len : 0; return node('Note', { pitch, tail, len: pitch.len + tlen }); }
Pitch = oct:OctaveModifier? val:(PitchCents / PitchHz / PitchOctaveDivision / PitchRatio / PitchDegree) {
  if (oct) return node('Pitch', { octave: oct, value: val, len: oct.len + val.len });
  return node('Pitch', { value: val, len: val.len });
}
OctaveModifier = s:$([\'"`]+) { const octave = (s.split("'").length - 1) + ((s.split('"').length - 1) * 2) - (s.split('`').length - 1); return node('OctaveModifier', { octave, len: s.length }); }
PitchCents = n:Number [cC] { const s=n.toString(); return node('PitchCents',{cents:n,len:s.length+1}); }
PitchHz = n:Number [hH][zZ] { const s=n.toString(); return node('PitchHz',{hz:n,len:s.length+2}); }
PitchOctaveDivision = n:Int [\\/] d:Int [oO] os:Int? ("/" od:Int)? {
  const ns=n.toString(), ds=d.toString(), oss=os?os.toString():'', ods=od?od.toString():'';
  return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:(os||2)/(od||1),len:ns.length+ds.length+oss.length+2+(od?2+ods.length:0)});
} / n:Int "\\" d:Int { const ns=n.toString(), ds=d.toString(); return node('PitchOctaveDivision',{numerator:n,denominator:d,octaveSize:2,len:ns.length+ds.length+1}); }
PitchRatio = n:Int "/" d:Int { const ns=n.toString(), ds=d.toString(); return node('PitchRatio',{numerator:n,denominator:d,len:ns.length+ds.length+1}); }
PitchDegree = n:Int { const s=n.toString(); return node('PitchDegree',{degree:n,len:s.length}); }
Hold = s:$("|"? "-"+) { return node('Hold',{length:s.replace(/[|]+/g,'').length,len:s.length}); }
BarLine = "|" { return node('BarLine',{delimiter:true,len:1}); }
Whitespace = s:$([,\n\r\t ]+) { return node('Whitespace',{delimiter:true,len:s.length}); }
Number = n:$([0-9]+ ("." [0-9]*)?) { return Number(n); }
Int = n:$([0-9]+) { return Number(n); }
_ = [ \t\n\r]*
