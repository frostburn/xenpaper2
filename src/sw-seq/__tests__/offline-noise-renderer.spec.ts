import { describe, expect, it } from 'vitest'

import { renderOfflineNoiseEvents, stripOfflineNoiseEvents } from '../offline-noise-renderer'

describe('offline noise renderer', () => {
  it('strips all noise notes from the realtime engine score and keeps them for mixing', () => {
    const { scores, noiseEvents } = stripOfflineNoiseEvents(
      [
        {
          gain: 0.75,
          score: {
            lengthTime: 4,
            sequence: [
              { type: 'PARAM_TIME', time: 0, value: { type: 'noise', noise: 'white' } },
              { type: 'NOTE_TIME', time: 0, timeEnd: 0.1, hz: 440, label: '0' },
              { type: 'NOTE_TIME', time: 1, timeEnd: 1.1, hz: 440, label: '0' },
              { type: 'NOTE_TIME', time: 2, timeEnd: 2.1, hz: 440, label: '0' },
              { type: 'PARAM_TIME', time: 3, value: { type: 'osc', osc: 'sine' } },
              { type: 'NOTE_TIME', time: 3, timeEnd: 3.1, hz: 440, label: '0' },
            ],
          },
        },
      ],
      0.1,
      48_000,
    )

    expect(noiseEvents).toHaveLength(3)
    expect(scores[0]!.score.sequence).toEqual([
      { type: 'PARAM_TIME', time: 3, value: { type: 'osc', osc: 'sine' } },
      { type: 'NOTE_TIME', time: 3, timeEnd: 3.1, hz: 440, label: '0' },
    ])
  })

  it('mixes every collected noise event into the rendered buffer', () => {
    const channel = new Float32Array(48_000)
    const buffer = {
      sampleRate: 48_000,
      length: 48_000,
      numberOfChannels: 1,
      getChannelData: () => channel,
    } as unknown as AudioBuffer
    const { noiseEvents } = stripOfflineNoiseEvents(
      [
        {
          gain: 1,
          score: {
            lengthTime: 0.4,
            sequence: [
              { type: 'PARAM_TIME', time: 0, value: { type: 'noise', noise: 'white' } },
              { type: 'PARAM_TIME', time: 0, value: { type: 'env', a: 0, d: 0, s: 1, r: 0 } },
              { type: 'NOTE_TIME', time: 0, timeEnd: 0.01, hz: 440, label: '0' },
              { type: 'NOTE_TIME', time: 0.1, timeEnd: 0.11, hz: 440, label: '0' },
              { type: 'NOTE_TIME', time: 0.2, timeEnd: 0.21, hz: 440, label: '0' },
            ],
          },
        },
      ],
      0,
      48_000,
    )

    renderOfflineNoiseEvents(buffer, noiseEvents)

    expect(channel.subarray(0, 480).some((sample) => sample !== 0)).toBe(true)
    expect(channel.subarray(4_800, 5_280).some((sample) => sample !== 0)).toBe(true)
    expect(channel.subarray(9_600, 10_080).some((sample) => sample !== 0)).toBe(true)
  })
})
