import { describe, expect, it } from 'vitest'

import { cyclicEventIndex } from '../utils'

describe('cyclicEventIndex', () => {
  it('selects events using epsilon-closeness within a repeating cycle', () => {
    expect(cyclicEventIndex(0, 0, 1, 4)).toBe(0)
    expect(cyclicEventIndex(1e-10, 0, 1, 4)).toBe(0)
    expect(cyclicEventIndex(0.25 - 5e-10, 0, 1, 4)).toBe(1)
    expect(cyclicEventIndex(0.5 - 5e-10, 0, 1, 4)).toBe(2)
    expect(cyclicEventIndex(1 - 5e-10, 0, 1, 4)).toBe(0)
    expect(cyclicEventIndex(1.25 - 5e-10, 0, 1, 4)).toBe(1)
  })

  it('uses the cycle origin and reports no event for empty cycles', () => {
    expect(cyclicEventIndex(10.5 - 5e-10, 10, 1, 2)).toBe(1)
    expect(cyclicEventIndex(9.5 - 5e-10, 10, 1, 2)).toBe(1)
    expect(cyclicEventIndex(0, 0, 1, 0)).toBeNull()
  })

  it('allows callers to override epsilon', () => {
    expect(cyclicEventIndex(0.25 - 5e-10, 0, 1, 4, 1e-10)).toBe(0)
    expect(cyclicEventIndex(0.25 - 5e-10, 0, 1, 4, 1e-9)).toBe(1)
  })
})
