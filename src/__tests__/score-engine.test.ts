import { describe, expect, it, vi } from 'vitest'

import { SoundEngine, type MoscScoreMs } from '../mosc'
import { ScoreEngine } from '../score-engine'

class TestSoundEngine extends SoundEngine {
  currentPosition = 0
  endMs = 1000
  playingState = false
  loopActive = false

  override playing = vi.fn<() => boolean>(() => this.playingState)
  override position = vi.fn<() => number>(() => this.currentPosition)
  override endPosition = vi.fn<() => number>(() => this.endMs)
  override play = vi.fn<() => Promise<void>>(async () => {
    this.playingState = true
  })
  override pause = vi.fn<() => Promise<void>>(async () => {
    this.playingState = false
  })
  override gotoMs = vi.fn<(ms: number) => Promise<void>>(async (ms: number) => {
    this.currentPosition = ms
  })
  override setLoopActive = vi.fn<(active: boolean) => void>((active: boolean) => {
    this.loopActive = active
  })
  override setLoopStart = vi.fn<(ms?: number) => void>()
  override setScore = vi.fn<(scoreMs: MoscScoreMs) => Promise<void>>(
    async (scoreMs: MoscScoreMs) => {
      this.endMs = scoreMs.lengthMs
    },
  )
}

describe('ScoreEngine', () => {
  it('maintains undo and redo history for source changes', () => {
    const scoreEngine = new ScoreEngine(new TestSoundEngine(), '0 2')

    scoreEngine.setSourceCode('0 2\n4 5')
    scoreEngine.setSourceCode('0 2\n4 5\n7 9')

    expect(scoreEngine.sourceCode).toBe('0 2\n4 5\n7 9')
    expect(scoreEngine.canUndoSourceCode).toBe(true)
    expect(scoreEngine.canRedoSourceCode).toBe(false)

    scoreEngine.undoSourceCode()

    expect(scoreEngine.sourceCode).toBe('0 2\n4 5')
    expect(scoreEngine.canRedoSourceCode).toBe(true)

    scoreEngine.redoSourceCode()

    expect(scoreEngine.sourceCode).toBe('0 2\n4 5\n7 9')
  })

  it('resets source history when loading a source without recording history', () => {
    const scoreEngine = new ScoreEngine(new TestSoundEngine(), '0 2')

    scoreEngine.setSourceCode('0 2\n4 5')
    scoreEngine.resetSourceCode('7 9')

    expect(scoreEngine.sourceCode).toBe('7 9')
    expect(scoreEngine.canUndoSourceCode).toBe(false)
    expect(scoreEngine.canRedoSourceCode).toBe(false)
  })

  it('loads playable source into the sound engine and starts playback from source lines', async () => {
    const soundEngine = new TestSoundEngine()
    const scoreEngine = new ScoreEngine(soundEngine, '0 2\n4 5')

    const didStart = await scoreEngine.restartPlaybackFromLine(1, true)

    expect(didStart).toBe(true)
    expect(soundEngine.setScore).toHaveBeenCalledTimes(1)
    expect(soundEngine.setLoopActive).toHaveBeenCalledWith(true)
    expect(soundEngine.gotoMs).toHaveBeenCalledWith(500)
    expect(soundEngine.play).toHaveBeenCalledTimes(1)
    expect(scoreEngine.scoreLoaded).toBe(true)
  })

  it('does not load invalid source into the sound engine', async () => {
    const soundEngine = new TestSoundEngine()
    const scoreEngine = new ScoreEngine(soundEngine, 'not valid source')

    const didStart = await scoreEngine.restartPlaybackFromLine(0, false)

    expect(didStart).toBe(false)
    expect(soundEngine.setScore).not.toHaveBeenCalled()
    expect(scoreEngine.scoreLoaded).toBe(false)
  })
})
