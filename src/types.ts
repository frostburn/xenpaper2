import type { XenpaperAST } from './grammars/grammar.generated'
import type { CharData } from './grammars/grammar-to-chars'
import type { InitialRulerState } from './grammars/process-grammar'
import type { MoscScoreMs } from './mosc'

export type SourceDisplayToken =
  | {
      type: 'playStart'
      key: string
      line: number
    }
  | {
      type: 'character'
      key: string
      character: string
      index: number
    }

export type SourceTab = {
  id: number
  title: string
  active: boolean
  alive: boolean
  muted: boolean
  soloed: boolean
}

export type SourceHistory = {
  past: string[]
  present: string
  future: string[]
}

export type SidebarMode = 'info' | 'share' | 'ruler' | 'none'

export type OpenSidebarMode = Exclude<SidebarMode, 'none'>

type ParsedSourceBase = {
  chars: CharData[]
  error: string
}

export type ParseFailedSource = ParsedSourceBase & {
  playable: false
}

export type ProcessedSource = ParsedSourceBase & {
  ast: XenpaperAST
  initialRulerState: InitialRulerState
}

export type UnplayableProcessedSource = ProcessedSource & {
  playable: false
}

export type PlayableParsedSource = ProcessedSource & {
  playable: true
  scoreMs: MoscScoreMs
}

export type ParsedSource = ParseFailedSource | UnplayableProcessedSource | PlayableParsedSource
