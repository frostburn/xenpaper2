export type EasingName = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'

const EASING_BEZIERS = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
} as const

const cubicBezier = (x1: number, y1: number, x2: number, y2: number, x: number): number => {
  const sample = (a1: number, a2: number, t: number): number => {
    const inv = 1 - t
    return 3 * inv * inv * t * a1 + 3 * inv * t * t * a2 + t * t * t
  }
  const slope = (a1: number, a2: number, t: number): number =>
    3 * (1 - t) * (1 - t) * a1 + 6 * (1 - t) * t * (a2 - a1) + 3 * t * t * (1 - a2)

  let t = x
  for (let i = 0; i < 8; i += 1) {
    const xAtT = sample(x1, x2, t) - x
    const dx = slope(x1, x2, t)
    if (Math.abs(xAtT) < 1e-6 || dx === 0) break
    t -= xAtT / dx
  }

  return sample(y1, y2, Math.min(1, Math.max(0, t)))
}

export const easingCurve = (
  easing: Exclude<EasingName, 'linear'>,
  centsStart: number,
  centsEnd: number,
): Float32Array => {
  const [x1, y1, x2, y2] = EASING_BEZIERS[easing]
  const values = new Float32Array(128)
  for (let index = 0; index < values.length; index += 1) {
    const x = index / (values.length - 1)
    values[index] = centsStart + cubicBezier(x1, y1, x2, y2, x) * (centsEnd - centsStart)
  }
  return values
}
