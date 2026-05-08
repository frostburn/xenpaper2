export type SourceHistory = {
  past: string[]
  present: string
  future: string[]
}

const DEFAULT_MAX_HISTORY = 300

export const createSourceHistory = (initialSourceCode: string): SourceHistory => ({
  past: [],
  present: initialSourceCode,
  future: [],
})

export const canUndoSourceChange = (history: SourceHistory): boolean => history.past.length > 0

export const canRedoSourceChange = (history: SourceHistory): boolean => history.future.length > 0

export const recordSourceChange = (
  history: SourceHistory,
  nextSourceCode: string,
  maxHistory = DEFAULT_MAX_HISTORY,
): SourceHistory => {
  if (nextSourceCode === history.present) return history

  return {
    past: [...history.past, history.present].slice(-maxHistory),
    present: nextSourceCode,
    future: [],
  }
}

export const undoSourceChange = (
  history: SourceHistory,
  maxHistory = DEFAULT_MAX_HISTORY,
): SourceHistory => {
  if (!canUndoSourceChange(history)) return history

  const previousSourceCode = history.past[history.past.length - 1]!

  return {
    past: history.past.slice(0, -1),
    present: previousSourceCode,
    future: [history.present, ...history.future].slice(0, maxHistory),
  }
}

export const redoSourceChange = (
  history: SourceHistory,
  maxHistory = DEFAULT_MAX_HISTORY,
): SourceHistory => {
  if (!canRedoSourceChange(history)) return history

  const [nextSourceCode, ...future] = history.future as [string, ...string[]]

  return {
    past: [...history.past, history.present].slice(-maxHistory),
    present: nextSourceCode,
    future: future.slice(0, maxHistory),
  }
}
