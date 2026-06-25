import { generateNotation, stepString, type MosMonzo } from 'moment-of-symmetry'
import { valueToCents } from 'xen-dev-utils/conversion'

import type { MosExpressionValueType } from './grammar.generated'

type MosMode = { up: number; down: number; period: number | null }

export type MosConfig = {
  pattern: string
  equaveSize: number
  sizeOfLargeStep: number
  sizeOfSmallStep: number
  stepSize: number
  up: number
  lift: number
  chromaSteps: number
  nominalSteps: Map<string, number>
  equaveSteps: number
}

export const mosExpressionPrecedence = (expression: MosExpressionValueType): number => {
  switch (expression.type) {
    case 'MosRationalEquave':
    case 'MosHardnessDeclaration':
    case 'MosMode':
      return 1
    default:
      return 0
  }
}

export const mosStepPattern = (
  countLarge: number,
  countSmall: number,
  mode: MosMode | null,
): string => {
  if (countLarge + countSmall <= 0) throw new Error('MOS size must be positive.')
  return stepString(countLarge, countSmall, mode ? { up: mode.up, down: mode.down } : undefined)
}

export const createMosConfig = (expressions: MosExpressionValueType[]): MosConfig => {
  let pattern: string | null = null
  let countLarge: number | null = null
  let countSmall: number | null = null
  let integerPattern: number[] | null = null
  let equaveSize = 2
  let sizeOfLargeStep: number | null = null
  let sizeOfSmallStep: number | null = null
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
        sizeOfSmallStep = Math.min(...expression.pattern)
        sizeOfLargeStep = Math.max(...expression.pattern)
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
    }
  }

  if (!pattern && countLarge !== null && countSmall !== null) {
    pattern = mosStepPattern(countLarge, countSmall, mode)
  }
  if (!pattern) throw new Error('MOS declaration requires a pattern.')

  const actualCountLarge = (pattern.match(/L/g) ?? []).length
  const actualCountSmall = pattern.length - actualCountLarge
  if (sizeOfLargeStep === null || sizeOfSmallStep === null) {
    if (hardness === null) {
      hardness = integerPattern
        ? { numerator: Math.max(...integerPattern), denominator: Math.min(...integerPattern) }
        : { numerator: 2, denominator: 1 }
    }
    if (sizeOfLargeStep !== null) {
      sizeOfSmallStep = (sizeOfLargeStep * hardness.denominator) / hardness.numerator
    } else if (sizeOfSmallStep !== null) {
      sizeOfLargeStep = (sizeOfSmallStep * hardness.numerator) / hardness.denominator
    } else {
      sizeOfLargeStep = hardness.numerator
      sizeOfSmallStep = hardness.denominator
    }
  }

  const equaveSteps = actualCountLarge * sizeOfLargeStep + actualCountSmall * sizeOfSmallStep
  if (equaveSteps <= 0) throw new Error('MOS equave steps must be positive.')
  const stepSize = valueToCents(equaveSize) / equaveSteps
  const notation = generateNotation(pattern) as { scale: Map<string, MosMonzo> }
  const nominalSteps = new Map<string, number>()
  for (const [nominal, mosMonzo] of notation.scale) {
    nominalSteps.set(nominal, mosMonzo[0] * sizeOfLargeStep + mosMonzo[1] * sizeOfSmallStep)
  }

  return {
    pattern,
    equaveSize,
    sizeOfLargeStep,
    sizeOfSmallStep,
    stepSize,
    up: stepSize,
    lift: 5 * stepSize,
    chromaSteps: sizeOfLargeStep - sizeOfSmallStep,
    nominalSteps,
    equaveSteps,
  }
}

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
