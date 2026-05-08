import { afterEach, describe, expect, it } from 'vitest'

import {
  decodeSharedSource,
  encodeSharedSource,
  getSavedSourceCode,
  getShareHash,
  getSharedSourceCode,
  hasSharedSourceCode,
  saveSourceCode,
} from '../share-link'

describe('share-link', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('round-trips source code through the shared source encoding', () => {
    const sourceCode = '{19edo} 0 1_2 # comment\n(tempo: 140) 100% done'

    expect(decodeSharedSource(encodeSharedSource(sourceCode))).toBe(sourceCode)
  })

  it('decodes router-normalized punctuation from earlier double-encoded share URLs', () => {
    const sourceCode = `0-3-'0-'3-"0-'"0-\`0-\`\`0-`
    const legacyHash = "#0-3-'0-'3-%220-'%220-%600-%60%600-"

    expect(getSharedSourceCode(legacyHash)).toBe(sourceCode)
  })

  it('uses underscores for spaces while preserving literal underscores', () => {
    const encoded = encodeSharedSource('pitch_name with space')

    expect(encoded).toBe('pitch%_name_with_space')
    expect(decodeSharedSource(encoded)).toBe('pitch_name with space')
  })

  it('builds a hash fragment for shared source code', () => {
    expect(getShareHash('linked tune')).toBe('#linked_tune')
    expect(getShareHash(`"0-\`0-100%`)).toBe('#"0-`0-100%25')
  })

  it('restores source code from a route hash before local storage', () => {
    window.localStorage.setItem('lasttune', 'stored tune')

    expect(getSavedSourceCode('#linked_tune')).toBe('linked tune')
  })

  it('restores source code from a route hash without a leading hash prefix', () => {
    expect(getSharedSourceCode('linked_tune')).toBe('linked tune')
  })

  it('preserves literal percent-encoded text in new hash fragments', () => {
    expect(getSharedSourceCode('%2522_and_%2560')).toBe('%22 and %60')
  })

  it('falls back to local storage when there is no shared hash value', () => {
    window.localStorage.setItem('lasttune', 'stored tune')

    expect(hasSharedSourceCode('')).toBe(false)
    expect(getSavedSourceCode('')).toBe('stored tune')
  })

  it('remembers the latest tune without touching URL hash state', () => {
    saveSourceCode('shared tune')

    expect(window.localStorage.getItem('lasttune')).toBe('shared tune')
  })
})
