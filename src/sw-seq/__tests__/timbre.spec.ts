import { describe, expect, it } from 'vitest'

import { isSWOscillatorType, parseSWOscillatorType } from '../timbre'

describe('sw-seq timbre parsing', () => {
  it('accepts the noise generator oscillator type', () => {
    expect(isSWOscillatorType('noise')).toBe(true)
    expect(parseSWOscillatorType('noise', {} as BaseAudioContext)).toEqual({
      type: 'noise',
      periodicity: 'noise',
      periodicWave: null,
      aperiodicWave: null,
    })
  })

  it('rejects fat noise because the noise generator is not harmonic', () => {
    expect(isSWOscillatorType('fatnoise')).toBe(false)
  })
})
