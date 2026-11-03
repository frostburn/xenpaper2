import { describe, expect, it } from 'vitest'
import { parse } from '../grammar.generated.js'
import { grammarToChars } from '../grammar-to-chars'
import { processGrammar } from '../process-grammar'

const parsed = (source: string) => parse(source, { grammarSource: 'test-input' })
const score = (source: string) => processGrammar(parsed(source)).score
const timing = (source: string) => {
  const result = score(source)
  return {
    duration: result.lengthTime,
    notes: result.sequence
      .filter((item) => item.type === 'NOTE_BEAT_TIME')
      .map((note) => [note.time, note.timeEnd]),
  }
}

describe('binary note ties', () => {
  it.each(['C=>C', 'C => C', '0=>0', '3/2=>3/2', '1\\12=>1\\12'])(
    'parses compact and spaced operands: %s',
    (source) => {
      expect(parsed(source).sequence.items[0]).toMatchObject({ type: 'Tie' })
      expect(timing(source)).toEqual({ duration: 1, notes: [[0, 1]] })
    },
  )

  it('binds below holds and above sequencing, and associates to the left', () => {
    expect(parsed('C- => C-- => C D').sequence.items[0]).toMatchObject({
      type: 'Tie',
      left: { type: 'Tie', left: { tail: { length: 1 } }, right: { tail: { length: 2 } } },
      right: { type: 'Note' },
    })
    expect(timing('C- => C-- => C D')).toEqual({
      duration: 3.5,
      notes: [[0, 3], [3, 3.5]],
    })
  })

  it.each(['C=>', '=>C', '.=>C', 'C=>.', 'C -> C', 'C |: => C', 'C |¹ => C'])(
    'rejects missing or non-note operands and repeat boundaries: %s',
    (source) => {
      expect(() => parsed(source)).toThrow()
    },
  )

  it.each(['C|=>C', 'C | => C', 'C => | C', 'C | # across the bar\n => C'])(
    'keeps barlines and comments between operands: %s',
    (source) => {
      expect(timing(source)).toEqual({ duration: 1, notes: [[0, 1]] })
    },
  )

  it('validates the meter of barlines crossed by ties', () => {
    for (const [source, errors] of [
      ['(time:4/4)(4)C--- | => C--- ||', 0],
      ['(time:4/4)(4)C | => C', 1],
    ] as const) {
      const ast = parsed(source)
      processGrammar(ast)
      expect(grammarToChars(ast).filter((char) => char?.color === 'error')).toHaveLength(errors)
    }
  })

  it('ties matching chord tones and leaves unmatched attacks in their slots', () => {
    expect(timing('[C E G] => [C F A]')).toEqual({
      duration: 1,
      notes: [[0, 1], [0, 0.5], [0, 0.5], [0.5, 1], [0.5, 1]],
    })
    expect(timing('C => D')).toEqual({ duration: 1, notes: [[0, 0.5], [0.5, 1]] })
  })

  it('matches every duplicate on both sides and keeps all surviving voices in chains', () => {
    expect(timing('[C C] => [C C]')).toEqual({ duration: 1, notes: [[0, 1], [0, 1]] })
    expect(timing('[C E] => [C F] => [C E]')).toEqual({
      duration: 1.5,
      notes: [[0, 1.5], [0, 1.5], [0.5, 1]],
    })
  })

  it('matches sounding pitch across spellings and pitch kinds', () => {
    expect(timing('{12edo} C# => Db')).toEqual({ duration: 1, notes: [[0, 1]] })
    expect(timing('C# => Db').notes).toHaveLength(2)
    expect(timing('0 => 1/1')).toEqual({ duration: 1, notes: [[0, 1]] })
    expect(timing('1/1 => 0c')).toEqual({ duration: 1, notes: [[0, 1]] })
    expect(timing('1/1 => 220Hz')).toEqual({ duration: 1, notes: [[0, 1]] })
    expect(timing('[4:5:6] => 4:5:7').notes).toHaveLength(4)
    expect(timing('220Hz => 220.001Hz').notes).toHaveLength(2)
  })

  it('retains the original attack velocity and the target articulation endpoint', () => {
    const notes = score('(vel:80%;art:50%)C => C').sequence.filter(
      (item) => item.type === 'NOTE_BEAT_TIME',
    )
    expect(notes).toMatchObject([{ time: 0, timeEnd: 0.75, velocity: 0.8 }])
    expect(notes).toHaveLength(1)
  })

  it('preserves grace-note timing and groove slots', () => {
    expect(timing('(8?)C => C')).toEqual({ duration: 0.5, notes: [[0, 0.5]] })
    expect(score('(groove:(5)!-- !-)0 => 0 2').lengthTime).toBe(
      score('(groove:(5)!-- !-)0 0 2').lengthTime,
    )
  })

  it('ties sample-rate notes without mixing them with ordinary pitches', () => {
    const result = score('!=>! 0=>!')
    expect(result.sequence.filter((item) => item.type === 'SAMPLE_RATE_NOTE_BEAT_TIME')).toMatchObject([
      { time: 0, timeEnd: 1 },
      { time: 1.5, timeEnd: 2 },
    ])
    expect(result.sequence.filter((item) => item.type === 'NOTE_BEAT_TIME')).toHaveLength(1)
  })

  it('keeps ties inside repeats and attaches repeat-end holds to the right operand', () => {
    expect(timing('|: C=>C :|')).toEqual({
      duration: 2,
      notes: [[0, 1], [1, 2]],
    })
    expect(timing('|: C=>C :|--')).toEqual({
      duration: 3,
      notes: [[0, 1], [1, 3]],
    })
    expect(timing('|: C=>C |¹ D :|² E').notes).toHaveLength(4)
  })

  it('preserves musical control flow and active drones', () => {
    expect(timing('C=>C (fine) D (dc al fine)')).toEqual({
      duration: 2.5,
      notes: [[0, 1], [1, 1.5], [1.5, 2.5]],
    })
    const notes = score('(drone:0)0=>0 2').sequence.filter(
      (item) => item.type === 'NOTE_BEAT_TIME',
    )
    expect(notes.map((note) => [note.time, note.timeEnd])).toEqual([[0, 1.5], [0, 1], [1, 1.5]])
  })

  it('colors operators while preserving all operand and separator colors', () => {
    // Tie itself is structural and intentionally uncolored; children cover its text.
    expect(grammarToChars(parsed('C=>C=>[C E]')).map((char) => char?.color)).toEqual([
      'pitch', 'delimiter', 'delimiter', 'pitch', 'delimiter', 'delimiter',
      'chord', 'pitch', 'pitch', 'pitch', 'chord',
    ])
    const source = 'C | # tie\n => C'
    const ast = parsed(source)
    processGrammar(ast)
    const chars = grammarToChars(ast)
    expect(chars[source.indexOf('|')]?.color).toBe('delimiter')
    expect(chars[source.indexOf('#')]?.color).toBe('commentStart')
    expect(chars[source.indexOf('=>')]?.color).toBe('delimiter')
    expect(chars[source.lastIndexOf('C')]?.color).toBe('pitch')
  })

  it('retains playback highlighting for the sustained source and removed target', () => {
    const ast = parsed('C=>C')
    processGrammar(ast)
    const chars = grammarToChars(ast)
    expect(chars[0]?.playTimes).toEqual([[0, 0.5]])
    expect(chars[3]?.playTimes).toEqual([[0.25, 0.5]])
  })
})
