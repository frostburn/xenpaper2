import { describe, expect, it } from 'vitest'
import { grammarToChars, type CharData } from '../grammar-to-chars'
import type { XenpaperAST } from '../grammar.generated'
import * as parserModule from '../grammar.generated.js'

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

  it('highlights barlines inside hold tails as delimiters', () => {
    const chars = grammarToChars(parse('1--|--'))

    expect(colors(chars)).toEqual(['pitch', 'pitch', 'pitch', 'delimiter', 'pitch', 'pitch'])
  })

  it('leaves skipped separator spaces uncolored', () => {
    const chars = grammarToChars(parse('2 34'))

    expect(colors(chars)).toEqual(['pitch', undefined, 'pitch', 'pitch'])
  })

  it('highlights noise setters like osc setters', () => {
    expect(colors(grammarToChars(parse('(noise:white)')))).toEqual(
      colors(grammarToChars(parse('(osc:sine---)'))),
    )
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

    expect(chars[0]).toEqual({ color: 'pitch', playTime: [1, 2] })
  })

  it('returns no character data when the AST has no sequence', () => {
    expect(grammarToChars({} as unknown as XenpaperAST)).toEqual([])
  })
})
