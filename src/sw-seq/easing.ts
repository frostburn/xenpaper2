export type EasingName = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'

export const easingCurve = (
  easing: Exclude<EasingName, 'linear'>,
  y0: number,
  y1: number,
): Float32Array => {
  const values = new Float32Array(64)
  for (let i = 0; i < values.length; ++i) {
    const t = i / (values.length - 1)
    switch (easing) {
      case 'ease-in':
        // Accelerate from a standstill
        values[i] = y0 + (y1 - y0) * t ** 2
        break
      case 'ease-out':
        // Slow to a standstill
        values[i] = y1 + (y0 - y1) * (1 - t) ** 2
        break
      case 'ease-in-out':
        // From standstill to standstill
        values[i] = y0 + (y1 - y0) * (3 - 2 * t) * t ** 2
        break
      case 'ease':
        // With initial velocity but smoother than linear
        values[i] = y0 + 0.25 * t * (3 + 6 * t - 5 * t * t) * (y1 - y0)
        break
    }
  }
  return values
}
