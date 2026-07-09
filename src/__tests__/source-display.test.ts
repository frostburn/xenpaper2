import { describe, expect, it } from 'vitest'

import { createSourceDisplayTokens } from '../source-display'

describe('source-display', () => {
  it('leaves inserted text unmapped until highlights are regenerated', () => {
    const tokens = createSourceDisplayTokens('abXcd', 'abcd')

    expect(tokens).toMatchObject([
      { type: 'character', character: 'a', index: 0, charDataIndex: 0 },
      { type: 'character', character: 'b', index: 1, charDataIndex: 1 },
      {
        type: 'character',
        key: 'character-pending-2',
        character: 'X',
        index: 2,
        charDataIndex: undefined,
      },
      { type: 'character', key: 'character-2', character: 'c', index: 3, charDataIndex: 2 },
      { type: 'character', key: 'character-3', character: 'd', index: 4, charDataIndex: 3 },
    ])
  })

  it('leaves replaced text unmapped while preserving matching suffix highlights', () => {
    const tokens = createSourceDisplayTokens('abXYef', 'abcdef')

    expect(tokens).toMatchObject([
      { type: 'character', character: 'a', charDataIndex: 0 },
      { type: 'character', character: 'b', charDataIndex: 1 },
      { type: 'character', character: 'X', charDataIndex: undefined },
      { type: 'character', character: 'Y', charDataIndex: undefined },
      { type: 'character', key: 'character-4', character: 'e', charDataIndex: 4 },
      { type: 'character', key: 'character-5', character: 'f', charDataIndex: 5 },
    ])
  })

  it('keys shifted suffix characters by mapped highlight positions', () => {
    const tokens = createSourceDisplayTokens('abXcd', 'abcd')

    expect(tokens.map((token) => token.key)).toEqual([
      'character-0',
      'character-1',
      'character-pending-2',
      'character-2',
      'character-3',
    ])
  })
})
