import { describe, expect, it } from 'vitest'

import packageJson from '../../package.json'

import {
  createXenpaperScoreFile,
  parseXenpaperScoreFile,
  serializeXenpaperScoreFile,
  XENPAPER_FILE_EXTENSION,
  XENPAPER_FILE_NAME,
} from '../xenpaper-file'

describe('xenpaper-file', () => {
  it('creates a versioned multi-score file', () => {
    const file = createXenpaperScoreFile(
      ['first score', 'second score'],
      '2026-05-10T00:00:00.000Z',
    )

    expect(file).toEqual({
      format: 'xenpaper',
      version: 1,
      xenpaperVersion: packageJson.version,
      createdAt: '2026-05-10T00:00:00.000Z',
      scores: [{ source: 'first score' }, { source: 'second score' }],
    })
    expect(XENPAPER_FILE_EXTENSION).toBe('.xenpaper.json')
    expect(XENPAPER_FILE_NAME).toBe('xenpaper-scores.xenpaper.json')
  })

  it('serializes and parses all score sources in order', () => {
    const sources = ['{19edo}\n0 2 4', 'second tab with % and _']

    expect(parseXenpaperScoreFile(serializeXenpaperScoreFile(sources))).toEqual(sources)
  })

  it('normalizes empty score lists to one blank score', () => {
    expect(parseXenpaperScoreFile(serializeXenpaperScoreFile([]))).toEqual([''])
    expect(
      parseXenpaperScoreFile(JSON.stringify({ format: 'xenpaper', version: 1, scores: [] })),
    ).toEqual([''])
  })

  it('rejects unsupported or malformed files', () => {
    expect(() => parseXenpaperScoreFile('not json')).toThrow('not valid JSON')
    expect(() =>
      parseXenpaperScoreFile(JSON.stringify({ format: 'other', version: 1, scores: [] })),
    ).toThrow('not a Xenpaper score file')
    expect(() =>
      parseXenpaperScoreFile(JSON.stringify({ format: 'xenpaper', version: 2, scores: [] })),
    ).toThrow('Unsupported Xenpaper score file version: 2.')
    expect(() =>
      parseXenpaperScoreFile(JSON.stringify({ format: 'xenpaper', version: 1, scores: [{}] })),
    ).toThrow('must contain source text')
  })
})
