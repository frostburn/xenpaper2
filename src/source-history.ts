import type { SourceHistory } from './types'

const DEFAULT_MAX_HISTORY = 300

export const createSourceHistory = (initialSourceCode: string): SourceHistory => ({
  past: [],
  present: initialSourceCode,
  future: [],
})

export const resetSourceHistory = (
  history: SourceHistory,
  initialSourceCode: string,
): SourceHistory => {
  history.past.length = 0
  history.present = initialSourceCode
  history.future.length = 0

  return history
}

export const canUndoSourceChange = (history: SourceHistory): boolean => history.past.length > 0

export const canRedoSourceChange = (history: SourceHistory): boolean => history.future.length > 0

export const recordSourceChange = (
  history: SourceHistory,
  nextSourceCode: string,
  maxHistory = DEFAULT_MAX_HISTORY,
): SourceHistory => {
  if (nextSourceCode === history.present) return history

  history.past.push(history.present)
  while (history.past.length > maxHistory) history.past.shift()
  history.present = nextSourceCode
  history.future.length = 0

  return history
}

export const undoSourceChange = (
  history: SourceHistory,
  maxHistory = DEFAULT_MAX_HISTORY,
): SourceHistory => {
  if (!canUndoSourceChange(history)) return history

  const previousSourceCode = history.past.pop()!
  history.future.unshift(history.present)
  while (history.future.length > maxHistory) history.future.pop()
  history.present = previousSourceCode

  return history
}

export const redoSourceChange = (
  history: SourceHistory,
  maxHistory = DEFAULT_MAX_HISTORY,
): SourceHistory => {
  if (!canRedoSourceChange(history)) return history

  const nextSourceCode = history.future.shift()!
  history.past.push(history.present)
  while (history.past.length > maxHistory) history.past.shift()
  history.present = nextSourceCode

  return history
}
