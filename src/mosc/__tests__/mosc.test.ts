import { describe, expect, it } from 'vitest'
import {
  centsToRatio,
  octaveDivisionToRatio,
  ratioToCents,
  ratioToOctaveDivision,
  sortByTime,
  scoreToTime,
} from '..'

describe('centsToRatio', () => {
  it('should convert cent to ratio', () => {
    expect(centsToRatio(0)).toBe(1)
    expect(centsToRatio(-1200)).toBe(0.5)
    expect(centsToRatio(2400)).toBe(4)
    expect(Math.floor(centsToRatio(702) * 1000) / 1000).toBe(3 / 2)
  })

  it('should convert cent to ratio with octave', () => {
    expect(centsToRatio(0, 1)).toBe(2)
    expect(centsToRatio(0, 2)).toBe(4)
    expect(Math.floor(centsToRatio(702, 1) * 1000) / 1000).toBe(3)
  })
})

describe('octaveDivisionToRatio', () => {
  it('should octave division to ratio', () => {
    expect(octaveDivisionToRatio(4, 12, 2)).toBe(1.2599210498948732)
    expect(octaveDivisionToRatio(6, 6, 2)).toBe(2)
    expect(octaveDivisionToRatio(12, 6, 2)).toBe(4)
    expect(octaveDivisionToRatio(0, 6, 2, 2)).toBe(4)
  })
})

describe('ratioToCents', () => {
  it('should convert cent to ratio', () => {
    expect(ratioToCents(1)).toBe(0)
    expect(ratioToCents(0.5)).toBe(-1200)
    expect(ratioToCents(2)).toBe(1200)
    expect(ratioToCents(4)).toBe(2400)
  })

  it('should convert cent to ratio with octave', () => {
    expect(ratioToCents(2, 1)).toBe(0)
    expect(ratioToCents(4, 2)).toBe(0)
  })
})

describe('ratioToOctaveDivision', () => {
  it('should ratio to octave division', () => {
    expect(ratioToOctaveDivision(1.2599210498948732, 12, 2)).toBe(4)
    expect(ratioToOctaveDivision(2, 6, 2)).toBe(6)
    expect(ratioToOctaveDivision(4, 6, 2)).toBe(12)
    expect(ratioToOctaveDivision(4, 6, 2, 2)).toBe(0)
  })
})

describe('sortByTime', () => {
  it('should sort items by time', () => {
    expect(
      sortByTime([
        {
          type: 'NOTE_TIME',
          time: 2,
          timeEnd: 2,
          hz: 440,
          label: '440',
        },
        {
          type: 'NOTE_TIME',
          time: 0,
          timeEnd: 2,
          hz: 550,
          label: '550',
        },
        {
          type: 'TEMPO',
          lerp: false,
          time: 0,
          bpm: 120,
        },
      ]),
    ).toEqual([
      {
        type: 'NOTE_TIME',
        time: 0,
        timeEnd: 2,
        hz: 550,
        label: '550',
      },
      {
        type: 'TEMPO',
        lerp: false,
        time: 0,
        bpm: 120,
      },
      {
        type: 'NOTE_TIME',
        time: 2,
        timeEnd: 2,
        hz: 440,
        label: '440',
      },
    ])
  })
})

describe('scoreToTime', () => {
  it('should convert mosc items from beat time to real time', () => {
    expect(
      scoreToTime({
        sequence: [
          {
            type: 'TEMPO',
            lerp: false,
            time: 0,
            bpm: 120,
          },
          {
            type: 'NOTE_TIME',
            time: 0,
            timeEnd: 1,
            hz: 440,
            label: '440',
          },
          {
            type: 'NOTE_TIME',
            time: 1,
            timeEnd: 2,
            hz: 550,
            label: '550',
          },
          {
            type: 'TEMPO',
            lerp: false,
            time: 2,
            bpm: 90,
          },
          {
            type: 'NOTE_TIME',
            time: 2,
            timeEnd: 3,
            hz: 660,
            label: '660',
          },
          {
            type: 'PARAM_TIME',
            time: 4,
            value: [1, 2, 3],
          },
          {
            type: 'TEMPO',
            lerp: false,
            time: 5,
            bpm: 1,
          },
        ],
        lengthTime: 6,
      }),
    ).toEqual({
      sequence: [
        {
          type: 'NOTE_TIME',
          time: 0,
          timeEnd: 0.5,
          hz: 440,
          label: '440',
        },
        {
          type: 'NOTE_TIME',
          time: 0.5,
          timeEnd: 1,
          hz: 550,
          label: '550',
        },
        {
          type: 'NOTE_TIME',
          time: 1,
          timeEnd: 1.6666666666666665,
          hz: 660,
          label: '660',
        },
        {
          type: 'PARAM_TIME',
          time: 2.333333333333333,
          value: [1, 2, 3],
        },
      ],
      lengthTime: 63,
    })
  })

  it('should convert mosc items from beat time to real time with interpolation', () => {
    expect(
      scoreToTime({
        sequence: [
          {
            type: 'TEMPO',
            lerp: false,
            time: 0,
            bpm: 120,
          },
          {
            type: 'TEMPO',
            lerp: false,
            time: 1,
            bpm: 120,
          },
          {
            type: 'TEMPO',
            lerp: true,
            time: 4,
            bpm: 60,
          },
          {
            type: 'NOTE_TIME',
            time: 1,
            timeEnd: 1,
            hz: 440,
            label: '440',
          },
          {
            type: 'NOTE_TIME',
            time: 2,
            timeEnd: 2,
            hz: 550,
            label: '550',
          },
          {
            type: 'NOTE_TIME',
            time: 3,
            timeEnd: 3,
            hz: 660,
            label: '660',
          },
          {
            type: 'NOTE_TIME',
            time: 4,
            timeEnd: 4,
            hz: 770,
            label: '770',
          },
          {
            type: 'NOTE_TIME',
            time: 5,
            timeEnd: 5,
            hz: 880,
            label: '880',
          },
        ],
        lengthTime: 5,
      }),
    ).toEqual({
      sequence: [
        {
          type: 'NOTE_TIME',
          time: 0.5,
          timeEnd: 0.5,
          hz: 440,
          label: '440',
        },
        {
          type: 'NOTE_TIME',
          time: 1.1666666666666665,
          timeEnd: 1.1666666666666665,
          hz: 550,
          label: '550',
        },
        {
          type: 'NOTE_TIME',
          time: 1.8333333333333333,
          timeEnd: 1.8333333333333333,
          hz: 660,
          label: '660',
        },
        {
          type: 'NOTE_TIME',
          time: 2.5,
          timeEnd: 2.5,
          hz: 770,
          label: '770',
        },
        {
          type: 'NOTE_TIME',
          time: 3.5,
          timeEnd: 3.5,
          hz: 880,
          label: '880',
        },
      ],
      lengthTime: 3.5,
    })
  })
})
