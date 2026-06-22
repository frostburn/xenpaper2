import { describe, it, expect } from 'vitest'

declare module 'vitest' {
  interface Matchers<T> {
    toBeAround(expected: number, precision?: number): T
  }
}

import { parseAndProcessSourceCode } from '../../utils'
import { parse } from '../grammar.generated.js'
import { processGrammar } from '../process-grammar'

expect.extend({
  toBeAround(actual, expected, precision = 2) {
    const pass = Math.abs(expected - actual) < Math.pow(10, -precision) / 2
    if (pass) {
      return {
        message: () => `expected ${actual} not to be around ${expected}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${actual} to be around ${expected}`,
        pass: false,
      }
    }
  },
})

const INITIAL_TEMPO = {
  type: 'TEMPO',
  time: 0,
  bpm: 120,
  lerp: false,
}

const INITIAL_OSC = {
  type: 'PARAM_BEAT_TIME',
  time: 0,
  value: {
    type: 'osc',
    osc: 'triangle',
  },
}

const INITIAL_ENV = {
  type: 'PARAM_BEAT_TIME',
  time: 0,
  value: {
    type: 'env',
    a: 0.006,
    d: 3.3,
    s: 0.5,
    r: 0.33,
  },
}

const INITIAL = [INITIAL_TEMPO, INITIAL_OSC, INITIAL_ENV]

const parseSource = (input: string) => parse(input, { grammarSource: 'test-input' })

const noteItems = (input: string) =>
  processGrammar(parseSource(input)).score.sequence.filter((item) => item.type === 'NOTE_BEAT_TIME')

const noteLabels = (input: string): string[] => noteItems(input).map((item) => item.label)

const noteLabelDurations = (input: string): Array<[string, number]> =>
  noteItems(input).map((item) => [item.label, item.timeEnd - item.time])

describe('grace note syntax', () => {
  it('plays a short-form grace note and steals its duration from the following note', () => {
    expect(noteItems('(8?) D C')).toMatchObject([
      { label: 'D♮', time: 0, timeEnd: 0.125 },
      { label: 'C♮', time: 0.125, timeEnd: 0.5 },
    ])
  })

  it('plays long-form grace notes with fractional subdivisions', () => {
    expect(noteItems('(grace:16) D C')).toMatchObject([
      { label: 'D♮', time: 0, timeEnd: 0.0625 },
      { label: 'C♮', time: 0.0625, timeEnd: 0.5 },
    ])
  })
})

describe('drone syntax', () => {
  it('holds a drone note until a new drone starts', () => {
    expect(noteItems('(drone: 0) 1 2 (drone: 3) 4')).toMatchObject([
      { label: '0\\12  0.0c', time: 0, timeEnd: 1 },
      { label: '1\\12  100.0c', time: 0, timeEnd: 0.5 },
      { label: '2\\12  200.0c', time: 0.5, timeEnd: 1 },
      { label: '3\\12  300.0c', time: 1, timeEnd: 1.5 },
      { label: '4\\12  400.0c', time: 1, timeEnd: 1.5 },
    ])
  })

  it('holds drone chords until off or end of input', () => {
    expect(noteItems('(drone: [0,4]) 1 (drone: off) 2 (drone: 3)')).toMatchObject([
      { label: '0\\12  0.0c', time: 0, timeEnd: 0.5 },
      { label: '4\\12  400.0c', time: 0, timeEnd: 0.5 },
      { label: '1\\12  100.0c', time: 0, timeEnd: 0.5 },
      { label: '2\\12  200.0c', time: 0.5, timeEnd: 1 },
      { label: '3\\12  300.0c', time: 1, timeEnd: 1 },
    ])
  })
})

describe('ratio chord syntax inside chords', () => {
  it('expands ratio chord pitches from the previous pitch', () => {
    expect(noteLabels('[3/2 5:6:7]')).toEqual(['3/2  702.0c', '9/5  1017.6c', '21/10  84.5c'])
  })

  it('uses an implicit unison before leading ratio chords and allows later ratio chords', () => {
    expect(noteLabels('[4:5:6 5:6:7]')).toEqual([
      '4/4  0.0c',
      '5/4  386.3c',
      '6/4  702.0c',
      '9/5  1017.6c',
      '21/10  84.5c',
    ])
  })

  it('expands inverted ratio chords from reciprocal ratios', () => {
    expect(noteLabels('/6:5:4')).toEqual(['6/6  0.0c', '6/5  315.6c', '6/4  702.0c'])
  })

  it('interpolates inverted ratio chords in the written direction', () => {
    expect(noteLabels('/7::4')).toEqual(['7/7  0.0c', '7/6  266.9c', '7/5  582.5c', '7/4  968.8c'])
  })

  it('uses inverted ratio chords as scales', () => {
    expect(noteLabels('{/6:5:4} 0 1 2')).toEqual(['6/6  0.0c', '6/5  315.6c', '6/4  702.0c'])
  })

  it('interpolates inverted ratio chord scales in the written direction', () => {
    expect(noteLabels('{/7::4} 0 1 2 3')).toEqual([
      '7/7  0.0c',
      '7/6  266.9c',
      '7/5  582.5c',
      '7/4  968.8c',
    ])
  })

  it('expands ratio chords in scales from the previous scale pitch', () => {
    expect(noteLabels('{1/1 3/2 5:6:7} 0 1 2 3')).toEqual([
      '1/1  0.0c',
      '3/2  702.0c',
      '9/5  1017.6c',
      '21/10  84.5c',
    ])
  })

  it('flushes scale ratio chords before following inverted ratio chord segments', () => {
    expect(noteLabels('{4:5 /7:6} 0 1 2')).toEqual(['4/4  0.0c', '5/4  386.3c', '35/24  653.2c'])
  })

  it('shows cents-only labels for ratio chords expanded from non-ratio pitches', () => {
    expect(noteLabels("[7 3:4:5 9/7 'c]")).toEqual([
      '7\\12  700.0c',
      '1198.0c',
      '384.4c',
      '9/7  435.1c',
      'c♮',
    ])
  })

  it('throws when expanding a ratio chord from a sample-rate pitch', () => {
    expect(() => noteItems('[! 3:4]')).toThrow(
      'Cannot expand a ratio chord from a sample-rate pitch',
    )
  })
})

