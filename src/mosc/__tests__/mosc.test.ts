import { describe, expect, it } from 'vitest'
import { sortByTime, scoreToTime } from '..'

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
