import { describe, expect, it } from 'vitest'

import { approximateTempoTime, EASING_NAMES, easingCurve, integrateLinearTempo } from '../easing'

const nonLinearEasingNames = EASING_NAMES.filter((easing) => easing !== 'linear')
const monotonicEasingNames = nonLinearEasingNames.filter(
  (easing) =>
    !easing.includes('back') && !easing.includes('overshoot') && !easing.includes('bounce'),
)

describe('easing utilities', () => {
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

  it('keeps the linear tempo analytic solution close to the area approximation', () => {
    const cases = [
      { bpm1: 120, bpm2: 60, duration: 3, totalDuration: 3 },
      { bpm1: 90, bpm2: 180, duration: 2, totalDuration: 4 },
      { bpm1: 300, bpm2: 100, duration: 1.5, totalDuration: 2.5 },
    ]

    for (const { bpm1, bpm2, duration, totalDuration } of cases) {
      expect(integrateLinearTempo(bpm1, bpm2, duration, totalDuration)).toBeCloseTo(
        approximateTempoTime(bpm1, bpm2, duration, totalDuration, 'linear'),
        4,
      )
    }
  })
})
