import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  decodeShareHash,
  encodeShareHash,
  getSavedSourceCode,
  getShareUrl,
  replaceShareHash,
} from '../share-link'

describe('share-link', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('round-trips source code through the share hash encoding', () => {
    const sourceCode = '{19edo} 0 1_2 # comment\n(tempo: 140)'

    expect(decodeShareHash(encodeShareHash(sourceCode))).toBe(sourceCode)
  })

  it('uses underscores for spaces while preserving literal underscores', () => {
    const encoded = encodeShareHash('pitch_name with space')

    expect(encoded).toBe('pitch%_name_with_space')
    expect(decodeShareHash(encoded)).toBe('pitch_name with space')
  })

  it('builds a share URL from the current page URL', () => {
    window.history.replaceState(undefined, '', '/xenpaper/?debug=1#old')

    expect(getShareUrl('a b')).toBe(`${window.location.origin}/xenpaper/?debug=1#a_b`)
  })

  it('restores source code from the location hash before local storage', () => {
    window.localStorage.setItem('lasttune', 'stored tune')
    window.history.replaceState(undefined, '', '/#linked_tune')

    expect(getSavedSourceCode()).toBe('linked tune')
  })

  it('updates the URL hash and remembers the latest tune', () => {
    window.history.replaceState(undefined, '', '/')

    replaceShareHash('shared tune')

    expect(window.location.hash).toBe('#shared_tune')
    expect(window.localStorage.getItem('lasttune')).toBe('shared tune')
  })
})