describe('grammar to mosc score', () => {
  it('applies FJS inflections to absolute pitch ratios', () => {
    const [
      fifthLimitSubscript,
      fifthLimitSuperscript,
      neutralEleven,
      lumisComma,
      helmholtzEllis,
      helmholtzEllisDown,
      hewm53,
      flora,
      thirtyOneDefault,
      thirtyOneFlora,
      thirtyOneClassic,
    ] = noteItems('Cv5 C#^5 Ct^11n A^0l A^5h C#v5h A^17m A^5f A^31 A^31f A^31c')

    expect(fifthLimitSubscript?.hz).toBeAround(264, 6)
    expect(fifthLimitSubscript?.label).toBe('C♮v5')
    expect(fifthLimitSuperscript?.hz).toBeAround(275, 6)
    expect(fifthLimitSuperscript?.label).toBe('C♯^5')
    expect(neutralEleven?.hz).toBeAround((220 * 11) / 9, 6)
    expect(neutralEleven?.label).toBe('C‡^11n')
    expect(lumisComma?.hz).toBeAround(440.20249573794024, 6)
    expect(lumisComma?.label).toBe('A♮^0l')
    expect(helmholtzEllis?.hz).toBeAround(445.5, 6)
    expect(helmholtzEllis?.label).toBe('A♮^5h')
    expect(helmholtzEllisDown?.hz).toBeAround(275, 6)
    expect(helmholtzEllisDown?.label).toBe('C♯v5h')
    expect(hewm53?.hz).toBeAround((440 * 18) / 17, 6)
    expect(hewm53?.label).toBe('A♮^17m')
    expect(flora?.hz).toBeAround((440 * 80) / 81, 6)
    expect(flora?.label).toBe('A♮^5f')
    expect(thirtyOneDefault?.hz).toBeAround((440 * 31) / 32, 6)
    expect(thirtyOneDefault?.label).toBe('A♮^31')
    expect(thirtyOneFlora?.hz).toBeAround((440 * 31) / 32, 6)
    expect(thirtyOneFlora?.label).toBe('A♮^31f')
    expect(thirtyOneClassic?.hz).toBeAround((440 * 248) / 243, 6)
    expect(thirtyOneClassic?.label).toBe('A♮^31c')
  })

  it('applies up and lift setters to absolute pitches', () => {
    const [ratioUp, ratioLift, centsUp, divisionLift] = noteItems(
      '(^:81/80) ^A (/:64/63) /A (^:25c) ^A (/:1/12ed) /A',
    )

    expect(ratioUp?.hz).toBeAround((440 * 81) / 80, 6)
    expect(ratioUp?.label).toBe('^A♮')
    expect(ratioLift?.hz).toBeAround((440 * 64) / 63, 6)
    expect(ratioLift?.label).toBe('/A♮')
    expect(centsUp?.hz).toBeAround(440 * Math.pow(2, 25 / 1200), 6)
    expect(centsUp?.label).toBe('^A♮')
    expect(divisionLift?.hz).toBeAround(440 * Math.pow(2, 1 / 12), 6)
    expect(divisionLift?.label).toBe('/A♮')
  })

  it('tempers FJS inflections', () => {
    const [third, powerOctave] = noteItems('{19edo}C#^5 A^109')
    expect(third?.hz).toBeAround(220 * Math.pow(2, 6 / 19), 6)
    expect(powerOctave?.hz).toBeAround(220 * Math.pow(2, 20 / 19), 6)
  })

  it('expands simple repeats before translating to score items', () => {
    expect(noteLabels('0 |: 1 2 :| 3')).toEqual([
      '0\\12  0.0c',
      '1\\12  100.0c',
      '2\\12  200.0c',
      '1\\12  100.0c',
      '2\\12  200.0c',
      '3\\12  300.0c',
    ])
  })

  it('expands alternate endings before translating to score items', () => {
    expect(noteLabels('|: 0 |¹ 1 :|² 2')).toEqual([
      '0\\12  0.0c',
      '1\\12  100.0c',
      '0\\12  0.0c',
      '2\\12  200.0c',
    ])
  })

  it('expands ASCII alternate endings before translating to score items', () => {
    expect(noteLabels('|: 0 |(^1) 1 :|(^2) 2')).toEqual([
      '0\\12  0.0c',
      '1\\12  100.0c',
      '0\\12  0.0c',
      '2\\12  200.0c',
    ])
  })

  it('repeats from the beginning for unpaired repeat ends', () => {
    expect(noteLabels('0 1 :| 2')).toEqual([
      '0\\12  0.0c',
      '1\\12  100.0c',
      '0\\12  0.0c',
      '1\\12  100.0c',
      '2\\12  200.0c',
    ])
  })

  it('treats repeat-end-start as closing and opening a repeat', () => {
    expect(noteLabels('0 :|: 1 :| 2')).toEqual([
      '0\\12  0.0c',
      '0\\12  0.0c',
      '1\\12  100.0c',
      '1\\12  100.0c',
      '2\\12  200.0c',
    ])
  })

  it('expands nested repeats from the inside out', () => {
    expect(noteLabels('1 2 |: 3 |: 4 5 :| 6 :| 7')).toEqual([
      '1\\12  100.0c',
      '2\\12  200.0c',
      '3\\12  300.0c',
      '4\\12  400.0c',
      '5\\12  500.0c',
      '4\\12  400.0c',
      '5\\12  500.0c',
      '6\\12  600.0c',
      '3\\12  300.0c',
      '4\\12  400.0c',
      '5\\12  500.0c',
      '4\\12  400.0c',
      '5\\12  500.0c',
      '6\\12  600.0c',
      '7\\12  700.0c',
    ])
  })

  it('expands repeat counts from superscript and ASCII repeat starts', () => {
    expect(noteLabels('|:ˣ³ 0 :| |:(x4) 1 :|')).toEqual([
      '0\\12  0.0c',
      '0\\12  0.0c',
      '0\\12  0.0c',
      '1\\12  100.0c',
      '1\\12  100.0c',
      '1\\12  100.0c',
      '1\\12  100.0c',
    ])
  })

  it('expands multi-repeat alternate endings', () => {
    expect(noteLabels('|:ˣ³ 0 |¹ 1 :|² 2 :|³ 3')).toEqual([
      '0\\12  0.0c',
      '1\\12  100.0c',
      '0\\12  0.0c',
      '2\\12  200.0c',
      '0\\12  0.0c',
      '3\\12  300.0c',
    ])
  })

  it('realizes hold tails from repeat markers during pre-processing', () => {
    expect(noteLabelDurations('1 |: 2 3-|¹- 4 :|²--')).toEqual([
      ['1\\12  100.0c', 0.5],
      ['2\\12  200.0c', 0.5],
      ['3\\12  300.0c', 1.5],
      ['4\\12  400.0c', 0.5],
      ['2\\12  200.0c', 0.5],
      ['3\\12  300.0c', 2],
    ])
  })

  it('expands D.C. al Fine control flow after repeats', () => {
    expect(noteLabels('0 |: 1 :| (Fine) 2 (D.C. al Fine) 3')).toEqual([
      '0\\12  0.0c',
      '1\\12  100.0c',
      '1\\12  100.0c',
      '2\\12  200.0c',
      '0\\12  0.0c',
      '1\\12  100.0c',
      '1\\12  100.0c',
    ])
  })

  it('expands D.S. al Coda control flow with long-form syntax', () => {
    expect(noteLabels('(Segno) 0 (To Coda) 1 (Dal Segno al Coda) 2 (Coda) 3')).toEqual([
      '0\\12  0.0c',
      '1\\12  100.0c',
      '0\\12  0.0c',
      '3\\12  300.0c',
    ])
  })

  it('rejects hold tails on repeat markers after rests', () => {
    const source = parseAndProcessSourceCode('|: 1.|¹-- 7:|²-. |')

    expect(source.playable).toBe(false)
    expect(source.error).toContain('Cannot attach a hold to a rest')
  })

  it('rejects unpaired repeat starts during pre-processing', () => {
    const source = parseAndProcessSourceCode('|: 0')

    expect(source.playable).toBe(false)
    expect(source.error).toContain('Unpaired repeat start marker "|:"')
  })

  it('applies major key signatures to Latin and matching Greek nominals', () => {
    expect(noteLabels('(key:G Major) F Zet F_ Zet_')).toEqual(['F♯', 'Ζ♯', 'F♮', 'Ζ♮'])
  })

  it('applies flat key signatures and lets explicit accidentals override them', () => {
    expect(noteLabels('(key:F Major) B B_ B#')).toEqual(['B♭', 'B♮', 'B♯'])
  })

  it('supports modal key signatures and major/minor aliases', () => {
    expect(noteLabels('(key:C Ionian) F (key:C Major) F')).toEqual(['F♮', 'F♮'])
    expect(noteLabels('(key:A Aeolian) F (key:A minor) F')).toEqual(['F♮', 'F♮'])
    expect(noteLabels('(key:D Dorian) B F (key:C Lydian) F')).toEqual(['B♮', 'F♮', 'F♯'])
    expect(noteLabels('(key:G Mixolydian) F (key:C Phrygian) E (key:C Locrian) G')).toEqual([
      'F♮',
      'E♭',
      'G♭',
    ])
  })

  it('applies tonic accidentals across extended Pythagorean key signatures', () => {
    expect(noteLabels('(key:C# Major) C D E F G A B')).toEqual([
      'C♯',
      'D♯',
      'E♯',
      'F♯',
      'G♯',
      'A♯',
      'B♯',
    ])
    expect(noteLabels('(key:Ct Major) C D E F G A B')).toEqual([
      'C‡',
      'D‡',
      'E‡',
      'F‡',
      'G‡',
      'A‡',
      'B‡',
    ])
    expect(noteLabels('(key:F# Major) F G A B C D E')).toEqual([
      'F♯',
      'G♯',
      'A♯',
      'B♮',
      'C♯',
      'D♯',
      'E♯',
    ])
  })

  it('applies Ups and Downs and FJS inflections from key signatures', () => {
    const [upC, neutralD, naturalF, extraInflectedG] = noteItems('(key:^C^5 Lydian) C D F_ Gv5')

    expect(upC?.label).toBe('^C♮^5')
    expect(neutralD?.label).toBe('^D♮^5')
    expect(naturalF?.label).toBe('^F♮^5')
    expect(extraInflectedG?.label).toBe('^G♮^5v5')
    expect(upC?.hz).toBeAround(220 * (32 / 27) * (80 / 81) * Math.pow(243 / 242, 0.5), 6)
  })

  it('rejects undefined key signature tonics', () => {
    const source = parseAndProcessSourceCode('(key:X Major) F')

    expect(source.playable).toBe(false)
    expect(source.error).toContain("Undefined key signature tonic 'X'.")
  })

  it('should translate sample-rate notes', () => {
    const source = parseAndProcessSourceCode('!-')

    expect(source.playable).toBe(true)
    if (!source.playable) throw new Error('Expected sample-rate note source to be playable.')

    expect(source.score.sequence).toContainEqual({
      type: 'SAMPLE_RATE_NOTE_TIME',
      time: 0,
      timeEnd: 0.5,
      label: 'sample rate',
    })
  })

  it('should translate sample-rate notes in chords', () => {
    const source = parseAndProcessSourceCode('[0 !]')

    expect(source.playable).toBe(true)
    if (!source.playable) throw new Error('Expected sample-rate chord source to be playable.')

    expect(source.score.sequence).toContainEqual({
      type: 'SAMPLE_RATE_NOTE_TIME',
      time: 0,
      timeEnd: 0.25,
      label: 'sample rate',
    })
    expect(source.score.sequence).toContainEqual({
      type: 'NOTE_TIME',
      time: 0,
      timeEnd: 0.25,
      hz: 220,
      label: '0\\12  0.0c',
    })
  })

  it('should translate noise setter', () => {
    const source = parseAndProcessSourceCode('(noise:white) 0')

    expect(source.playable).toBe(true)
    if (!source.playable) throw new Error('Expected noise setter source to be playable.')

    expect(source.score.sequence).toContainEqual({
      type: 'PARAM_TIME',
      time: 0,
      value: {
        type: 'noise',
        noise: 'white',
      },
    })
  })

  //
  // # pitch types
  // 1/1,5/4,3/2,2/1
  // 0c,400c,700c,1200c
  // 220Hz,440Hz,880Hz,1760Hz
  // 0/4o,1/4o,2/4o,3/4o
  //

  const PITCH_TEST = JSON.parse(
    `{"type":"XenpaperGrammar","sequence":{"type":"Sequence","items":[{"type":"Comment","comment":" pitch types","pos":0},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchRatio","numerator":1,"denominator":1,"pos":14},"pos":14},"tail":{"type":"Comma","delimiter":true,"pos":17},"pos":14},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchRatio","numerator":5,"denominator":4,"pos":18},"pos":18},"tail":{"type":"Comma","delimiter":true,"pos":21},"pos":18},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchRatio","numerator":3,"denominator":2,"pos":22},"pos":22},"tail":{"type":"Comma","delimiter":true,"pos":25},"pos":22},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchRatio","numerator":2,"denominator":1,"pos":26},"pos":26},"pos":26},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchCents","cents":0,"pos":30},"pos":30},"tail":{"type":"Comma","delimiter":true,"pos":32},"pos":30},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchCents","cents":400,"pos":33},"pos":33},"tail":{"type":"Comma","delimiter":true,"pos":37},"pos":33},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchCents","cents":700,"pos":38},"pos":38},"tail":{"type":"Comma","delimiter":true,"pos":42},"pos":38},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchCents","cents":1200,"pos":43},"pos":43},"pos":43},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchHz","hz":220,"pos":49},"pos":49},"tail":{"type":"Comma","delimiter":true,"pos":54},"pos":49},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchHz","hz":440,"pos":55},"pos":55},"tail":{"type":"Comma","delimiter":true,"pos":60},"pos":55},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchHz","hz":880,"pos":61},"pos":61},"tail":{"type":"Comma","delimiter":true,"pos":66},"pos":61},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchHz","hz":1760,"pos":67},"pos":67},"pos":67},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchOctaveDivision","numerator":0,"denominator":4,"octaveSize":2,"pos":74},"pos":74},"tail":{"type":"Comma","delimiter":true,"pos":78},"pos":74},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchOctaveDivision","numerator":1,"denominator":4,"octaveSize":2,"pos":79},"pos":79},"tail":{"type":"Comma","delimiter":true,"pos":83},"pos":79},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchOctaveDivision","numerator":2,"denominator":4,"octaveSize":2,"pos":84},"pos":84},"tail":{"type":"Comma","delimiter":true,"pos":88},"pos":84},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchOctaveDivision","numerator":3,"denominator":4,"octaveSize":2,"pos":89},"pos":89},"pos":89}],"pos":0},"pos":0}`,
  )

  it('should translate pitch types', () => {
    expect(processGrammar(PITCH_TEST).score).toEqual({
      sequence: [
        ...INITIAL,
        // pitch ratios
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 0.5,
          hz: 220,
          label: '1/1  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0.5,
          timeEnd: 1,
          hz: 275,
          label: '5/4  386.3c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 1.5,
          hz: 330,
          label: '3/2  702.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1.5,
          timeEnd: 2,
          hz: 440,
          label: '2/1  1200.0c',
        },
        // pitch cents
        {
          type: 'NOTE_BEAT_TIME',
          time: 2,
          timeEnd: 2.5,
          hz: 220,
          label: '0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 2.5,
          timeEnd: 3,
          hz: 277.1826309768721,
          label: '400c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 3,
          timeEnd: 3.5,
          hz: 329.6275569128699,
          label: '700c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 3.5,
          timeEnd: 4,
          hz: 440,
          label: '1200c',
        },
        // pitch hz
        {
          type: 'NOTE_BEAT_TIME',
          time: 4,
          timeEnd: 4.5,
          hz: 220,
          label: '220Hz',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 4.5,
          timeEnd: 5,
          hz: 440,
          label: '440Hz',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 5,
          timeEnd: 5.5,
          hz: 880,
          label: '880Hz',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 5.5,
          timeEnd: 6,
          hz: 1760,
          label: '1760Hz',
        },
        // pitch octave divisions
        {
          type: 'NOTE_BEAT_TIME',
          time: 6,
          timeEnd: 6.5,
          hz: 220,
          label: '0\\4  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 6.5,
          timeEnd: 7,
          hz: expect.toBeAround(261.6255653005986),
          label: '1\\4  300.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 7,
          timeEnd: 7.5,
          hz: expect.toBeAround(311.1269837220809),
          label: '2\\4  600.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 7.5,
          timeEnd: 8,
          hz: expect.toBeAround(369.99442271163446),
          label: '3\\4  900.0c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 8,
        },
      ],
      lengthTime: 8,
    })
  })

  //
  // # scale degrees
  // 0,4,7,12
  //
  // {1/1,5/4,3/2,2/1}
  // 0,1,2,3
  //
  // {19edo}
  // 0,6,11,19
  //
  // {4:5:6:7:8}
  // 0,1,2,4
  //

  const SCALE_TEST = parseSource(`# scale degrees
0,4,7,12
{1/1,5/4,3/2,2/1}
0,1,2,3
{19edo}
0,6,11,19
{4:5:6:7:8}
0,1,2,4`)

  it('should translate scale degrees', () => {
    expect(processGrammar(SCALE_TEST).score).toEqual({
      sequence: [
        ...INITIAL,
        // default scale (12edo)
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 0.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0.5,
          timeEnd: 1,
          hz: 277.1826309768721,
          label: '4\\12  400.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 1.5,
          hz: 329.6275569128699,
          label: '7\\12  700.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1.5,
          timeEnd: 2,
          hz: 440,
          label: '0\\12  0.0c',
        },
        // ratios scale
        {
          type: 'NOTE_BEAT_TIME',
          time: 2,
          timeEnd: 2.5,
          hz: 220,
          label: '1/1  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 2.5,
          timeEnd: 3,
          hz: 275,
          label: '5/4  386.3c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 3,
          timeEnd: 3.5,
          hz: 330,
          label: '3/2  702.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 3.5,
          timeEnd: 4,
          hz: 440,
          label: '2/1  1200.0c',
        },
        // 19edo scale
        {
          type: 'NOTE_BEAT_TIME',
          time: 4,
          timeEnd: 4.5,
          hz: 220,
          label: '0\\19  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 4.5,
          timeEnd: 5,
          hz: 273.83236968208513,
          label: '6\\19  378.9c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 5,
          timeEnd: 5.5,
          hz: 328.62697156398684,
          label: '11\\19  694.7c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 5.5,
          timeEnd: 6,
          hz: 440,
          label: '0\\19  0.0c',
        },
        // multi ratio scale
        {
          type: 'NOTE_BEAT_TIME',
          time: 6,
          timeEnd: 6.5,
          hz: 220,
          label: '4/4  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 6.5,
          timeEnd: 7,
          hz: 275,
          label: '5/4  386.3c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 7,
          timeEnd: 7.5,
          hz: 330,
          label: '6/4  702.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 7.5,
          timeEnd: 8,
          hz: 440,
          label: '8/4  1200.0c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 8,
        },
      ],
      lengthTime: 8,
    })
  })

  //
  // # timing
  // 0,0,0-0-|0.0--.0.
  //

  const TIMING_TEST = JSON.parse(
    `{"type":"XenpaperGrammar","sequence":{"type":"Sequence","items":[{"type":"Comment","comment":" timing","pos":0},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":9},"pos":9},"tail":{"type":"Comma","delimiter":true,"pos":10},"pos":9},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":11},"pos":11},"tail":{"type":"Comma","delimiter":true,"pos":12},"pos":11},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":13},"pos":13},"tail":{"type":"Hold","length":1,"pos":14},"pos":13},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":15},"pos":15},"tail":{"type":"Hold","length":1,"pos":16},"pos":15},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":18},"pos":18},"pos":18},{"type":"Rest","length":1,"pos":19},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":20},"pos":20},"tail":{"type":"Hold","length":2,"pos":21},"pos":20},{"type":"Rest","length":1,"pos":23},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":24},"pos":24},"pos":24},{"type":"Rest","length":1,"pos":25}],"pos":0},"pos":0}`,
  )

  it('should translate timing', () => {
    expect(processGrammar(TIMING_TEST).score).toEqual({
      sequence: [
        ...INITIAL,
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 0.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0.5,
          timeEnd: 1,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 2,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 2,
          timeEnd: 3,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 3,
          timeEnd: 3.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 4,
          timeEnd: 5.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 6,
          timeEnd: 6.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 7,
        },
      ],
      lengthTime: 7,
    })
  })

  //
  // # subdivision
  // 0,0,0
  //
  // (div:1)
  // 0,0,0
  //
  // (div:4)
  // 0,0,0
  //

  const SUBDIVISION_TEST = JSON.parse(
    `{"type":"XenpaperGrammar","delimiter":false,"sequence":{"type":"Sequence","delimiter":false,"items":[{"type":"Comment","delimiter":false,"comment":" subdivision","len":13,"pos":0},{"type":"Whitespace","delimiter":true,"len":1,"pos":13},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":14},"len":1,"pos":14},"tail":{"type":"Comma","delimiter":true,"len":1,"pos":15},"len":2,"pos":14},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":16},"len":1,"pos":16},"tail":{"type":"Comma","delimiter":true,"len":1,"pos":17},"len":2,"pos":16},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":18},"len":1,"pos":18},"len":1,"pos":18},{"type":"Whitespace","delimiter":true,"len":2,"pos":19},{"type":"SetterGroup","delimiter":false,"setters":[{"type":"SetSubdivision","delimiter":false,"subdivision":1,"len":5,"pos":22}],"len":7,"pos":21},{"type":"Whitespace","delimiter":true,"len":1,"pos":28},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":29},"len":1,"pos":29},"tail":{"type":"Comma","delimiter":true,"len":1,"pos":30},"len":2,"pos":29},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":31},"len":1,"pos":31},"tail":{"type":"Comma","delimiter":true,"len":1,"pos":32},"len":2,"pos":31},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":33},"len":1,"pos":33},"len":1,"pos":33},{"type":"Whitespace","delimiter":true,"len":2,"pos":34},{"type":"SetterGroup","delimiter":false,"setters":[{"type":"SetSubdivision","delimiter":false,"subdivision":4,"len":5,"pos":37}],"len":7,"pos":36},{"type":"Whitespace","delimiter":true,"len":1,"pos":43},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":44},"len":1,"pos":44},"tail":{"type":"Comma","delimiter":true,"len":1,"pos":45},"len":2,"pos":44},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":46},"len":1,"pos":46},"tail":{"type":"Comma","delimiter":true,"len":1,"pos":47},"len":2,"pos":46},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":48},"len":1,"pos":48},"len":1,"pos":48}],"len":49,"pos":0},"len":49,"pos":0}`,
  )

  it('should translate subdivisions', () => {
    expect(processGrammar(SUBDIVISION_TEST).score).toEqual({
      sequence: [
        ...INITIAL,
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 0.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0.5,
          timeEnd: 1,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 1.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1.5,
          timeEnd: 2.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 2.5,
          timeEnd: 3.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 3.5,
          timeEnd: 4.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 4.5,
          timeEnd: 4.75,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 4.75,
          timeEnd: 5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 5,
          timeEnd: 5.25,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 5.25,
        },
      ],
      lengthTime: 5.25,
    })
  })

  //
  // # tempo changes
  // 0,0
  //
  // (200bpm)
  // 0,0
  //

  const TEMPO_TEST = JSON.parse(
    `{"type":"XenpaperGrammar","sequence":{"type":"Sequence","items":[{"type":"Comment","comment":" tempo changes","pos":0},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":16},"pos":16},"tail":{"type":"Comma","delimiter":true,"pos":17},"pos":16},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":18},"pos":18},"pos":18},{"type":"SetterGroup","setters":[{"type":"SetBpm","bpm":200,"pos":22}],"pos":21},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":30},"pos":30},"tail":{"type":"Comma","delimiter":true,"pos":31},"pos":30},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":32},"pos":32},"pos":32}],"pos":0},"pos":0}`,
  )

  it('should translate tempo', () => {
    expect(processGrammar(TEMPO_TEST).score).toEqual({
      sequence: [
        ...INITIAL,
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 0.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0.5,
          timeEnd: 1,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'TEMPO',
          time: 1,
          bpm: 200,
          lerp: false,
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 1.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1.5,
          timeEnd: 2,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 2,
        },
      ],
      lengthTime: 2,
    })
  })

  //
  // # tempo changes with bms
  // 0,0
  //
  // (300 ms per beat)
  // 0,0
  //

  const TEMPO_TEST_BMS = JSON.parse(
    `{"type":"XenpaperGrammar","sequence":{"type":"Sequence","items":[{"type":"Comment","comment":" tempo changes","pos":0},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":16},"pos":16},"tail":{"type":"Comma","delimiter":true,"pos":17},"pos":16},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":18},"pos":18},"pos":18},{"type":"SetterGroup","setters":[{"type":"SetBms","bms":300,"pos":22}],"pos":21},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":30},"pos":30},"tail":{"type":"Comma","delimiter":true,"pos":31},"pos":30},{"type":"Note","pitch":{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":32},"pos":32},"pos":32}],"pos":0},"pos":0}`,
  )

  it('should translate tempo with bms', () => {
    expect(processGrammar(TEMPO_TEST_BMS).score).toEqual({
      sequence: [
        ...INITIAL,
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 0.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0.5,
          timeEnd: 1,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'TEMPO',
          time: 1,
          bpm: 200,
          lerp: false,
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 1.5,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1.5,
          timeEnd: 2,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 2,
        },
      ],
      lengthTime: 2,
    })
  })

  //
  // # chords
  // [0,4,7]-[2,8,11,13]-
  //

  const CHORDS_TEST = JSON.parse(
    `{"type":"XenpaperGrammar","sequence":{"type":"Sequence","items":[{"type":"Comment","comment":" chords","pos":0},{"type":"Chord","pitches":[{"type":"Pitch","value":{"type":"PitchDegree","degree":0,"pos":10},"pos":10},{"type":"Comma","delimiter":true,"pos":11},{"type":"Pitch","value":{"type":"PitchDegree","degree":4,"pos":12},"pos":12},{"type":"Comma","delimiter":true,"pos":13},{"type":"Pitch","value":{"type":"PitchDegree","degree":7,"pos":14},"pos":14}],"tail":{"type":"Hold","length":1,"pos":16},"pos":9},{"type":"Chord","pitches":[{"type":"Pitch","value":{"type":"PitchDegree","degree":2,"pos":18},"pos":18},{"type":"Comma","delimiter":true,"pos":19},{"type":"Pitch","value":{"type":"PitchDegree","degree":8,"pos":20},"pos":20},{"type":"Comma","delimiter":true,"pos":21},{"type":"Pitch","value":{"type":"PitchDegree","degree":11,"pos":22},"pos":22},{"type":"Comma","delimiter":true,"pos":24},{"type":"Pitch","value":{"type":"PitchDegree","degree":13,"pos":25},"pos":25}],"tail":{"type":"Hold","length":1,"pos":28},"pos":17}],"pos":0},"pos":0}`,
  )

  it('should translate chords', () => {
    expect(processGrammar(CHORDS_TEST).score).toEqual({
      sequence: [
        ...INITIAL,
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 1,
          hz: 220,
          label: '0\\12  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 1,
          hz: 277.1826309768721,
          label: '4\\12  400.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 1,
          hz: 329.6275569128699,
          label: '7\\12  700.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 2,
          hz: 246.94165062806206,
          label: '2\\12  200.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 2,
          hz: 349.2282314330039,
          label: '8\\12  800.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 2,
          hz: 415.3046975799451,
          label: '11\\12  1100.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 2,
          hz: 466.1637615180899,
          label: '1\\12  100.0c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 2,
        },
      ],
      lengthTime: 2,
    })
  })

  //
  // # ratio chords
  // 4:5-[4:5]-
  //

  const RATIOCHORDS_TEST = JSON.parse(
    `{"type":"XenpaperGrammar","sequence":{"type":"Sequence","items":[{"type":"Comment","comment":" ratio chords","pos":0},{"type":"RatioChord","pitches":[{"type":"RatioChordPitch","pitch":4,"pos":15},{"type":"Colon","delimiter":true,"pos":16},{"type":"RatioChordPitch","pitch":5,"pos":17}],"tail":{"type":"Hold","length":1,"pos":18},"pos":15},{"type":"Chord","pitches":[{"type":"RatioChordPitch","pitch":4,"pos":20},{"type":"Colon","delimiter":true,"pos":21},{"type":"RatioChordPitch","pitch":5,"pos":22}],"tail":{"type":"Hold","length":1,"pos":24},"pos":19}],"pos":0},"pos":0}`,
  )

  it('should translate ratio chords', () => {
    expect(processGrammar(RATIOCHORDS_TEST).score).toEqual({
      sequence: [
        ...INITIAL,
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 1,
          hz: 220,
          label: '4/4  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 0,
          timeEnd: 1,
          hz: 275,
          label: '5/4  386.3c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 2,
          hz: 220,
          label: '4/4  0.0c',
        },
        {
          type: 'NOTE_BEAT_TIME',
          time: 1,
          timeEnd: 2,
          hz: 275,
          label: '5/4  386.3c',
        },
        {
          type: 'END_BEAT_TIME',
          time: 2,
        },
      ],
      lengthTime: 2,
    })
  })

  it('translates spiral-of-fifths nominals in default Pythagorean tuning', () => {
    const notes = noteItems('F C G D `A E B')

    expect(notes.map((note) => note.label)).toEqual(['F♮', 'C♮', 'G♮', 'D♮', 'A♮', 'E♮', 'B♮'])

    const expectedRatios = [128 / 81, 32 / 27, 16 / 9, 4 / 3, 1, 3 / 2, 9 / 4]
    notes.forEach((note, index) => expect(note.hz / 220).toBeAround(expectedRatios[index]!, 10))
  })

  it('can associate a root setter frequency with an absolute nominal', () => {
    const notes = noteItems('{r261.6256Hz as C} C E G 0')

    expect(notes.map((note) => note.label)).toEqual(['C♮', 'E♮', 'G♮', String.raw`0\12  0.0c`])
    expect(notes[0]?.hz).toBeAround(261.6256, 6)
    expect(notes[1]?.hz).toBeAround(261.6256 * (81 / 64), 6)
    expect(notes[2]?.hz).toBeAround(261.6256 * (3 / 2), 6)
    expect(notes[3]?.hz).toBeAround(261.6256, 6)
  })

  it('can associate the current root with an absolute nominal', () => {
    const notes = noteItems('{r as C} C E G 0')

    expect(notes[0]?.hz).toBeAround(220, 6)
    expect(notes[1]?.hz).toBeAround(220 * (81 / 64), 6)
    expect(notes[2]?.hz).toBeAround(220 * (3 / 2), 6)
    expect(notes[3]?.hz).toBeAround(220, 6)
  })

  it('can associate a root setter frequency with an octave-shifted absolute nominal', () => {
    const notes = noteItems('{r216Hz as `A} `A A 0')

    expect(notes.map((note) => note.label)).toEqual(['A♮', 'A♮', String.raw`0\12  0.0c`])
    expect(notes[0]?.hz).toBeAround(216, 6)
    expect(notes[1]?.hz).toBeAround(432, 6)
    expect(notes[2]?.hz).toBeAround(216, 6)
  })

  it('commutes root nomination with edo scale setters', () => {
    const beforeScale = noteItems('{r as C}{31edo} C 0')
    const afterScale = noteItems('{31edo}{r as C} C 0')

    expect(beforeScale.map((note) => note.hz)).toEqual(afterScale.map((note) => note.hz))
    expect(beforeScale[0]?.hz).toBeAround(220, 6)
    expect(beforeScale[1]?.hz).toBeAround(220, 6)
  })

  it('tempers spiral-of-fifths nominals and accidentals to the active edo mapping', () => {
    const notes = noteItems('{31edo} `A E B F# Cb')

    expect(notes.map((note) => note.label)).toEqual(['A♮', 'E♮', 'B♮', 'F♯', 'C♭'])
    const expectedRatios = [
      1,
      Math.pow(2, 18 / 31),
      Math.pow(2, 36 / 31),
      Math.pow(2, 23 / 31),
      Math.pow(2, 6 / 31),
    ]
    notes.forEach((note, index) => expect(note.hz / 220).toBeAround(expectedRatios[index]!, 10))
  })

  it('translates interordinal Greek nominals halfway around the octave spiral', () => {
    const notes = noteItems('Alp Bet Gam Del Eps Zet')

    expect(notes.map((note) => note.label)).toEqual(['Α♮', 'Β♮', 'Γ♮', 'Δ♮', 'Ε♮', 'Ζ♮'])
    const expectedRatios = [
      Math.SQRT2,
      9 / 4 / Math.SQRT2,
      (32 / 27) * Math.SQRT2,
      (4 / 3) * Math.SQRT2,
      (3 / 2) * Math.SQRT2,
      (128 / 81) * Math.SQRT2,
    ]
    notes.forEach((note, index) => expect(note.hz / 220).toBeAround(expectedRatios[index]!, 10))
  })
})

