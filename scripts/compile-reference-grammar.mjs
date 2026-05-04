import { readFileSync, writeFileSync } from 'node:fs';
import peggy from 'peggy';

const input = 'src/grammars/reference/grammar.peggy';
const output = 'src/grammars/reference/grammar.generated.js';
const source = readFileSync(input, 'utf8');
const code = peggy.generate(source, { format: 'es', output: 'source' });
writeFileSync(output, code);
console.log(`Compiled ${input} -> ${output}`);
