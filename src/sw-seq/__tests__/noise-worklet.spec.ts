import { describe, expect, it } from 'vitest'

import { isNoiseGeneratorType, type NoiseGeneratorType } from '../noise-worklet'

const NOISE_GENERATOR_TYPES = [
  'white',
  'pink',
  'brown',
  'blue',
  'violet',
] as const satisfies readonly NoiseGeneratorType[]

describe('noise worklet', () => {
  it('recognizes all supported noise colors', () => {
    expect(NOISE_GENERATOR_TYPES.every((noise) => isNoiseGeneratorType(noise))).toBe(true)
  })

  it('rejects unsupported noise colors', () => {
    expect(isNoiseGeneratorType('green')).toBe(false)
  })
})
