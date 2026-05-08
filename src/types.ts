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

export type SourceHistory = {
  past: string[]
  present: string
  future: string[]
}

export type SidebarMode = 'info' | 'share' | 'ruler' | 'none'

export type OpenSidebarMode = Exclude<SidebarMode, 'none'>

export type ParsedSource = {
  ast?: XenpaperAST
  chars: CharData[]
  error: string
  playable: boolean
  initialRulerState?: InitialRulerState
  scoreMs?: MoscScoreMs
}
