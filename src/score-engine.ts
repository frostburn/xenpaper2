import type { CharData } from './grammars/grammar-to-chars'
import { SoundEngine, type MoscNoteMs } from './mosc'
import {
  canRedoSourceChange,
  canUndoSourceChange,
  createSourceHistory,
  recordSourceChange,
  redoSourceChange,
  undoSourceChange,
} from './source-history'
import type { ParsedSource, SourceHistory } from './types'
import { getMsAtLine, parseAndProcessSourceCode } from './utils'

export class ScoreEngine {
  sourceHistory: SourceHistory
  parsedSource: ParsedSource
  scoreLoaded = false

  private sourceVersion = 0

  constructor(
    private readonly soundEngine: SoundEngine,
    initialSourceCode = '',
  ) {
    this.sourceHistory = createSourceHistory(initialSourceCode)
    this.parsedSource = parseAndProcessSourceCode(initialSourceCode)
  }

  get sourceCode(): string {
    return this.sourceHistory.present
  }

  get chars(): CharData[] {
    return this.parsedSource.chars
  }

  get lastError(): string {
    return this.parsedSource.error
  }

  get canUndoSourceCode(): boolean {
    return canUndoSourceChange(this.sourceHistory)
  }

  get canRedoSourceCode(): boolean {
    return canRedoSourceChange(this.sourceHistory)
  }

  getLineStartMs(line: number): number {
    return getMsAtLine(this.sourceCode, this.chars, line)
  }

  setSourceCode(source: string, recordHistory = true): boolean {
    if (source === this.sourceCode) return false

    this.sourceHistory = recordHistory
      ? recordSourceChange(this.sourceHistory, source)
      : createSourceHistory(source)
    this.sourceVersion++
    this.parsedSource = parseAndProcessSourceCode(this.sourceCode)
    this.scoreLoaded = false
    return true
  }

  resetSourceCode(source: string): void {
    this.sourceHistory = createSourceHistory(source)
    this.sourceVersion++
    this.parsedSource = parseAndProcessSourceCode(this.sourceCode)
    this.scoreLoaded = false
  }

  undoSourceCode(): void {
    const nextHistory = undoSourceChange(this.sourceHistory)
    if (nextHistory === this.sourceHistory) return

    this.sourceHistory = nextHistory
    this.sourceVersion++
    this.parsedSource = parseAndProcessSourceCode(this.sourceCode)
    this.scoreLoaded = false
  }

  redoSourceCode(): void {
    const nextHistory = redoSourceChange(this.sourceHistory)
    if (nextHistory === this.sourceHistory) return

    this.sourceHistory = nextHistory
    this.sourceVersion++
    this.parsedSource = parseAndProcessSourceCode(this.sourceCode)
    this.scoreLoaded = false
  }

  async updateParsedSourceCode(loopActive: boolean): Promise<boolean> {
    const version = this.sourceVersion
    const source = this.parsedSource

    if (!source.playable) {
      this.scoreLoaded = false
      return false
    }

    await this.soundEngine.setScore(source.scoreMs)
    if (version !== this.sourceVersion) return false

    this.soundEngine.setLoopActive(loopActive)
    await this.soundEngine.gotoMs(0)
    if (version !== this.sourceVersion) return false

    this.scoreLoaded = true
    return true
  }

  async preparePlayableScore(loopActive: boolean): Promise<boolean> {
    if (!this.scoreLoaded || this.position() >= this.endPosition()) {
      await this.updateParsedSourceCode(loopActive)
    }

    return this.scoreLoaded
  }

  async restartPlaybackFromLine(line: number, loopActive: boolean): Promise<boolean> {
    if (!(await this.preparePlayableScore(loopActive))) return false

    await this.gotoMs(this.getLineStartMs(line))
    await this.play()
    return true
  }

  playing(): boolean {
    return this.soundEngine.playing()
  }

  position(): number {
    return this.soundEngine.position()
  }

  endPosition(): number {
    return this.soundEngine.endPosition()
  }

  async play(): Promise<void> {
    await this.soundEngine.play()
  }

  async pause(): Promise<void> {
    await this.soundEngine.pause()
  }

  async gotoMs(ms: number): Promise<void> {
    await this.soundEngine.gotoMs(ms)
  }

  setLoopActive(active: boolean): void {
    this.soundEngine.setLoopActive(active)
  }

  setLoopStart(line: number): void {
    this.soundEngine.setLoopStart(this.getLineStartMs(line))
  }

  onEnd(callback: () => void): () => void {
    return this.soundEngine.onEnd(callback)
  }

  onNote(callback: (note: MoscNoteMs, on: boolean) => void): () => void {
    return this.soundEngine.onNote(callback)
  }
}
