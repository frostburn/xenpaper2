const easeInOutPower = (t: number, power: number): number =>
  t < 0.5 ? 2 ** (power - 1) * t ** power : 1 - (-2 * t + 2) ** power / 2

const easeOutBounce = (t: number): number => {
  const n1 = 7.5625
  const d1 = 2.75

  if (t < 1 / d1) return n1 * t ** 2
  if (t < 2 / d1) return n1 * (t - 1.5 / d1) ** 2 + 0.75
  if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) ** 2 + 0.9375
  return n1 * (t - 2.625 / d1) ** 2 + 0.984375
}

const easeInBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return c3 * t ** 3 - c1 * t ** 2
}

const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export const EASING_NAMES = [
  'linear',
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
  'ease-in-back',
  'ease-out-back',
  'ease-in-out-back',
  'ease-in-overshoot',
  'ease-out-overshoot',
  'ease-in-out-overshoot',
  'ease-in-bounce',
  'ease-out-bounce',
  'ease-in-out-bounce',
] as const

export type EasingName = (typeof EASING_NAMES)[number]
export type TempoInterpolationName = EasingName | 'constant'

export const isEasingName = (value: string): value is EasingName =>
  EASING_NAMES.some((easing) => easing === value)

export const easingValue = (easing: Exclude<EasingName, 'linear'>, t: number): number => {
  switch (easing) {
    case 'ease-in':
    case 'ease-in-quad':
      return t ** 2
    case 'ease-out':
    case 'ease-out-quad':
      return 1 - (1 - t) ** 2
    case 'ease-in-out':
      return (3 - 2 * t) * t ** 2
    case 'ease-in-out-quad':
      return easeInOutPower(t, 2)
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
    case 'ease-in-back':
    case 'ease-in-overshoot':
      return easeInBack(t)
    case 'ease-out-back':
    case 'ease-out-overshoot':
      return easeOutBack(t)
    case 'ease-in-out-back':
    case 'ease-in-out-overshoot':
      return t < 0.5 ? (1 - easeOutBack(1 - 2 * t)) / 2 : (1 + easeOutBack(2 * t - 1)) / 2
    case 'ease-in-bounce':
      return 1 - easeOutBounce(1 - t)
    case 'ease-out-bounce':
      return easeOutBounce(t)
    case 'ease-in-out-bounce':
      return t < 0.5 ? (1 - easeOutBounce(1 - 2 * t)) / 2 : (1 + easeOutBounce(2 * t - 1)) / 2
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
    values[i] = y0 + (y1 - y0) * easingValue(easing, t)
  }
  return values
}
const easingProgress = (easing: EasingName, t: number): number =>
  easing === 'linear' ? t : easingValue(easing, t)

export const approximateTempoTime = (
  bpm1: number,
  bpm2: number,
  duration: number,
  totalDuration = duration,
  interpolation: EasingName = 'linear',
): number => {
  const u = bpm1 / 60
  const v = bpm2 / 60
  if (u === v || totalDuration === 0) return duration / u

  const progress = duration / totalDuration
  const steps = Math.max(1, Math.ceil(256 * progress))
  let area = 0
  for (let index = 0; index < steps; index += 1) {
    const start = (progress * index) / steps
    const end = (progress * (index + 1)) / steps
    const startRate = u + (v - u) * easingProgress(interpolation, start)
    const endRate = u + (v - u) * easingProgress(interpolation, end)
    area += ((1 / startRate + 1 / endRate) * (end - start)) / 2
  }

  return totalDuration * area
}

export const integrateLinearTempo = (
  bpm1: number,
  bpm2: number,
  duration: number,
  totalDuration = duration,
): number => {
  const u = bpm1 / 60
  const v = bpm2 / 60
  if (u === v || totalDuration === 0) return duration / u

  const rateAtDuration = u + ((v - u) * duration) / totalDuration
  return (totalDuration / (v - u)) * Math.log(rateAtDuration / u)
}

export const integrateTempo = (
  bpm1: number,
  bpm2: number,
  duration: number,
  totalDuration = duration,
  interpolation: EasingName = 'linear',
): number =>
  interpolation === 'linear'
    ? integrateLinearTempo(bpm1, bpm2, duration, totalDuration)
    : approximateTempoTime(bpm1, bpm2, duration, totalDuration, interpolation)
