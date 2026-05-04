import { describe, it, expect } from 'vitest';
import { XenpaperGrammarParser as parser } from '../reference/grammar';

describe('peggy grammar parser', () => {
  it('parses a single degree note', () => {
    const ast = parser('2');
    expect(ast.sequence.items[0].type).toBe('Note');
    expect(ast.sequence.items[0].pitch.value.type).toBe('PitchDegree');
    expect(ast.sequence.items[0].pitch.value.degree).toBe(2);
  });

  it('parses comma/space separated notes and bars', () => {
    const ast = parser('2,34 |56');
    expect(ast.sequence.items.map((i: any) => i.type)).toEqual([
      'Note',
      'Whitespace',
      'Note',
      'BarLine',
      'Note',
    ]);
  });

  it('parses hold tails', () => {
    const ast = parser('2---');
    expect(ast.sequence.items[0].tail.type).toBe('Hold');
    expect(ast.sequence.items[0].tail.length).toBe(3);
  });
});
