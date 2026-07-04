import { afterEach, describe, expect, it } from 'vitest'

import {
  decodeSharedSource,
  encodeShareHashForUrl,
  encodeSharedSource,
  getSavedSourceCodes,
  getShareHash,
  getSharedSourceCodes,
  hasSharedSourceCode,
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

    expect(encoded).toBe('.pitch.uname_with_space')
    expect(decodeSharedSource(encoded)).toBe('pitch_name with space')
  })

  it('builds hash fragments for shared source code', () => {
    expect(getShareHash('linked tune')).toBe('#.linked_tune')
    expect(getShareHash('embed:linked tune')).toBe('#.embed.clinked_tune')
    expect(getShareHash('[1 2 3]-')).toBe('#.[1_2_3]-')
    expect(getShareHash(`"0-\`0-100%`)).toBe('#."0-`0-100.p')
    expect(getShareHash(['linked tune'])).toBe('#.linked_tune')
  })

  it('builds and restores multi-source hash fragments in order', () => {
    const sources = ['first tab', 'second:tab with_under', 'third\nline', 'tilde~tab']
    const hash = getShareHash(sources)

    expect(hash).toBe('#.first_tab~.second.ctab_with.uunder~.third\nline~.tilde.ttab')
    expect(getSharedSourceCodes(hash)).toEqual(sources)
  })

  it('round-trips ASCII alternate endings in share links', () => {
    const source = '|: 0 |(^1) 1 :|(^2) 2'
    const hash = getShareHash(source)

    expect(hash).toBe('#.|.c_0_|(^1)_1_.c|(^2)_2')
    expect(getSharedSourceCodes(hash)).toEqual([source])
    expect(new URL(encodeShareHashForUrl(hash), 'https://example.test/').hash).toBe(
      '#.|.c_0_|(^1)_1_.c|(^2)_2',
    )
  })

  it('escapes literal tildes in single-source share links', () => {
    const source = 'literal~tilde'
    const hash = getShareHash(source)

    expect(hash).toBe('#.literal.ttilde')
    expect(getSharedSourceCodes(hash)).toEqual([source])
  })

  it('keeps unescaped source tildes in one shared source', () => {
    const source = '# This should ~work~ too\n{12edo} ~[9/8 4/3] ~/6::3'

    expect(
      getSharedSourceCodes('#%23_This_should_~work~_too%0A{12edo}_~[9/8_4/3]_~/6%3A%3A3'),
    ).toEqual([source])
    expect(getSharedSourceCodes('#{12edo}_~9/8_~4/3_~3/2_~2/1')).toEqual([
      '{12edo} ~9/8 ~4/3 ~3/2 ~2/1',
    ])
  })

  it('encodes MediaWiki-unfriendly brackets before hash fragments are used in absolute URLs', () => {
    const hash = getShareHash('[1 2 3]-')

    expect(encodeShareHashForUrl(hash)).toBe('#.%5B1_2_3%5D-')
    expect(new URL(encodeShareHashForUrl(hash), 'https://example.test/').hash).toBe(
      '#.%5B1_2_3%5D-',
    )
  })

  it('encodes control characters before hash fragments are used in absolute URLs', () => {
    const hash = getShareHash('0_2\n4_5\t6_7')

    expect(encodeShareHashForUrl(hash)).toBe('#.0.u2%0A4.u5%096.u7')
    expect(new URL(encodeShareHashForUrl(hash), 'https://example.test/').hash).toBe(
      '#.0.u2%0A4.u5%096.u7',
    )
  })

  it('treats embed-prefixed text as normal shared source code', () => {
    expect(getSharedSourceCodes('#.embed.clinked_tune')).toEqual(['embed:linked tune'])
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
