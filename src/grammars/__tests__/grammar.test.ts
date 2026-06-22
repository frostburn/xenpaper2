import { describe, it, expect } from 'vitest'
import * as parserModule from '../grammar.generated.js'
type LooseParserResult = {
  type: unknown
  location: unknown
  sequence: LooseParserResult
  items: [LooseParserResult, ...LooseParserResult[]]
  setters?: [LooseParserResult]
  tail: unknown
}

function parser(input: string): LooseParserResult {
  return parserModule.parse(input, { grammarSource: 'test-input' }) as unknown as LooseParserResult
}

import GRAMMAR_SOURCE from '../grammar.peggy?raw'

const expectParserErrorMessage = (input: string, expectedMessage: string): void => {
  expect(() => parser(input)).toThrow(expectedMessage)
}

const expectParserFormattedErrorMessage = (input: string, expectedMessage: string): void => {
  try {
    parser(input)
    throw new Error(`Expected parser to throw for input: ${input}`)
  } catch (error) {
    if (typeof (error as { format?: unknown }).format === 'function') {
      const message = (
        error as { format: (sources: Array<{ source: string; text: string }>) => string }
      ).format([
        { source: 'grammar.peggy', text: GRAMMAR_SOURCE },
        { source: 'test-input', text: input },
      ])
      expect(message).toBe(expectedMessage)
      return
    }

    throw error
  }
}

const strip = <T>(data: T): T => {
  if (Array.isArray(data)) {
    return data.map((value) => strip(value)) as unknown as T
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const result = Object.keys(record).reduce(
      (obj, key) => {
        if (
          key !== 'pos' &&
          key !== 'location' &&
          key !== 'delimiter' &&
          key !== 'parts' &&
          !(key === 'octave' && record[key] === null)
        ) {
          obj[key] = strip(record[key])
        }
        return obj
      },
      {} as { [key: string]: unknown },
    )

    return result as unknown as T
  }
  return data
}

