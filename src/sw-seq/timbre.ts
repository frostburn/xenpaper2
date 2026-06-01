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

export type CustomTimbre = 'amsine' | 'amtriangle'

export type FatOscillatorType =
  `fat${BasicOscillatorType | BasicOscillatorWithPartials | CustomTimbre}`

export type SWOscillatorType =
  | BasicOscillatorType
  | BasicOscillatorWithPartials
  | CustomTimbre
  | FatOscillatorType

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

const PERIODIC_WAVE_CACHE = new Map<BasicOscillatorWithPartials | CustomTimbre, PeriodicWave>()

const BASIC_OSCILLATOR_TYPES = ['sawtooth', 'square', 'sine', 'triangle'] as const

const CUSTOM_TIMBRES = ['amsine', 'amtriangle'] as const

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
    if (digits === undefined || !digits.length) {
      if (CUSTOM_TIMBRES.includes(value as (typeof CUSTOM_TIMBRES)[0])) {
        return true
      }
    } else {
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
  const digits = name.split(/[^\d]/).slice(-1)[0]
  if (digits === undefined || !digits.length) {
    const real: number[] = []
    const imag: number[] = []
    if (name === 'amsine') {
      real.push(2 / Math.PI)
      imag.push(0)

      real.push(0)
      imag.push(1)
      for (let n = 2; n < 128; ++n) {
        if (n & 1) {
          real.push(0)
        } else {
          real.push(-4 / (Math.PI * (n * n - 1)))
        }
        imag.push(0)
      }
    } else if (name === 'amtriangle') {
      real.push(0.25)
      imag.push(0)
      for (let n = 1; n < 128; ++n) {
        switch (n % 4) {
          case 0:
            real.push(0)
            imag.push(0)
            break
          case 1:
            real.push(0)
            imag.push(-2 / (Math.PI * Math.PI * n * n))
            break
          case 2:
            real.push(-4 / (Math.PI * Math.PI * n * n))
            imag.push(0)
            break
          case 3:
            real.push(0)
            imag.push(2 / (Math.PI * Math.PI * n * n))
            break
        }
      }
    } else {
      throw new Error(`Invalid oscillator type '${name}'`)
    }
    const periodicWave = context.createPeriodicWave(real, imag)
    PERIODIC_WAVE_CACHE.set(name, periodicWave)
    return {
      type: 'custom',
      unison,
      periodicWave,
    }
  }
  const count = parseInt(digits, 10)
  const entry = name
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
