import { afterEach, describe, expect, it } from 'vitest'

import {
  decodeSharedSource,
  encodeShareHashForUrl,
  encodeSharedSource,
  getEmbedShareHash,
  getSavedSourceCode,
  getSavedSourceCodes,
  getShareHash,
  getSharedSourceCode,
  getSharedSourceCodes,
  hasSharedSourceCode,
  isEmbedHash,
  saveSourceCode,
  saveSourceCodes,
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

  it('builds hash fragments for shared and embedded source code', () => {
    expect(getShareHash('linked tune')).toBe('#linked_tune')
    expect(getShareHash('embed:linked tune')).toBe('#embed%3Alinked_tune')
    expect(getEmbedShareHash('linked tune')).toBe('#embed:linked_tune')
    expect(getShareHash(`"0-\`0-100%`)).toBe('#"0-`0-100%25')
  })

  it('builds and restores multi-source hash fragments in order', () => {
    const sources = ['first tab', 'second:tab with_under', 'third\nline']
    const hash = getShareHash(sources)

    expect(hash).toBe('#tabs:first_tab:second%3Atab_with%_under:third\nline')
    expect(getSharedSourceCodes(hash)).toEqual(sources)
    expect(getSharedSourceCode(hash)).toBe('first tab')
  })

  it('builds embedded multi-source hash fragments', () => {
    expect(getEmbedShareHash(['one', 'two'])).toBe('#embed:tabs:one:two')
    expect(isEmbedHash(getEmbedShareHash(['one', 'two']))).toBe(true)
    expect(getSharedSourceCodes(getEmbedShareHash(['one', 'two']))).toEqual(['one', 'two'])
  })

  it('encodes control characters before hash fragments are used in absolute URLs', () => {
    const hash = getShareHash('0_2\n4_5\t6_7')

    expect(encodeShareHashForUrl(hash)).toBe('#0%_2%0A4%_5%096%_7')
    expect(new URL(encodeShareHashForUrl(hash), 'https://example.test/').hash).toBe(
      '#0%_2%0A4%_5%096%_7',
    )
  })

  it('detects embed hashes and restores their source code', () => {
    expect(isEmbedHash('#embed:linked_tune')).toBe(true)
    expect(isEmbedHash(getShareHash('embed:linked tune'))).toBe(false)
    expect(isEmbedHash('#linked_tune')).toBe(false)
    expect(getSharedSourceCode('#embed:linked_tune')).toBe('linked tune')
    expect(getSharedSourceCode(getShareHash('embed:linked tune'))).toBe('embed:linked tune')
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
    expect(getSavedSourceCodes('')).toEqual(['stored tune'])
  })

  it('remembers the latest tune without touching URL hash state', () => {
    saveSourceCode('shared tune')

    expect(window.localStorage.getItem('lasttune')).toBe('shared tune')
    expect(getSavedSourceCodes('')).toEqual(['shared tune'])
  })

  it('remembers multiple latest tunes in browser storage', () => {
    saveSourceCodes(['first tune', 'second tune'])

    expect(window.localStorage.getItem('lasttune')).toBe('first tune')
    expect(getSavedSourceCodes('')).toEqual(['first tune', 'second tune'])
  })
})
