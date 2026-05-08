import { describe, expect, it } from 'vitest'

import {
  canRedoSourceChange,
  canUndoSourceChange,
  createSourceHistory,
  recordSourceChange,
  redoSourceChange,
  undoSourceChange,
} from '../source-history'

describe('source-history', () => {
  it('records source changes and walks backward and forward through them', () => {
    let history = createSourceHistory('0 2 4')

    history = recordSourceChange(history, '0 2 4 7')
    history = recordSourceChange(history, '0 2 4 7 12')

    expect(canUndoSourceChange(history)).toBe(true)
    expect(canRedoSourceChange(history)).toBe(false)

    history = undoSourceChange(history)
    expect(history.present).toBe('0 2 4 7')
    expect(canRedoSourceChange(history)).toBe(true)

    history = undoSourceChange(history)
    expect(history.present).toBe('0 2 4')
    expect(canUndoSourceChange(history)).toBe(false)

    history = redoSourceChange(history)
    expect(history.present).toBe('0 2 4 7')

    history = redoSourceChange(history)
    expect(history.present).toBe('0 2 4 7 12')
    expect(canRedoSourceChange(history)).toBe(false)
  })

  it('clears redo entries after a new edit', () => {
    let history = createSourceHistory('0')
    history = recordSourceChange(history, '0 1')
    history = recordSourceChange(history, '0 1 2')
    history = undoSourceChange(history)

    history = recordSourceChange(history, '0 1 3')

    expect(history.present).toBe('0 1 3')
    expect(canRedoSourceChange(history)).toBe(false)
  })

  it('does not record identical source code snapshots', () => {
    const history = createSourceHistory('0')

    expect(recordSourceChange(history, '0')).toBe(history)
  })

  it('respects the configured history limit', () => {
    let history = createSourceHistory('0')

    history = recordSourceChange(history, '1', 2)
    history = recordSourceChange(history, '2', 2)
    history = recordSourceChange(history, '3', 2)

    expect(history.past).toEqual(['1', '2'])
  })
})
