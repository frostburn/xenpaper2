export type BasicOscillatorType = Exclude<OscillatorType, 'custom'>

export type PartialsRange =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32

export type BasicOscillatorWithPartials = `${BasicOscillatorType}${PartialsRange}`

export type FatOscillatorType = `fat${BasicOscillatorType | BasicOscillatorWithPartials}`

export type SWOscillatorType = BasicOscillatorType | BasicOscillatorWithPartials | FatOscillatorType

export type SynthType =
  | {
      type: BasicOscillatorType
      unison: boolean
      periodicWave: null
    }
  | {
      type: 'custom'
      unison: boolean
      periodicWave: PeriodicWave
    }

const PERIODIC_WAVE_CACHE = new Map<BasicOscillatorWithPartials, PeriodicWave>()

const BASIC_OSCILLATOR_TYPES = ['sawtooth', 'square', 'sine', 'triangle'] as const

const isBasicOscillatorType = (value: unknown): value is BasicOscillatorType =>
  typeof value === 'string' && BASIC_OSCILLATOR_TYPES.includes(value as BasicOscillatorType)

// XXX: The check is valid only for SWOscillatorType
const isFatOscillatorType = (value: unknown): value is FatOscillatorType =>
  typeof value === 'string' && value.startsWith('fat')

export function isSWOscillatorType(value: unknown): value is SWOscillatorType {
  if (isFatOscillatorType(value)) {
    value = value.slice(3)
  }
  if (typeof value === 'string') {
    const digits = value.split(/[^\d]/).slice(-1)[0]
    if (digits !== undefined && digits.length) {
      const count = parseInt(digits, 10)
      if (count < 1 || count > 32) {
        return false
      }
      value = value.slice(0, value.length - digits.length)
    }
  }
  return isBasicOscillatorType(value)
}

export function parseSWOscillatorType(
  name: SWOscillatorType,
  context: BaseAudioContext,
): SynthType {
  let unison = false
  if (isFatOscillatorType(name)) {
    unison = true
    name = name.slice(3) as BasicOscillatorType | BasicOscillatorWithPartials
  }
  if (isBasicOscillatorType(name)) {
    return {
      type: name,
      unison,
      periodicWave: null,
    }
  }
  if (PERIODIC_WAVE_CACHE.has(name)) {
    return {
      type: 'custom',
      unison,
      periodicWave: PERIODIC_WAVE_CACHE.get(name)!,
    }
  }
  const entry = name
  const digits = name.split(/[^\d]/).slice(-1)[0]
  if (digits === undefined || !digits.length) {
    throw new Error(`Invalid oscillator type '${name}'`)
  }
  const count = parseInt(digits, 10)
  name = name.slice(0, name.length - digits.length) as SWOscillatorType
  if (!isBasicOscillatorType(name)) {
    throw new Error(`Invalid oscillator type '${name}'`)
  }
  const harmonics = [0]
  for (let n = 1; n <= count; ++n) {
    if (name === 'sawtooth') {
      harmonics.push(1 / n)
    } else if (name === 'square') {
      harmonics.push((n & 1) / n)
    } else if (name === 'sine') {
      harmonics.push(n === 1 ? 1 : 0)
    } else if (name === 'triangle') {
      harmonics.push((n & 1) / (n * n))
    }
  }
  const periodicWave = context.createPeriodicWave(
    harmonics.map((_) => 0),
    harmonics,
  )
  PERIODIC_WAVE_CACHE.set(entry, periodicWave)
  return {
    type: 'custom',
    unison,
    periodicWave,
  }
}
