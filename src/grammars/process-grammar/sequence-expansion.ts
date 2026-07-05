import type { SequenceItemsType, TailType } from '../grammar.generated'

import { limit } from './validation'

type RepetitionState = {
  startIndex: number
  repeatCount: number
  repetitionsAdded: number
  firstEndingIndex?: number
  firstEndingSegment?: SequenceItemsType[]
}

export const cloneSequenceItem = <T>(item: T): T => {
  if (Array.isArray(item)) {
    return item.map(cloneSequenceItem) as T
  }

  if (item && typeof item === 'object') {
    return Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, cloneSequenceItem(value)]),
    ) as T
  }

  return item
}

type SequenceItemWithTail = Extract<
  SequenceItemsType,
  { type: 'Note' | 'SampleRateNote' | 'Chord' | 'RatioChord' }
>

const isSequenceItemWithTail = (item: SequenceItemsType): item is SequenceItemWithTail =>
  item.type === 'Note' ||
  item.type === 'SampleRateNote' ||
  item.type === 'Chord' ||
  item.type === 'RatioChord'

const addTail = (item: SequenceItemWithTail, tail: TailType): void => {
  if (!item.tail) {
    item.tail = cloneSequenceItem(tail)
    return
  }

  item.tail = {
    ...item.tail,
    length: item.tail.length + tail.length,
    parts: [...item.tail.parts, ...cloneSequenceItem(tail.parts)],
  }
}

const addTailToLastPlayableItem = (items: SequenceItemsType[], tail: TailType | null): void => {
  if (!tail) return

  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]
    if (!item) continue

    if (item.type === 'Rest') {
      throw new Error('Cannot attach a hold to a rest')
    }

    if (isSequenceItemWithTail(item)) {
      addTail(item, tail)
      return
    }
  }

  throw new Error('Cannot attach a hold without a previous note, sample-rate note, or chord')
}

type MusicalControlInstruction = Extract<SequenceItemsType, { type: 'DaCapo' | 'DalSegno' }>

export const expandMusicalControlFlowItems = (items: SequenceItemsType[]): SequenceItemsType[] => {
  const expandedItems: SequenceItemsType[] = []

  const findIndex = (type: SequenceItemsType['type'], startIndex = 0): number =>
    items.findIndex((item, index) => index >= startIndex && item.type === type)

  const appendClonedRange = (startIndex: number, endIndex: number): void => {
    expandedItems.push(...items.slice(startIndex, endIndex).map(cloneSequenceItem))
  }

  const expandInstruction = (item: MusicalControlInstruction): void => {
    const targetIndex = item.type === 'DaCapo' ? 0 : findIndex('Segno')
    if (targetIndex < 0) {
      throw new Error('D.S. requires a Segno marker')
    }

    if (item.stop === 'fine') {
      const fineIndex = findIndex('Fine', targetIndex)
      appendClonedRange(targetIndex, fineIndex < 0 ? items.length : fineIndex)
      return
    }

    const alCodaIndex = findIndex('AlCoda', targetIndex)
    const codaIndex = findIndex('Coda', alCodaIndex < 0 ? targetIndex : alCodaIndex)
    if (alCodaIndex < 0 || codaIndex < 0) {
      throw new Error(
        `${item.type === 'DaCapo' ? 'D.C.' : 'D.S.'} al Coda requires To Coda and Coda markers`,
      )
    }

    appendClonedRange(targetIndex, alCodaIndex)
    appendClonedRange(codaIndex, items.length)
  }

  for (const item of items) {
    expandedItems.push(item)

    if (item.type === 'DaCapo' || item.type === 'DalSegno') {
      expandInstruction(item)
      break
    }
  }

  return expandedItems
}

export const expandRepeatedSequenceItems = (items: SequenceItemsType[]): SequenceItemsType[] => {
  const expandedItems: SequenceItemsType[] = []
  const repetitionStack: RepetitionState[] = []

  const openRepeat = (
    item: Extract<SequenceItemsType, { type: 'RepeatStart' | 'RepeatEndStart' }>,
  ): void => {
    limit('Repeat count', item.repeatCount, 1, 1000)
    expandedItems.push(item)
    repetitionStack.push({
      startIndex: expandedItems.length,
      repeatCount: item.repeatCount,
      repetitionsAdded: 0,
    })
  }

  const closeRepeat = (
    item: Extract<SequenceItemsType, { type: 'RepeatEnd' | 'RepeatEndStart' }>,
  ): void => {
    const repetitionState = repetitionStack.pop() ?? {
      startIndex: 0,
      repeatCount: 2,
      repetitionsAdded: 0,
    }
    const hasAlternateEnding = item.type === 'RepeatEnd' && item.alternateEnding !== null
    const endIndex =
      hasAlternateEnding && repetitionState.firstEndingIndex !== undefined
        ? repetitionState.firstEndingIndex
        : expandedItems.length
    const repeatCount = hasAlternateEnding
      ? item.alternateEnding! < repetitionState.repeatCount
        ? 1
        : repetitionState.repeatCount - 1 - repetitionState.repetitionsAdded
      : repetitionState.repeatCount - 1
    const segment =
      repetitionState.firstEndingSegment ??
      expandedItems.slice(repetitionState.startIndex, endIndex)
    const repeatedItems = Array.from({ length: repeatCount }).flatMap(() =>
      segment.map(cloneSequenceItem),
    )
    addTailToLastPlayableItem(
      repeatedItems.length ? repeatedItems : expandedItems,
      item.type === 'RepeatEnd' ? item.tail : null,
    )
    expandedItems.push(item, ...repeatedItems)

    if (hasAlternateEnding && item.alternateEnding! < repetitionState.repeatCount) {
      repetitionStack.push({
        ...repetitionState,
        repetitionsAdded: repetitionState.repetitionsAdded + repeatCount,
      })
    }
  }

  items.forEach((item) => {
    if (item.type === 'RepeatStart') {
      openRepeat(item)
      return
    }

    if (item.type === 'RepeatEndStart') {
      closeRepeat(item)
      openRepeat(item)
      return
    }

    if (item.type === 'RepeatEndingStart') {
      const repetitionState = repetitionStack[repetitionStack.length - 1]
      if (item.alternateEnding === 1 && repetitionState) {
        repetitionState.firstEndingIndex = expandedItems.length
        repetitionState.firstEndingSegment = expandedItems
          .slice(repetitionState.startIndex, repetitionState.firstEndingIndex)
          .map(cloneSequenceItem)
      }
      addTailToLastPlayableItem(expandedItems, item.tail)
      expandedItems.push(item)
      return
    }

    if (item.type === 'RepeatEnd') {
      closeRepeat(item)
      return
    }

    expandedItems.push(item)
  })

  if (repetitionStack.length > 0) {
    throw new Error('Unpaired repeat start marker "|:"')
  }

  return expandedItems
}
