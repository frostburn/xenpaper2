import { afterEach, describe, expect, it } from 'vitest'

import {
  decodeSharedSource,
  encodeSharedSource,
  getSavedSourceCode,
  getSharedSourceCode,
  hasSharedSourceCode,
  saveSourceCode,
  SHARE_QUERY_KEY,
} from '../share-link'

describe('share-link', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('uses the tune query key for shared source code', () => {
    expect(SHARE_QUERY_KEY).toBe('tune')
  })

  it('round-trips source code through the shared source encoding', () => {
    const sourceCode = '{19edo} 0 1_2 # comment\n(tempo: 140)'

    expect(decodeSharedSource(encodeSharedSource(sourceCode))).toBe(sourceCode)
  })

  it('uses underscores for spaces while preserving literal underscores', () => {
    const encoded = encodeSharedSource('pitch_name with space')

    expect(encoded).toBe('pitch%_name_with_space')
    expect(decodeSharedSource(encoded)).toBe('pitch_name with space')
  })

  it('restores source code from a query value before local storage', () => {
    window.localStorage.setItem('lasttune', 'stored tune')

    expect(getSavedSourceCode('linked_tune')).toBe('linked tune')
  })

  it('uses the first query value if Vue Router provides an array', () => {
    expect(getSharedSourceCode(['linked_tune', 'other_tune'])).toBe('linked tune')
  })

  it('treats an empty query value as shared empty source code', () => {
    window.localStorage.setItem('lasttune', 'stored tune')

    expect(hasSharedSourceCode('')).toBe(true)
    expect(getSavedSourceCode('')).toBe('')
  })

  it('falls back to local storage when there is no shared query value', () => {
    window.localStorage.setItem('lasttune', 'stored tune')

    expect(getSavedSourceCode(undefined)).toBe('stored tune')
  })

  it('remembers the latest tune without touching URL hash state', () => {
    saveSourceCode('shared tune')

    expect(window.localStorage.getItem('lasttune')).toBe('shared tune')
  })
})
