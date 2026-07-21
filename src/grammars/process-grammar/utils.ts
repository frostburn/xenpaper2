import { mmod } from 'xen-dev-utils/fraction'

export const DEFAULT_CYCLIC_EVENT_EPSILON = 1e-9

export const cyclicEventIndex = (
  time: number,
  cycleOrigin: number,
  cycleSpan: number,
  eventCount: number,
  epsilon = DEFAULT_CYCLIC_EVENT_EPSILON,
): number | null => {
  if (eventCount <= 0) return null

  const relativeTime = time - cycleOrigin
  const sourceTime = mmod(relativeTime, cycleSpan)
  const normalizedSourceTime = sourceTime >= cycleSpan - epsilon ? 0 : sourceTime
  const sourceStep = cycleSpan / eventCount

  return Math.min(Math.floor((normalizedSourceTime + epsilon) / sourceStep), eventCount - 1)
}
