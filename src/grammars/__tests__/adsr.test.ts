import { describe, expect, it } from 'vitest'
import { parse } from '../grammar.generated.js'
import { processGrammar } from '../process-grammar'
import type { MoscBeatParam } from '../../mosc'

const parseSource = (source: string) => parse(source, { grammarSource: 'test-input' })

const envelopeItems = (source: string) =>
  processGrammar(parseSource(source)).score.sequence.filter(
    (item): item is MoscBeatParam =>
      item.type === 'PARAM_BEAT_TIME' &&
      typeof item.value === 'object' &&
      item.value !== null &&
      'type' in item.value &&
      item.value.type === 'env',
  )

describe('ADSR setter', () => {
  it.each([
    '(adsr:10.5ms 100.25ms 50.5% 200.75ms)',
    '(ADSR : 10.5 MS\n100.25 ms\t50.5 % 200.75 Ms)',
  ])('parses explicit units and normalizes values in %s', (source) => {
    expect(parseSource(source).sequence.items[0]).toMatchObject({
      type: 'SetterGroup',
      setters: [{ type: 'SetAdsr', a: 0.0105, d: 0.10025, s: 0.505, r: 0.20075 }],
    })
  })

  it.each([
    '10 100ms 50% 200ms',
    '10ms 100 50% 200ms',
    '10ms 100ms 50 200ms',
    '10ms 100ms 50% 200',
    '10s 100ms 50% 200ms',
    '10ms 100s 50% 200ms',
    '10ms 100ms 50ms 200ms',
    '10ms 100ms 50% 200s',
    '10ms 100ms 50%',
    '10ms 100ms 50% 200ms 300ms',
    '-10ms 100ms 50% 200ms',
    '10ms -100ms 50% 200ms',
    '10ms 100ms -50% 200ms',
    '10ms 100ms 50% -200ms',
  ])('rejects missing values, incorrect units, and negative values: %s', (values) => {
    expect(() => parseSource(`(adsr:${values})`)).toThrow('Expected')
  })

  it('emits an envelope event at the setter time in a mixed setter group', () => {
    expect(envelopeItems('0 (bpm:90; adsr:10ms 100ms 50% 200ms)2')[1]).toEqual({
      type: 'PARAM_BEAT_TIME',
      time: 0.5,
      value: { type: 'env', a: 0.01, d: 0.1, s: 0.5, r: 0.2 },
    })
  })

  it('accepts zero durations and the sustain boundaries', () => {
    const envelopes = envelopeItems('(adsr:0ms 0ms 0% 0ms)0 (adsr:0ms 0ms 100% 0ms)2')
    expect(envelopes.slice(1).map((item) => item.value)).toEqual([
      { type: 'env', a: 0, d: 0, s: 0, r: 0 },
      { type: 'env', a: 0, d: 0, s: 1, r: 0 },
    ])
  })

  it('rejects sustain above 100%', () => {
    expect(() => envelopeItems('(adsr:10ms 100ms 100.1% 200ms)0')).toThrow('SetAdsr.s')
  })

  it.each([
    `${'9'.repeat(400)}ms 100ms 50% 200ms`,
    `10ms ${'9'.repeat(400)}ms 50% 200ms`,
    `10ms 100ms ${'9'.repeat(400)}% 200ms`,
    `10ms 100ms 50% ${'9'.repeat(400)}ms`,
  ])('rejects non-finite envelope values: %s', (values) => {
    expect(() => envelopeItems(`(adsr:${values})0`)).toThrow('SetAdsr.')
  })

  it('allows the digit envelope setter to override ADSR and vice versa', () => {
    const envelopes = envelopeItems(
      '(adsr:10ms 100ms 50% 200ms; env:0123; adsr:20ms 30ms 40% 50ms)0',
    )
    expect(envelopes.slice(1).map((item) => item.value)).toEqual([
      { type: 'env', a: 0.01, d: 0.1, s: 0.5, r: 0.2 },
      { type: 'env', a: 0, d: 0.003, s: 2 / 9, r: 0.01 },
      { type: 'env', a: 0.02, d: 0.03, s: 0.4, r: 0.05 },
    ])
  })
})
