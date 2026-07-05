import { describe, expect, it } from 'vitest'
import { getTimeAtLine } from '../../utils'
import { grammarToChars, type CharData } from '../grammar-to-chars'
import type { XenpaperAST } from '../grammar.generated'
import * as parserModule from '../grammar.generated.js'
import { processGrammar } from '../process-grammar'

const parser = (
  parserModule as {
    parse: (input: string, options: { grammarSource: string }) => XenpaperAST
  }
).parse

const parse = (input: string): XenpaperAST => parser(input, { grammarSource: 'test-input' })

const colors = (chars: CharData[]): Array<CharData['color'] | undefined> =>
  Array.from({ length: chars.length }, (_, index) => chars[index]?.color)

describe('grammarToChars', () => {
  it('maps parsed node locations to character highlight colors', () => {
    const chars = grammarToChars(parse('2,34|.'))

    expect(colors(chars)).toEqual([
      'pitch',
      'delimiter',
      'pitch',
      'pitch',
      'delimiter',
      'delimiter',
    ])
  })

  it('highlights sample-rate notes as pitch characters', () => {
    expect(colors(grammarToChars(parse('!-.')))).toEqual(['pitch', 'pitch', 'delimiter'])
    expect(colors(grammarToChars(parse('[0 !]')))).toEqual([
      'chord',
      'pitch',
      'pitch',
      'pitch',
      'chord',
    ])
  })

  it('syntax-highlights custom key signature setters', () => {
    expect(colors(grammarToChars(parse('(sig: C# F#)')))).toEqual([
      'setterGroup',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'setterGroup',
    ])
  })

  it('syntax-highlights MOS declarations with nuanced MOS colors', () => {
    expect(colors(grammarToChars(parse('MOS{4L3s 4|2 5:3} J')))).toEqual([
      'mosGroup',
      'mosGroup',
      'mosGroup',
      'mosGroup',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mos',
      'mosGroup',
      undefined,
      'pitch',
    ])
  })

  it('highlights the inversion prefix on standalone ratio chords', () => {
    expect(colors(grammarToChars(parse('/6:5:4')))).toEqual([
      'delimiter',
      'pitch',
      'delimiter',
      'pitch',
      'delimiter',
      'pitch',
    ])
  })

  it('highlights the inversion prefix inside square bracket chords', () => {
    expect(colors(grammarToChars(parse('[/6:5]')))).toEqual([
      'chord',
      'delimiter',
      'pitch',
      'delimiter',
      'pitch',
      'chord',
    ])
  })

  it('highlights tempered prefixes as delimiters', () => {
    expect(colors(grammarToChars(parse('~3/2')))).toEqual(['delimiter', 'pitch', 'pitch', 'pitch'])
    expect(colors(grammarToChars(parse('~4:5:6')))).toEqual([
      'delimiter',
      'pitch',
      'delimiter',
      'pitch',
      'delimiter',
      'pitch',
    ])
  })

  it('syntax-highlights custom mapping scale setters', () => {
    expect(colors(grammarToChars(parse('{<12, 19, 28]@3}')))).toEqual([
      'scaleGroup',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scaleGroup',
    ])
  })

  it('syntax-highlights edo absolute pitches that land between integer steps', () => {
    const ast = parse('{12edo} Ct E')
    processGrammar(ast)

    expect(colors(grammarToChars(ast))).toEqual([
      'scaleGroup',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scaleGroup',
      undefined,
      'invalidPitch',
      'invalidPitch',
      undefined,
      'pitch',
    ])
  })

  it('keeps all repeated play times for characters inside repeats', () => {
    const ast = parse('|: 0 :|')
    processGrammar(ast)
    const chars = grammarToChars(ast)

    expect(chars[3]).toMatchObject({
      color: 'pitch',
      playTimes: [
        [0, 0.25],
        [0.25, 0.5],
      ],
    })
  })

  it('highlights repeat markers as delimiters', () => {
    expect(colors(grammarToChars(parse('|: 0 |¹ 1 :|²')))).toEqual([
      'delimiter',
      'delimiter',
      undefined,
      'pitch',
      undefined,
      'delimiter',
      'delimiter',
      undefined,
      'pitch',
      undefined,
      'delimiter',
      'delimiter',
      'delimiter',
    ])
  })

  it('highlights ASCII repeat ending markers as delimiters', () => {
    expect(colors(grammarToChars(parse('|: 0 |(^1) 1 :|(^2)')))).toEqual([
      'delimiter',
      'delimiter',
      undefined,
      'pitch',
      undefined,
      'delimiter',
      'delimiter',
      'delimiter',
      'delimiter',
      'delimiter',
      undefined,
      'pitch',
      undefined,
      'delimiter',
      'delimiter',
      'delimiter',
      'delimiter',
      'delimiter',
      'delimiter',
    ])
  })

  it('uses all repeated play times when finding a line start time', () => {
    const source = '|: 1 2 :|\n3'
    const parsed = parse(source)
    processGrammar(parsed)
    const chars = grammarToChars(parsed)

    expect(getTimeAtLine(source, chars, 1)).toBe(1)
  })

  it('finds a line time from the earliest start on that line', () => {
    const source = '|: 1\n2 :|'
    const parsed = parse(source)
    processGrammar(parsed)
    const chars = grammarToChars(parsed)

    expect(getTimeAtLine(source, chars, 1)).toBe(0.25)
  })

  it('falls back to the latest previous line end for lines without notes', () => {
    const source = '1\n# comment\n2'
    const parsed = parse(source)
    processGrammar(parsed)
    const chars = grammarToChars(parsed)

    expect(getTimeAtLine(source, chars, 1)).toBe(0.25)
  })

  it('highlights barlines inside hold tails as delimiters', () => {
    const chars = grammarToChars(parse('1--|--'))

    expect(colors(chars)).toEqual(['pitch', 'pitch', 'pitch', 'delimiter', 'pitch', 'pitch'])
  })

  it('leaves skipped separator spaces uncolored', () => {
    const chars = grammarToChars(parse('2 34'))

    expect(colors(chars)).toEqual(['pitch', undefined, 'pitch', 'pitch'])
  })

  it('syntax-highlights absolute pitches in root setters', () => {
    const chars = grammarToChars(parse('{r as C}'))

    expect(colors(chars)).toEqual([
      'scaleGroup',
      'scaleGroup',
      'scaleGroup',
      'scaleGroup',
      'scaleGroup',
      'scaleGroup',
      'scale',
      'scaleGroup',
    ])
  })

  it('syntax-highlights octave modifiers on root nominations as scale characters', () => {
    const chars = grammarToChars(parse('{r216Hz as `A}'))

    expect(colors(chars)).toEqual([
      'scaleGroup',
      'scaleGroup',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scaleGroup',
      'scaleGroup',
      'scaleGroup',
      'scaleGroup',
      'scale',
      'scale',
      'scaleGroup',
    ])
  })

  it('highlights groove setters while preserving nested rhythm colors', () => {
    expect(colors(grammarToChars(parse('(groove:(5)!-- !-)')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'pitch',
      'pitch',
      'pitch',
      'delimiter',
      'pitch',
      'pitch',
      'setterGroup',
    ])
  })

  it('highlights grace setters', () => {
    expect(colors(grammarToChars(parse('(8?) (grace:16)')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setterGroup',
      undefined,
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setterGroup',
    ])
  })

  it('highlights volume, velocity, and dynamic shorthand setters', () => {
    expect(colors(grammarToChars(parse('(vol:-2dB)')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setterGroup',
    ])
    expect(colors(grammarToChars(parse('(vel:50%)')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setterGroup',
    ])
    expect(colors(grammarToChars(parse('(mf)')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setterGroup',
    ])
  })

  it('highlights noise setters like osc setters', () => {
    expect(colors(grammarToChars(parse('(noise:white)')))).toEqual(
      colors(grammarToChars(parse('(osc:slender)'))),
    )
  })

  it('highlights drone setters while preserving nested drone value highlights', () => {
    expect(colors(grammarToChars(parse('(drone: off)')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setterGroup',
    ])

    expect(colors(grammarToChars(parse('(drone: [Aα,4])')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'chord',
      'pitch',
      'alternatePitch',
      'pitch',
      'pitch',
      'chord',
      'setterGroup',
    ])

    expect(colors(grammarToChars(parse('(drone: 4:5)')))).toEqual([
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'pitch',
      'delimiter',
      'pitch',
      'setterGroup',
    ])
  })

  it('lets nested scale, pitch, and setter nodes override group colors', () => {
    const chars = grammarToChars(parse('{12edo}(bpm: 120;4)[0,4]-'))

    expect(colors(chars)).toEqual([
      'scaleGroup',
      'scale',
      'scale',
      'scale',
      'scale',
      'scale',
      'scaleGroup',
      'setterGroup',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setter',
      'setterGroup',
      'setter',
      'setterGroup',
      'chord',
      'pitch',
      'pitch',
      'pitch',
      'chord',
      'pitch',
    ])
  })

  it('uses inherited play time for child character data', () => {
    const chars = grammarToChars({
      sequence: {
        items: [
          {
            type: 'Note',
            location: { start: { offset: 0 }, end: { offset: 1 } },
            time: [1, 2],
            pitch: {
              type: 'Pitch',
              location: { start: { offset: 0 }, end: { offset: 1 } },
            },
          },
        ],
      },
    } as unknown as XenpaperAST)

    expect(chars[0]).toEqual({ color: 'pitch', playTimes: [[1, 2]] })
  })

  it('returns no character data when the AST has no sequence', () => {
    expect(grammarToChars({} as unknown as XenpaperAST)).toEqual([])
  })
})
