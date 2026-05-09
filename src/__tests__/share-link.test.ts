import { afterEach, describe, expect, it } from 'vitest'

import {
  decodeSharedSource,
  encodeShareHashForUrl,
  encodeSharedSource,
  getEmbedShareHash,
  getSavedSourceCodes,
  getShareHash,
  getSharedSourceCodes,
  hasSharedSourceCode,
  isEmbedHash,
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

    expect(getSharedSourceCodes(legacyHash)).toEqual([sourceCode])
  })

  it('uses underscores for spaces while preserving literal underscores', () => {
    const encoded = encodeSharedSource('pitch_name with space')

    expect(encoded).toBe('pitch%20name_with_space')
    expect(decodeSharedSource(encoded)).toBe('pitch_name with space')
  })

  it('builds hash fragments for shared and embedded source code', () => {
    expect(getShareHash('linked tune')).toBe('#linked_tune')
    expect(getShareHash('embed:linked tune')).toBe('#embed%3Alinked_tune')
    expect(getEmbedShareHash('linked tune')).toBe('#embed:linked_tune')
    expect(getShareHash(`"0-\`0-100%`)).toBe('#"0-`0-100%25')
    expect(getShareHash(['linked tune'])).toBe('#linked_tune')
  })

  it('builds and restores multi-source hash fragments in order', () => {
    const sources = ['first tab', 'second:tab with_under', 'third\nline', 'tilde~tab']
    const hash = getShareHash(sources)

    expect(hash).toBe('#first_tab~second%3Atab_with%20under~third\nline~tilde%7Etab')
    expect(getSharedSourceCodes(hash)).toEqual(sources)
  })

  it('builds embedded multi-source hash fragments', () => {
    expect(getEmbedShareHash(['one', 'two'])).toBe('#embed:one~two')
    expect(isEmbedHash(getEmbedShareHash(['one', 'two']))).toBe(true)
    expect(getSharedSourceCodes(getEmbedShareHash(['one', 'two']))).toEqual(['one', 'two'])
  })

  it('does not split embed source colons into tab fragments', () => {
    const sources = ['10:12:15', '4:5']
    const hash = getEmbedShareHash(sources)

    expect(hash).toBe('#embed:10%3A12%3A15~4%3A5')
    expect(getSharedSourceCodes(hash)).toEqual(sources)
    expect(getSharedSourceCodes('#embed:10:12:15~4:5')).toEqual(sources)
  })

  it('encodes control characters before hash fragments are used in absolute URLs', () => {
    const hash = getShareHash('0_2\n4_5\t6_7')

    expect(encodeShareHashForUrl(hash)).toBe('#0%202%0A4%205%096%207')
    expect(new URL(encodeShareHashForUrl(hash), 'https://example.test/').hash).toBe(
      '#0%202%0A4%205%096%207',
    )
  })

  it('detects embed hashes and restores their source code', () => {
    expect(isEmbedHash('#embed:linked_tune')).toBe(true)
    expect(isEmbedHash(getShareHash('embed:linked tune'))).toBe(false)
    expect(isEmbedHash('#linked_tune')).toBe(false)
    expect(getSharedSourceCodes('#embed:linked_tune')).toEqual(['linked tune'])
    expect(getSharedSourceCodes(getShareHash('embed:linked tune'))).toEqual(['embed:linked tune'])
  })

  it('restores source code from a route hash without a leading hash prefix', () => {
    expect(getSharedSourceCodes('linked_tune')).toEqual(['linked tune'])
  })

  it('preserves literal percent-encoded text in new hash fragments', () => {
    expect(getSharedSourceCodes('%2522_and_%2560')).toEqual(['%22 and %60'])
  })

  it('falls back to local storage when there is no shared hash value', () => {
    window.localStorage.setItem('lasttunes', JSON.stringify(['stored tune']))

    expect(hasSharedSourceCode('')).toBe(false)
    expect(getSavedSourceCodes('')).toEqual(['stored tune'])
  })

  it('remembers multiple latest tunes in browser storage', () => {
    saveSourceCodes(['first tune', 'second tune'])

    expect(getSavedSourceCodes('')).toEqual(['first tune', 'second tune'])
  })
})
