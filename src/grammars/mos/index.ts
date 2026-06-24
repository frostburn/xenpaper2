import { generateNotation, stepString } from 'moment-of-symmetry'
import { gcd, mmod } from 'xen-dev-utils/fraction'
import { centsToValue, valueToCents } from 'xen-dev-utils/conversion'

import type { MosExpressionType } from '../grammar.generated'

type MosMonzo = readonly [number, number]

type MosMode = { up: number; down: number; period: number | null }

export type MosConfig = {
  pattern: string
  equaveSize: number
  largeSteps: number
  smallSteps: number
  stepSize: number
  up: number
  lift: number
  chromaSteps: number
  nominalSteps: Map<string, number>
  equaveSteps: number
}

const MOS_ALPHABET = 'JKLMNOPQRSTUVWXYZ'

export const mosExpressionPrecedence = (expression: MosExpressionType): number => {
  switch (expression.type) {
    case 'MosLargeDeclaration':
    case 'MosSmallDeclaration':
    case 'MosRationalEquave':
    case 'MosHardnessDeclaration':
    case 'MosMode':
      return 1
    default:
      return 0
  }
}

export const mosNominalFromIndex = (index: number): string => {
  let remaining = index
  let length = 1
  while (remaining >= MOS_ALPHABET.length ** length) {
    remaining -= MOS_ALPHABET.length ** length
    length++
  }
  let result = ''
  for (let i = length - 1; i >= 0; i--) {
    const place = MOS_ALPHABET.length ** i
    const digit = Math.floor(remaining / place)
    result += MOS_ALPHABET[digit]
    remaining %= place
  }
  return result
}

const defaultModePattern = (countLarge: number, countSmall: number): string =>
  Array.from({ length: countLarge + countSmall }, (_, i) =>
    Math.floor(((i + 1) * countSmall) / (countLarge + countSmall)) >
    Math.floor((i * countSmall) / (countLarge + countSmall))
      ? 's'
      : 'L',
  ).join('')

export const mosStepPattern = (
  countLarge: number,
  countSmall: number,
  mode: MosMode | null,
): string => {
  const total = countLarge + countSmall
  if (total <= 0) throw new Error('MOS size must be positive.')
  if (!mode) return defaultModePattern(countLarge, countSmall)

  const period = mode.period ?? gcd(countLarge, countSmall)
  const generator = mode.up + mode.down
  if (generator <= 0 || gcd(generator, total) !== period) {
    throw new Error('Incompatible MOS mode brightness.')
  }

  // Validate with the library helper while preserving the permissive declaration ordering in our grammar.
  stepString(countLarge, countSmall, { up: mode.up, down: mode.down, period })

  const bright = new Set<number>()
  let degree = 0
  for (let i = 0; i < countLarge; i++) {
    bright.add(degree)
    degree = mmod(degree + generator, total)
  }
  return Array.from({ length: total }, (_, i) => (bright.has(i) ? 'L' : 's')).join('')
}

export const createMosConfig = (expressions: MosExpressionType[]): MosConfig => {
  let pattern: string | null = null
  let countLarge: number | null = null
  let countSmall: number | null = null
  let integerPattern: number[] | null = null
  let equaveSize = 2
  let largeSteps: number | null = null
  let smallSteps: number | null = null
  let hardness: { numerator: number; denominator: number } | null = null
  let mode: MosMode | null = null

  for (const expression of [...expressions].sort(
    (a, b) => mosExpressionPrecedence(a) - mosExpressionPrecedence(b),
  )) {
    switch (expression.type) {
      case 'MosAbstractStepPattern':
        pattern = expression.pattern
        break
      case 'MosIntegerPattern':
        integerPattern = expression.pattern
        pattern = expression.pattern
          .map((step) => (step === Math.max(...expression.pattern) ? 'L' : 's'))
          .join('')
        smallSteps = Math.min(...expression.pattern)
        largeSteps = Math.max(...expression.pattern)
        break
      case 'MosCountLarge':
        countLarge = expression.count
        break
      case 'MosCountSmall':
        countSmall = expression.count
        break
      case 'MosMode':
        mode = { up: expression.up, down: expression.down, period: expression.period }
        break
      case 'MosRationalEquave':
        if (expression.denominator <= 0) throw new Error('MOS equave denominator must be positive.')
        equaveSize = expression.numerator / expression.denominator
        break
      case 'MosHardnessDeclaration':
        if (expression.denominator <= 0)
          throw new Error('MOS hardness denominator must be positive.')
        hardness = { numerator: expression.numerator, denominator: expression.denominator }
        break
      case 'MosLargeDeclaration':
        largeSteps = expression.value.numerator / expression.value.denominator
        break
      case 'MosSmallDeclaration':
        smallSteps = expression.value.numerator / expression.value.denominator
        break
    }
  }

  if (!pattern && countLarge !== null && countSmall !== null) {
    pattern = mosStepPattern(countLarge, countSmall, mode)
  }
  if (!pattern) throw new Error('MOS declaration requires a pattern.')

  const actualCountLarge = (pattern.match(/L/g) ?? []).length
  const actualCountSmall = pattern.length - actualCountLarge
  if (largeSteps === null || smallSteps === null) {
    if (hardness === null) {
      hardness = integerPattern
        ? { numerator: Math.max(...integerPattern), denominator: Math.min(...integerPattern) }
        : { numerator: 2, denominator: 1 }
    }
    if (largeSteps !== null) {
      smallSteps = (largeSteps * hardness.denominator) / hardness.numerator
    } else if (smallSteps !== null) {
      largeSteps = (smallSteps * hardness.numerator) / hardness.denominator
    } else {
      largeSteps = hardness.numerator
      smallSteps = hardness.denominator
    }
  }

  const equaveSteps = actualCountLarge * largeSteps + actualCountSmall * smallSteps
  if (equaveSteps <= 0) throw new Error('MOS equave steps must be positive.')
  const stepSize = valueToCents(equaveSize) / equaveSteps
  const notation = generateNotation(pattern) as { scale: Map<string, MosMonzo> }
  const nominalSteps = new Map<string, number>()
  for (const [nominal, mosMonzo] of notation.scale) {
    nominalSteps.set(nominal, mosMonzo[0] * largeSteps + mosMonzo[1] * smallSteps)
  }

  return {
    pattern,
    equaveSize,
    largeSteps,
    smallSteps,
    stepSize,
    up: stepSize,
    lift: 5 * stepSize,
    chromaSteps: largeSteps - smallSteps,
    nominalSteps,
    equaveSteps,
  }
}

export const mosScaleRatios = (config: MosConfig): number[] =>
  Array.from(config.nominalSteps.values()).map((steps) => centsToValue(steps * config.stepSize))

export const mosScaleLabels = (config: MosConfig): string[] =>
  Array.from(config.nominalSteps.keys())

export const normalizeMosNominal = (
  nominal: string,
  config: MosConfig,
): { key: string; equaves: number } => {
  const key = nominal.toUpperCase()
  if (!config.nominalSteps.has(key)) {
    throw new Error(`Undefined MOS nominal '${nominal}'.`)
  }
  return {
    key,
    equaves: nominal[0] === key[0] ? 0 : 1,
  }
}
