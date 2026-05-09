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

  it('uses a versioned URL-safe source encoding while supporting legacy underscores', () => {
    const encoded = encodeSharedSource('pitch_name with space')

    expect(encoded).toMatch(/^v2:[A-Za-z0-9_-]+$/u)
    expect(encoded).not.toContain('%_')
    expect(decodeSharedSource(encoded)).toBe('pitch_name with space')
    expect(decodeSharedSource('pitch%_name_with_space')).toBe('pitch_name with space')
  })

  it('builds versioned hash fragments for shared and embedded source code', () => {
    expect(getShareHash('linked tune')).toMatch(/^#v2:[A-Za-z0-9_-]+$/u)
    expect(getShareHash('embed:linked tune')).toMatch(/^#v2:[A-Za-z0-9_-]+$/u)
    expect(getEmbedShareHash('linked tune')).toMatch(/^#embed:v2:[A-Za-z0-9_-]+$/u)
    expect(getShareHash(`"0-\`0-100%`)).toMatch(/^#v2:[A-Za-z0-9_-]+$/u)
    expect(getShareHash(['linked tune'])).toBe(getShareHash('linked tune'))
    expect(getSharedSourceCodes(getShareHash('embed:linked tune'))).toEqual(['embed:linked tune'])
  })

  it('builds and restores multi-source hash fragments in order', () => {
    const sources = ['first tab', 'second:tab with_under', 'third\nline', 'tilde~tab']
    const hash = getShareHash(sources)

    expect(hash).toMatch(/^#v2:[A-Za-z0-9_-]+$/u)
    expect(hash).not.toContain('%_')
    expect(hash).not.toContain('~')
    expect(getSharedSourceCodes(hash)).toEqual(sources)
    expect(
      getSharedSourceCodes('#first_tab~second%3Atab_with%_under~third\nline~tilde%7Etab'),
    ).toEqual(sources)
  })

  it('continues to restore legacy malformed multi-source hashes', () => {
    expect(getSharedSourceCodes('#first~second%_tab~third')).toEqual([
      'first',
      'second_tab',
      'third',
    ])
  })

  it('builds embedded multi-source hash fragments', () => {
    expect(getEmbedShareHash(['one', 'two'])).toMatch(/^#embed:v2:[A-Za-z0-9_-]+$/u)
    expect(isEmbedHash(getEmbedShareHash(['one', 'two']))).toBe(true)
    expect(getSharedSourceCodes(getEmbedShareHash(['one', 'two']))).toEqual(['one', 'two'])
  })

  it('does not split embed source colons into tab fragments', () => {
    const sources = ['10:12:15', '4:5']
    const hash = getEmbedShareHash(sources)

    expect(hash).toMatch(/^#embed:v2:[A-Za-z0-9_-]+$/u)
    expect(getSharedSourceCodes(hash)).toEqual(sources)
    expect(getSharedSourceCodes('#embed:10:12:15~4:5')).toEqual(sources)
  })

  it('encodes control characters before hash fragments are used in absolute URLs', () => {
    const hash = '#0%_2\n4%_5\t6%_7'

    expect(encodeShareHashForUrl(hash)).toBe('#0%_2%0A4%_5%096%_7')
    expect(new URL(encodeShareHashForUrl(hash), 'https://example.test/').hash).toBe(
      '#0%_2%0A4%_5%096%_7',
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
