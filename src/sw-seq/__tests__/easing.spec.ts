import { describe, expect, it } from 'vitest'

import { EASING_NAMES, easingCurve } from '../../mosc/easing'

const nonLinearEasingNames = EASING_NAMES.filter((easing) => easing !== 'linear')
const monotonicEasingNames = nonLinearEasingNames.filter(
  (easing) =>
    !easing.includes('back') && !easing.includes('overshoot') && !easing.includes('bounce'),
)

describe('easingCurve', () => {
  it('supports every non-linear easing from the shared easing list', () => {
    for (const easing of nonLinearEasingNames) {
      const curve = easingCurve(easing, 20, 80)

      expect(curve).toHaveLength(64)
      expect(curve[0]).toBeCloseTo(20)
      expect(curve[curve.length - 1]).toBeCloseTo(80)
      expect([...curve].every(Number.isFinite)).toBe(true)
    }
  })

  it('keeps non-overshooting increasing glissando curves monotonic', () => {
    for (const easing of monotonicEasingNames) {
      const curve = easingCurve(easing, -10, 10)

      for (let index = 1; index < curve.length; index += 1) {
        expect(curve[index]).toBeGreaterThanOrEqual(curve[index - 1]!)
      }
    }
  })

  it('supports overshoot and bounce curves that can move beyond direct interpolation', () => {
    expect(Math.min(...easingCurve('ease-in-back', 0, 1))).toBeLessThan(0)
    expect(Math.max(...easingCurve('ease-out-back', 0, 1))).toBeGreaterThan(1)
    expect(Math.min(...easingCurve('ease-in-overshoot', 0, 1))).toBeLessThan(0)
    expect(Math.max(...easingCurve('ease-out-overshoot', 0, 1))).toBeGreaterThan(1)

    const bounceCurve = [...easingCurve('ease-out-bounce', 0, 1)]
    expect(bounceCurve.some((value, index) => index > 0 && value < bounceCurve[index - 1]!)).toBe(
      true,
    )
  })
})
