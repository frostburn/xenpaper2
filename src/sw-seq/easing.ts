export type EasingName =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'ease-in-sine'
  | 'ease-out-sine'
  | 'ease-in-out-sine'
  | 'ease-in-quad'
  | 'ease-out-quad'
  | 'ease-in-out-quad'
  | 'ease-in-cubic'
  | 'ease-out-cubic'
  | 'ease-in-out-cubic'
  | 'ease-in-quart'
  | 'ease-out-quart'
  | 'ease-in-out-quart'
  | 'ease-in-quint'
  | 'ease-out-quint'
  | 'ease-in-out-quint'
  | 'ease-in-expo'
  | 'ease-out-expo'
  | 'ease-in-out-expo'
  | 'ease-in-circ'
  | 'ease-out-circ'
  | 'ease-in-out-circ'

const easeInOutPower = (t: number, power: number): number =>
  t < 0.5 ? 2 ** (power - 1) * t ** power : 1 - (-2 * t + 2) ** power / 2

const easingProgress = (easing: Exclude<EasingName, 'linear'>, t: number): number => {
  switch (easing) {
    case 'ease-in':
    case 'ease-in-quad':
      return t ** 2
    case 'ease-out':
    case 'ease-out-quad':
      return 1 - (1 - t) ** 2
    case 'ease-in-out':
    case 'ease-in-out-quad':
      return (3 - 2 * t) * t ** 2
    case 'ease':
      return 0.25 * t * (3 + 6 * t - 5 * t * t)
    case 'ease-in-sine':
      return 1 - Math.cos((t * Math.PI) / 2)
    case 'ease-out-sine':
      return Math.sin((t * Math.PI) / 2)
    case 'ease-in-out-sine':
      return -(Math.cos(Math.PI * t) - 1) / 2
    case 'ease-in-cubic':
      return t ** 3
    case 'ease-out-cubic':
      return 1 - (1 - t) ** 3
    case 'ease-in-out-cubic':
      return easeInOutPower(t, 3)
    case 'ease-in-quart':
      return t ** 4
    case 'ease-out-quart':
      return 1 - (1 - t) ** 4
    case 'ease-in-out-quart':
      return easeInOutPower(t, 4)
    case 'ease-in-quint':
      return t ** 5
    case 'ease-out-quint':
      return 1 - (1 - t) ** 5
    case 'ease-in-out-quint':
      return easeInOutPower(t, 5)
    case 'ease-in-expo':
      return t === 0 ? 0 : 2 ** (10 * t - 10)
    case 'ease-out-expo':
      return t === 1 ? 1 : 1 - 2 ** (-10 * t)
    case 'ease-in-out-expo':
      if (t === 0 || t === 1) return t
      return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2
    case 'ease-in-circ':
      return 1 - Math.sqrt(1 - t ** 2)
    case 'ease-out-circ':
      return Math.sqrt(1 - (t - 1) ** 2)
    case 'ease-in-out-circ':
      return t < 0.5
        ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
        : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2
  }
}

export const easingCurve = (
  easing: Exclude<EasingName, 'linear'>,
  y0: number,
  y1: number,
): Float32Array => {
  const values = new Float32Array(64)
  for (let i = 0; i < values.length; ++i) {
    const t = i / (values.length - 1)
    values[i] = y0 + (y1 - y0) * easingProgress(easing, t)
  }
  return values
}
