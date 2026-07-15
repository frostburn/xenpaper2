import { describe, expect, it } from 'vitest'

import { easingCurve, type EasingName } from '../easing'

const easingNames = [
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-sine',
  'ease-out-sine',
  'ease-in-out-sine',
  'ease-in-quad',
  'ease-out-quad',
  'ease-in-out-quad',
  'ease-in-cubic',
  'ease-out-cubic',
  'ease-in-out-cubic',
  'ease-in-quart',
  'ease-out-quart',
  'ease-in-out-quart',
  'ease-in-quint',
  'ease-out-quint',
  'ease-in-out-quint',
  'ease-in-expo',
  'ease-out-expo',
  'ease-in-out-expo',
  'ease-in-circ',
  'ease-out-circ',
  'ease-in-out-circ',
] as const satisfies readonly Exclude<EasingName, 'linear'>[]

describe('easingCurve', () => {
  it('supports every non-linear easing from the glissando grammar', () => {
    for (const easing of easingNames) {
      const curve = easingCurve(easing, 20, 80)

      expect(curve).toHaveLength(64)
      expect(curve[0]).toBeCloseTo(20)
      expect(curve[curve.length - 1]).toBeCloseTo(80)
      expect([...curve].every(Number.isFinite)).toBe(true)
    }
  })

  it('keeps increasing glissando curves monotonic', () => {
    for (const easing of easingNames) {
      const curve = easingCurve(easing, -10, 10)

      for (let index = 1; index < curve.length; index += 1) {
        expect(curve[index]).toBeGreaterThanOrEqual(curve[index - 1]!)
      }
    }
  })
})
