export type EasingName = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'

const cubicSpline = (easing: Exclude<EasingName, 'linear'>, x: number): number => {
  switch (easing) {
    case 'ease-in':
      return x * x * x
    case 'ease-out': {
      const inv = 1 - x
      return 1 - inv * inv * inv
    }
    case 'ease-in-out':
    case 'ease':
      return x * x * (3 - 2 * x)
  }
}

export const easingCurve = (
  easing: Exclude<EasingName, 'linear'>,
  centsStart: number,
  centsEnd: number,
): Float32Array => {
  const values = new Float32Array(128)
  for (let index = 0; index < values.length; index += 1) {
    const x = index / (values.length - 1)
    values[index] = centsStart + cubicSpline(easing, x) * (centsEnd - centsStart)
  }
  return values
}