describe('grammar to ruler state', () => {
  //
  // 1 (rl:0,'0) 2
  //

  const RULER_RANGE_TEST = JSON.parse(
    `{"type":"XenpaperGrammar","delimiter":false,"sequence":{"type":"Sequence","delimiter":false,"items":[{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":1,"len":1,"pos":0},"len":1,"pos":0},"len":1,"pos":0},{"type":"Whitespace","delimiter":true,"len":1,"pos":1},{"type":"SetterGroup","delimiter":false,"setters":[{"type":"SetRulerRange","delimiter":false,"low":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":6},"len":1,"pos":6},"high":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":0,"len":1,"pos":9},"octave":{"type":"OctaveModifier","delimiter":false,"octave":1,"len":1,"pos":8},"len":2,"pos":8},"len":7,"pos":3}],"len":9,"pos":2},{"type":"Whitespace","delimiter":true,"len":1,"pos":11},{"type":"Note","delimiter":false,"pitch":{"type":"Pitch","delimiter":false,"value":{"type":"PitchDegree","delimiter":false,"degree":2,"len":1,"pos":12},"len":1,"pos":12},"len":1,"pos":12}],"len":13,"pos":0},"len":13,"pos":0}`,
  )

  it('should translate ruler range', () => {
    expect(processGrammar(RULER_RANGE_TEST).initialRulerState).toEqual({
      lowHz: 220,
      highHz: 440,
      octaveSize: 2,
      plots: [],
      rootHz: 220,
    })
  })
})

describe('grammar numeric validation', () => {
  it.each([
    ['(div:0) 0', 'SetSubdivision.subdivision must be a finite positive number, got 0'],
    ['(bms:0) 0', 'SetBms.bms must be a finite positive number, got 0'],
    ['(^:1/0) ^A', 'SetUp.denominator must be a finite positive number, got 0'],
    ['(/:1/0) /A', 'SetLift.denominator must be a finite positive number, got 0'],
    ['(^:12001c) ^A', 'SetUp must be between -12000 and 12000, got 12001'],
    ['{0edo} 0', 'EdoScale.divisions must be between 1 and 10000, got 0'],
    ['1/0', 'PitchRatio.denominator must be a finite positive number, got 0'],
    [String.raw`1\0`, 'PitchOctaveDivision.denominator must be a finite positive number, got 0'],
  ])('should reject invalid numeric input in %s', (source, expectedError) => {
    const result = parseAndProcessSourceCode(source)

    expect(result.playable).toBe(false)
    expect(result.error).toContain(expectedError)
  })
})