describe('grammar', () => {
  describe('sequence', () => {
    describe('sequence timing', () => {
      it('should parse sequence with one note', () => {
        const ast = parser('2')
        expect(ast.type).toBe('XenpaperGrammar')
        expect(ast.location).toBeDefined()
        expect(ast.sequence.items).toHaveLength(1)
        expect(strip(ast.sequence.items[0])).toMatchObject({
          type: 'Note',
          pitch: {
            type: 'Pitch',
            value: {
              type: 'PitchDegree',
              degree: 2,
            },
          },
        })
        expect(ast.sequence.items[0].tail).toBeNull()
      })

      it('should parse repeat markers as sequence items', () => {
        expect(
          strip(parser('|:ˣ³ 0 |¹² 1 :|² 2 |(^1) 3 :|(^2) 4 :|: 5').sequence.items),
        ).toMatchObject([
          { type: 'RepeatStart', repeatCount: 3 },
          { type: 'Note' },
          { type: 'RepeatEndingStart', alternateEnding: 12 },
          { type: 'Note' },
          { type: 'RepeatEnd', alternateEnding: 2 },
          { type: 'Note' },
          { type: 'RepeatEndingStart', alternateEnding: 1 },
          { type: 'Note' },
          { type: 'RepeatEnd', alternateEnding: 2 },
          { type: 'Note' },
          { type: 'RepeatEndStart', repeatCount: 2 },
          { type: 'Note' },
        ])
      })

      it('should parse musical control flow markers as sequence items', () => {
        expect(
          strip(
            parser(
              '(Segno) (Coda) (Fine) (D.C. al Fine) (Da Capo al Coda) (D.S. al Fine) (Dal Segno al Coda) (To Coda) (Al Coda)',
            ).sequence.items,
          ),
        ).toMatchObject([
          { type: 'Segno' },
          { type: 'Coda' },
          { type: 'Fine' },
          { type: 'DaCapo', target: 'start', stop: 'fine' },
          { type: 'DaCapo', target: 'start', stop: 'coda' },
          { type: 'DalSegno', target: 'segno', stop: 'fine' },
          { type: 'DalSegno', target: 'segno', stop: 'coda' },
          { type: 'AlCoda' },
          { type: 'AlCoda' },
        ])
      })

      it('should parse sample-rate note grammar', () => {
        expect(strip(parser('!-').sequence.items)).toEqual([
          {
            type: 'SampleRateNote',
            tail: {
              type: 'Hold',
              length: 1,
            },
          },
        ])
      })

      it('should parse sample-rate notes in chords', () => {
        expect(strip(parser('[0 !]').sequence.items)).toEqual([
          {
            type: 'Chord',
            pitches: [
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 0,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'SampleRateNote',
                tail: null,
              },
            ],
            tail: null,
          },
        ])
      })

      it('should not parse sample-rate notes in ratio chords', () => {
        expect(() => parser('4:5:!').sequence.items).toThrow(
          'Expected ":" or integer but "!" found.',
        )
      })

      it('should parse hash comments as sequence items', () => {
        expect(
          strip(parser('# a 7th chord\n[0,4,7,10]--..\n\n# a harmonic 7th chord\n4:5:6:7--..'))
            .sequence.items,
        ).toMatchObject([
          {
            type: 'Comment',
            comment: ' a 7th chord',
          },
          {
            type: 'Chord',
            tail: { type: 'Hold', length: 2 },
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Comment',
            comment: ' a harmonic 7th chord',
          },
          {
            type: 'RatioChord',
            tail: { type: 'Hold', length: 2 },
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Rest',
            length: 1,
          },
        ])
      })

      it('should parse sequence with comma separated notes', () => {
        expect(strip(parser('2,34,56')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 34,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 56,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence with space separated notes', () => {
        expect(strip(parser('2 34 56')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 34,
              },
            },
            tail: null,
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 56,
              },
            },
            tail: null,
          },
        ])
      })

      it('should allow bar lines between items', () => {
        expect(strip(parser('2|34|56|')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: null,
          },
          {
            type: 'BarLine',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 34,
              },
            },
            tail: null,
          },
          {
            type: 'BarLine',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 56,
              },
            },
            tail: null,
          },
          {
            type: 'BarLine',
          },
        ])
      })

      it('should parse sequence with hold separated notes', () => {
        const held = parser('2-34---56')
        expect(held.location).toBeDefined()
        expect(strip(held).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: {
              type: 'Hold',
              length: 1,
            },
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 34,
              },
            },
            tail: {
              type: 'Hold',
              length: 3,
            },
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 56,
              },
            },
            tail: null,
          },
        ])
      })

      it('should emit barlines inside hold tails', () => {
        const held = parser('1--|--')
        const tail = held.sequence.items[0].tail as {
          type: string
          length: number
          parts: Array<{
            type: string
            location: { start: { offset: number }; end: { offset: number } }
          }>
        }

        expect(tail.type).toBe('Hold')
        expect(tail.length).toBe(4)
        expect(tail.parts.map((part) => part.type)).toEqual([
          'HoldDash',
          'HoldDash',
          'BarLine',
          'HoldDash',
          'HoldDash',
        ])
        expect(tail.parts[2]!.location.start.offset).toBe(3)
        expect(tail.parts[2]!.location.end.offset).toBe(4)
      })

      it('should allow comma after hold', () => {
        expect(strip(parser('2-,3')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: {
              type: 'Hold',
              length: 1,
            },
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 3,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence with rest separated notes', () => {
        expect(strip(parser('2.34--...56')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 34,
              },
            },
            tail: {
              type: 'Hold',
              length: 2,
            },
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 56,
              },
            },
            tail: null,
          },
        ])
      })

      it('should allow rest to have comma', () => {
        expect(strip(parser('2.,3')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 3,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence and allow whitespace between items', () => {
        const seq = `|2.  34-- ...
                56`

        expect(strip(parser(seq)).sequence.items).toEqual([
          {
            type: 'BarLine',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 34,
              },
            },
            tail: {
              type: 'Hold',
              length: 2,
            },
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Rest',
            length: 1,
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 56,
              },
            },
            tail: null,
          },
        ])
      })

      it('should error if hold is attempted after a rest', () => {
        expectParserFormattedErrorMessage(
          '2-.-',
          `Error: Expected "!", "#", "(", ".", ":|", ":|:", "[", "{", "|", "|:", Greek nominal, [a-z], apostrophe, end of input, grave, integer, number, quote, or whitespace but "-" found.
 --> test-input:1:4
  |
1 | 2-.-
  |    ^`,
        )
      })

      it('should parse sequence with a hold after a bar line', () => {
        expect(strip(parser('2---|----|')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: {
              type: 'Hold',
              length: 7,
            },
          },
          {
            type: 'BarLine',
          },
        ])
      })

      it('should parse sequence with a hold starting after a bar line', () => {
        expect(strip(parser('2|----|')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: {
              type: 'Hold',
              length: 4,
            },
          },
          {
            type: 'BarLine',
          },
        ])
      })

      it('should parse sequence with a hold across a double bar line', () => {
        expect(strip(parser('2--||---|')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 2,
              },
            },
            tail: {
              type: 'Hold',
              length: 5,
            },
          },
          {
            type: 'BarLine',
          },
        ])
      })
    })

    describe('notes', () => {
      it('should parse sequence with octave modifiers on notes', () => {
        expect(strip(parser('\'0,"0,\'"0,`0,``0')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 0,
              },
              octave: {
                type: 'OctaveModifier',
                octave: 1,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 0,
              },
              octave: {
                type: 'OctaveModifier',
                octave: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 0,
              },
              octave: {
                type: 'OctaveModifier',
                octave: 3,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 0,
              },
              octave: {
                type: 'OctaveModifier',
                octave: -1,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchDegree',
                degree: 0,
              },
              octave: {
                type: 'OctaveModifier',
                octave: -2,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence with fraction notes', () => {
        expect(strip(parser('2/3,3/4')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchRatio',
                numerator: 2,
                denominator: 3,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchRatio',
                numerator: 3,
                denominator: 4,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence with octave fraction notes', () => {
        expect(strip(parser('2/3 ed,3/4 ed 3,3/4 < 3 / 2 >')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchOctaveDivision',
                numerator: 2,
                denominator: 3,
                octaveSize: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchOctaveDivision',
                numerator: 3,
                denominator: 4,
                octaveSize: 3,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchOctaveDivision',
                numerator: 3,
                denominator: 4,
                octaveSize: 1.5,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence with backslash octave fraction notes', () => {
        expect(strip(parser('2\\3,5\\13 ed 3,5\\13 < 3 >')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchOctaveDivision',
                numerator: 2,
                denominator: 3,
                octaveSize: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchOctaveDivision',
                numerator: 5,
                denominator: 13,
                octaveSize: 3,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchOctaveDivision',
                numerator: 5,
                denominator: 13,
                octaveSize: 3,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence with cents notes', () => {
        expect(strip(parser('2c,2.c,2.2c')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchCents',
                cents: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchCents',
                cents: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchCents',
                cents: 2.2,
              },
            },
            tail: null,
          },
        ])
      })

      it('should parse sequence with hz notes', () => {
        expect(strip(parser('2hz,2.Hz,2.2HZ')).sequence.items).toEqual([
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchHz',
                hz: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchHz',
                hz: 2,
              },
            },
            tail: null,
          },
          {
            type: 'Whitespace',
          },
          {
            type: 'Note',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchHz',
                hz: 2.2,
              },
            },
            tail: null,
          },
        ])
      })
    })

    describe('chord', () => {
      it('should parse sequence with a chord', () => {
        expect(strip(parser('[0c,100c, 200c]--')).sequence.items).toEqual([
          {
            type: 'Chord',
            pitches: [
              {
                type: 'Pitch',
                value: {
                  type: 'PitchCents',
                  cents: 0,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchCents',
                  cents: 100,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchCents',
                  cents: 200,
                },
              },
            ],
            tail: {
              type: 'Hold',
              length: 2,
            },
          },
        ])
      })

      it('should parse adjacent chord pitches like adjacent sequence notes', () => {
        expect(strip(parser("[0'1!]")).sequence.items).toEqual(
          strip(parser("[0 '1 !]")).sequence.items,
        )
      })

      it('should parse sequence with chord holds across bar lines', () => {
        expect(strip(parser('[0c,100c, 200c]--|---|')).sequence.items).toEqual([
          {
            type: 'Chord',
            pitches: [
              {
                type: 'Pitch',
                value: {
                  type: 'PitchCents',
                  cents: 0,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchCents',
                  cents: 100,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchCents',
                  cents: 200,
                },
              },
            ],
            tail: {
              type: 'Hold',
              length: 5,
            },
          },
          {
            type: 'BarLine',
          },
        ])
      })

      it('should parse sequence with chord holds across double bar lines', () => {
        expect(strip(parser('[0]--||---|')).sequence.items).toEqual([
          {
            type: 'Chord',
            pitches: [
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 0,
                },
              },
            ],
            tail: {
              type: 'Hold',
              length: 5,
            },
          },
          {
            type: 'BarLine',
          },
        ])
      })

      it('should error if chord is empty or not delimited properly', () => {
        expectParserErrorMessage(
          '[]',
          'Expected "!", Greek nominal, [a-z], apostrophe, grave, integer, number, or quote but "]" found.',
        )
      })

      it('should parse sequence with a ratio chord', () => {
        expect(strip(parser('4:5:6:7--')).sequence.items).toEqual([
          {
            type: 'RatioChord',
            pitches: [
              { type: 'RatioChordPitch', pitch: 4 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 5 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 6 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 7 },
            ],
            tail: { type: 'Hold', length: 2 },
          },
        ])
      })

      it('should parse sequence with ratio chord holds across bar lines', () => {
        expect(strip(parser('4:5:6:7--|---|')).sequence.items).toEqual([
          {
            type: 'RatioChord',
            pitches: [
              { type: 'RatioChordPitch', pitch: 4 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 5 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 6 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 7 },
            ],
            tail: { type: 'Hold', length: 5 },
          },
          {
            type: 'BarLine',
          },
        ])
      })

      it('should parse sequence with ratio chord holds across double bar lines', () => {
        expect(strip(parser('4:5:6:7--||---|')).sequence.items).toEqual([
          {
            type: 'RatioChord',
            pitches: [
              { type: 'RatioChordPitch', pitch: 4 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 5 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 6 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 7 },
            ],
            tail: { type: 'Hold', length: 5 },
          },
          {
            type: 'BarLine',
          },
        ])
      })

      it('should parse sequence with a ratio chord in square brackets', () => {
        expect(strip(parser('[4:5:6:7]--')).sequence.items).toEqual([
          {
            type: 'Chord',
            pitches: [
              { type: 'RatioChordPitch', pitch: 4 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 5 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 6 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 7 },
            ],
            tail: { type: 'Hold', length: 2 },
          },
        ])
      })

      it('should parse sequence with a ratio chord with interpolation', () => {
        expect(strip(parser('4::7::10--')).sequence.items).toEqual([
          {
            type: 'RatioChord',
            pitches: [
              { type: 'RatioChordPitch', pitch: 4 },
              { type: 'Colon' },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 7 },
              { type: 'Colon' },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 10 },
            ],
            tail: { type: 'Hold', length: 2 },
          },
        ])
      })

      it('should parse sequence with a chord with octave modifiers', () => {
        expect(strip(parser("[0,7,'0]")).sequence.items).toEqual([
          {
            type: 'Chord',
            pitches: [
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 0,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 7,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 0,
                },
                octave: {
                  type: 'OctaveModifier',
                  octave: 1,
                },
              },
            ],
            tail: null,
          },
        ])
      })

      it('should parse chord and ratio chord syntax with additional whitespace', () => {
        expect(strip(parser("[ 0, 7, '0 ] 4 : 5 :: 6")).sequence.items).toEqual([
          {
            type: 'Chord',
            pitches: [
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 0,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 7,
                },
              },
              {
                type: 'Whitespace',
              },
              {
                type: 'Pitch',
                value: {
                  type: 'PitchDegree',
                  degree: 0,
                },
                octave: {
                  type: 'OctaveModifier',
                  octave: 1,
                },
              },
            ],
            tail: null,
          },
          {
            type: 'RatioChord',
            pitches: [
              { type: 'RatioChordPitch', pitch: 4 },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 5 },
              { type: 'Colon' },
              { type: 'Colon' },
              { type: 'RatioChordPitch', pitch: 6 },
            ],
            tail: null,
          },
        ])
      })
    })

    describe('scale setters', () => {
      it('should parse sequence with edo setter', () => {
        expect(strip(parser('{12edo}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'EdoScale',
              divisions: 12,
              octaveSize: 2,
            },
          },
        ])
      })

      it('should parse sequence with ed2 setter', () => {
        expect(strip(parser('{12ed2}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'EdoScale',
              divisions: 12,
              octaveSize: 2,
            },
          },
        ])
      })

      it('should parse sequence with ed0 and ed1 setters', () => {
        expect(strip(parser('{5ed0}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'EdoScale',
              divisions: 5,
              octaveSize: 0,
            },
          },
        ])

        expect(strip(parser('{5ed1}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'EdoScale',
              divisions: 5,
              octaveSize: 1,
            },
          },
        ])
      })

      it('should parse sequence with ed3 setter', () => {
        expect(strip(parser('{12ed3}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'EdoScale',
              divisions: 12,
              octaveSize: 3,
            },
          },
        ])
      })

      it('should parse sequence with ed3/2 setter', () => {
        expect(strip(parser('{12ed3/2}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'EdoScale',
              divisions: 12,
              octaveSize: 1.5,
            },
          },
        ])
      })

      it('should not parse octave-size denominator without a numerator', () => {
        expectParserErrorMessage('{12edo/3}', 'Expected "}" or integer but "/" found.')
        expectParserErrorMessage('{12ed/3}', 'Expected "o", "}", or integer but "/" found.')
      })

      it('should parse sequence with ratio scale setter', () => {
        expect(strip(parser('{4:5:6}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'RatioChordScale',
              pitches: [
                {
                  type: 'RatioChordPitch',
                  pitch: 4,
                },
                {
                  type: 'Colon',
                },
                {
                  type: 'RatioChordPitch',
                  pitch: 5,
                },
                {
                  type: 'Colon',
                },
                {
                  type: 'RatioChordPitch',
                  pitch: 6,
                },
              ],
              scaleOctaveMarker: null,
            },
          },
        ])

        expect(strip(parser("{4:5:6'}")).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'RatioChordScale',
              pitches: [
                {
                  type: 'RatioChordPitch',
                  pitch: 4,
                },
                {
                  type: 'Colon',
                },
                {
                  type: 'RatioChordPitch',
                  pitch: 5,
                },
                {
                  type: 'Colon',
                },
                {
                  type: 'RatioChordPitch',
                  pitch: 6,
                },
              ],
              scaleOctaveMarker: {
                type: 'ScaleOctaveMarker',
              },
            },
          },
        ])

        expect(strip(parser('{4:6::8}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'RatioChordScale',
              pitches: [
                {
                  type: 'RatioChordPitch',
                  pitch: 4,
                },
                {
                  type: 'Colon',
                },
                {
                  type: 'RatioChordPitch',
                  pitch: 6,
                },
                {
                  type: 'Colon',
                },
                {
                  type: 'Colon',
                },
                {
                  type: 'RatioChordPitch',
                  pitch: 8,
                },
              ],
              scaleOctaveMarker: null,
            },
          },
        ])
      })

      it('should parse sequence with pitch set scale setter', () => {
        expect(strip(parser('{1/1,9/8,5/4}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'PitchGroupScale',
              pitchGroupScalePrefix: null,
              pitches: [
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 1,
                    denominator: 1,
                  },
                },
                {
                  type: 'Whitespace',
                },
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 9,
                    denominator: 8,
                  },
                },
                {
                  type: 'Whitespace',
                },
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 5,
                    denominator: 4,
                  },
                },
              ],
              scaleOctaveMarker: null,
            },
          },
        ])

        expect(strip(parser("{1/1,9/8,5/4'}")).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'PitchGroupScale',
              pitchGroupScalePrefix: null,
              pitches: [
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 1,
                    denominator: 1,
                  },
                },
                {
                  type: 'Whitespace',
                },
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 9,
                    denominator: 8,
                  },
                },
                {
                  type: 'Whitespace',
                },
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 5,
                    denominator: 4,
                  },
                },
              ],
              scaleOctaveMarker: {
                type: 'ScaleOctaveMarker',
              },
            },
          },
        ])

        expect(strip(parser('{m 2 1}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'PitchGroupScale',
              pitchGroupScalePrefix: {
                type: 'PitchGroupScalePrefix',
                prefix: 'm',
              },
              pitches: [
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchDegree',
                    degree: 2,
                  },
                },
                {
                  type: 'Whitespace',
                },
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchDegree',
                    degree: 1,
                  },
                },
              ],
              scaleOctaveMarker: null,
            },
          },
        ])

        expect(strip(parser('{m2 1}')).sequence.items).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'PitchGroupScale',
              pitchGroupScalePrefix: {
                type: 'PitchGroupScalePrefix',
                prefix: 'm',
              },
              pitches: [
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchDegree',
                    degree: 2,
                  },
                },
                {
                  type: 'Whitespace',
                },
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchDegree',
                    degree: 1,
                  },
                },
              ],
              scaleOctaveMarker: null,
            },
          },
        ])
      })

      it('should parse scale setters with additional whitespace', () => {
        expect(
          strip(parser("{ 12 edo 3 / 2 }{ 4 : 5 :: 6 ' }{ m 1 / 1, 9 / 8 ' }")).sequence.items,
        ).toEqual([
          {
            type: 'SetScale',
            scale: {
              type: 'EdoScale',
              divisions: 12,
              octaveSize: 1.5,
            },
          },
          {
            type: 'SetScale',
            scale: {
              type: 'RatioChordScale',
              pitches: [
                { type: 'RatioChordPitch', pitch: 4 },
                { type: 'Colon' },
                { type: 'RatioChordPitch', pitch: 5 },
                { type: 'Colon' },
                { type: 'Colon' },
                { type: 'RatioChordPitch', pitch: 6 },
              ],
              scaleOctaveMarker: {
                type: 'ScaleOctaveMarker',
              },
            },
          },
          {
            type: 'SetScale',
            scale: {
              type: 'PitchGroupScale',
              pitchGroupScalePrefix: {
                type: 'PitchGroupScalePrefix',
                prefix: 'm',
              },
              pitches: [
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 1,
                    denominator: 1,
                  },
                },
                {
                  type: 'Whitespace',
                },
                {
                  type: 'Pitch',
                  value: {
                    type: 'PitchRatio',
                    numerator: 9,
                    denominator: 8,
                  },
                },
              ],
              scaleOctaveMarker: {
                type: 'ScaleOctaveMarker',
              },
            },
          },
        ])
      })
    })

    describe('setters', () => {
      it('should parse sequence with bpm setter', () => {
        expect(strip(parser('(bpm:440; bpm: 432.5)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetBpm',
                bpm: 440,
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetBpm',
                bpm: 432.5,
              },
            ],
          },
        ])
      })

      it('should parse sequence with up and lift setters', () => {
        expect(strip(parser('(^:81/80; /: 64/63)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetUp',
                value: {
                  type: 'PitchRatio',
                  numerator: 81,
                  denominator: 80,
                },
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetLift',
                value: {
                  type: 'PitchRatio',
                  numerator: 64,
                  denominator: 63,
                },
              },
            ],
          },
        ])
      })

      it('should parse up and lift setters with cents and octave divisions', () => {
        expect(strip(parser('(^:25c; /: 1/12ed)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetUp',
                value: {
                  type: 'PitchCents',
                  cents: 25,
                },
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetLift',
                value: {
                  type: 'PitchOctaveDivision',
                  numerator: 1,
                  denominator: 12,
                  octaveSize: 2,
                },
              },
            ],
          },
        ])
      })

      it('should parse sequence with bms setter', () => {
        expect(strip(parser('(bms:100; bms: 999.2)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetBms',
                bms: 100,
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetBms',
                bms: 999.2,
              },
            ],
          },
        ])
      })

      it('should parse sequence with subdivision setter', () => {
        expect(strip(parser('(div:4; div:1/4)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetSubdivision',
                subdivision: 4,
                denominator: 1,
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetSubdivision',
                subdivision: 1,
                denominator: 4,
              },
            ],
          },
        ])
      })

      it('should parse sequence with shorthand subdivision setter', () => {
        expect(strip(parser('(4)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetSubdivision',
                subdivision: 4,
                denominator: 1,
              },
            ],
          },
        ])
      })

      it('should parse sequence with fraction shorthand subdivision setter', () => {
        expect(strip(parser('(1/2)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetSubdivision',
                subdivision: 1,
                denominator: 2,
              },
            ],
          },
        ])
      })

      it('should parse tutorial sequence with inline subdivision changes', () => {
        const ast = strip(parser('0 2 3 7(3)0 2 3 7(4)0 2 3 7(1/2)0 2 3 7'))
        expect(ast.sequence.items.filter((item) => item.type === 'SetterGroup')).toEqual([
          {
            type: 'SetterGroup',
            setters: [{ type: 'SetSubdivision', subdivision: 3, denominator: 1 }],
          },
          {
            type: 'SetterGroup',
            setters: [{ type: 'SetSubdivision', subdivision: 4, denominator: 1 }],
          },
          {
            type: 'SetterGroup',
            setters: [{ type: 'SetSubdivision', subdivision: 1, denominator: 2 }],
          },
        ])
      })

      it('should parse sequence with root setter', () => {
        expect(
          strip(parser('{r6}{r7/5}{r300hz}{r400HZ}{r261.6256Hz as C}{r as C}')).sequence.items,
        ).toEqual([
          {
            type: 'SetRoot',
            pitch: {
              type: 'Pitch',
              value: {
                degree: 6,
                type: 'PitchDegree',
              },
            },
            rootNominal: null,
          },
          {
            type: 'SetRoot',
            pitch: {
              type: 'Pitch',
              value: {
                numerator: 7,
                denominator: 5,
                type: 'PitchRatio',
              },
            },
            rootNominal: null,
          },
          {
            type: 'SetRoot',
            pitch: {
              type: 'Pitch',
              value: {
                hz: 300,
                type: 'PitchHz',
              },
            },
            rootNominal: null,
          },
          {
            type: 'SetRoot',
            pitch: {
              type: 'Pitch',
              value: {
                hz: 400,
                type: 'PitchHz',
              },
            },
            rootNominal: null,
          },
          {
            type: 'SetRoot',
            pitch: {
              type: 'Pitch',
              value: {
                hz: 261.6256,
                type: 'PitchHz',
              },
            },
            rootNominal: {
              type: 'PitchAbsolute',
              ups: 0,
              lifts: 0,
              nominal: 'C',
              greek: false,
              accidentals: [],
              inflections: [],
            },
          },
          {
            type: 'SetRoot',
            pitch: null,
            rootNominal: {
              type: 'PitchAbsolute',
              ups: 0,
              lifts: 0,
              nominal: 'C',
              greek: false,
              accidentals: [],
              inflections: [],
            },
          },
        ])
      })

      it('should parse sequence with osc setter', () => {
        expect(strip(parser('(osc:sine; osc: saw4)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetOsc',
                osc: 'sine',
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetOsc',
                osc: 'saw4',
              },
            ],
          },
        ])
      })

      it('should parse osc setter with a name containing a dash', () => {
        expect(strip(parser('(osc:12-TET)').sequence.items[0]!.setters![0])).toEqual({
          type: 'SetOsc',
          osc: '12-tet',
        })
      })

      it('should parse sequence with noise setter', () => {
        expect(strip(parser('(noise:white; noise: WHITE)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetNoise',
                noise: 'white',
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetNoise',
                noise: 'white',
              },
            ],
          },
        ])
      })

      it('should parse sequence with env setter', () => {
        expect(strip(parser('(env:0123; env: 9873)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetEnv',
                a: 0,
                d: 1,
                s: 2,
                r: 3,
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetEnv',
                a: 9,
                d: 8,
                s: 7,
                r: 3,
              },
            ],
          },
        ])
      })

      it('should parse sequence with ruler setter', () => {
        expect(strip(parser('(rl:200c,400c)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetRulerRange',
                high: {
                  type: 'Pitch',
                  value: {
                    cents: 400,
                    type: 'PitchCents',
                  },
                },
                low: {
                  type: 'Pitch',
                  value: {
                    cents: 200,
                    type: 'PitchCents',
                  },
                },
              },
            ],
          },
        ])
      })

      it('should parse sequence with ruler plot', () => {
        expect(strip(parser('(plot)')).sequence.items).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetRulerPlot',
              },
            ],
          },
        ])
      })

      it('should parse setters with additional whitespace', () => {
        expect(
          strip(
            parser('( bpm : 440 ; div : 1 / 4 ; env : 0 1 2 3 ; rl : 200c , 400 hz ){ r 7 / 5 }'),
          ).sequence.items,
        ).toEqual([
          {
            type: 'SetterGroup',
            setters: [
              {
                type: 'SetBpm',
                bpm: 440,
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetSubdivision',
                subdivision: 1,
                denominator: 4,
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetEnv',
                a: 0,
                d: 1,
                s: 2,
                r: 3,
              },
              {
                type: 'Semicolon',
              },
              {
                type: 'SetRulerRange',
                low: {
                  type: 'Pitch',
                  value: {
                    type: 'PitchCents',
                    cents: 200,
                  },
                },
                high: {
                  type: 'Pitch',
                  value: {
                    type: 'PitchHz',
                    hz: 400,
                  },
                },
              },
            ],
          },
          {
            type: 'SetRoot',
            pitch: {
              type: 'Pitch',
              value: {
                type: 'PitchRatio',
                numerator: 7,
                denominator: 5,
              },
            },
            rootNominal: null,
          },
        ])
      })

      it('should error if setter is empty or not delimited properly', () => {
        expectParserErrorMessage(
          '()',
          'Expected "/", "^", "al", "bms", "bpm", "coda", "d", "da", "dal", "div", "env", "fine", "key", "noise", "osc", "plot", "rl", "segno", "to", or integer but ")" found.',
        )
        expectParserErrorMessage('(div:16;)', 'but ")" found.')
        expectParserErrorMessage('(div:16;;div:16)', 'but ";" found.')
        expectParserErrorMessage('(env:123)', 'Expected four digits but "1" found.')
      })
    })
  })
})
