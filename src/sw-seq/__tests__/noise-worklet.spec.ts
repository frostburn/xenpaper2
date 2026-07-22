import { describe, expect, it } from 'vitest'

import {
  isNoiseGeneratorType,
  isNoiseInterpolationType,
  type NoiseGeneratorType,
  type NoiseInterpolationType,
} from '../noise-worklet'

const NOISE_GENERATOR_TYPES = [
  'white',
  'pink',
  'brown',
  'blue',
  'violet',
] as const satisfies readonly NoiseGeneratorType[]

const NOISE_INTERPOLATION_TYPES = [
  'constant',
  'linear',
  'impulse',
] as const satisfies readonly NoiseInterpolationType[]

describe('noise worklet', () => {
  it('recognizes all supported noise colors', () => {
    expect(NOISE_GENERATOR_TYPES.every((noise) => isNoiseGeneratorType(noise))).toBe(true)
  })

  it('rejects unsupported noise colors', () => {
    expect(isNoiseGeneratorType('green')).toBe(false)
  })

  it('recognizes all supported interpolation modes', () => {
    expect(
      NOISE_INTERPOLATION_TYPES.every((interpolation) => isNoiseInterpolationType(interpolation)),
    ).toBe(true)
  })

  it('rejects unsupported interpolation modes', () => {
    expect(isNoiseInterpolationType('cubic')).toBe(false)
  })
})
