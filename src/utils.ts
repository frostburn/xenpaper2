import { parse } from './grammars/grammar.generated.js'
import { grammarToChars, type CharData } from './grammars/grammar-to-chars'
import { processGrammar } from './grammars/process-grammar'
import { scoreToTime } from './mosc'
import type { DemoTune, ParsedSource } from './types'

const DEFAULT_DOCUMENT_TITLE = 'Xenpaper 2'
const TITLE_SOURCE_LIMIT = 20
export const APP_BASE_URL = new URL(
  import.meta.env.BASE_URL,
  window?.location?.href ?? 'http://localhost/',
)

type ParseErrorLocation = {
  start?: {
    offset?: number
    line?: number
    column?: number
  }
}

type ParseError = Error & {
  location?: ParseErrorLocation
}

export const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false

  const platform = navigator.platform.toLowerCase()
  return (
    platform.includes('mac') ||
    platform.includes('iphone') ||
    platform.includes('ipad') ||
    platform.includes('ipod')
  )
}

export const getKeyboardModifierKeyLabel = (): 'Command' | 'Ctrl' =>
  isApplePlatform() ? 'Command' : 'Ctrl'

export const formatDemoTune = (tune: DemoTune): string =>
  Array.isArray(tune)
    ? tune.map((source, index) => `# Tab ${index + 1}\n${source}`).join('\n\n')
    : tune

export const escapeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#039;')

export const createHtmlTitle = (source: string): string => {
  if (source.length === 0) return DEFAULT_DOCUMENT_TITLE

  return source.length > TITLE_SOURCE_LIMIT
    ? `${DEFAULT_DOCUMENT_TITLE}: ${source.slice(0, TITLE_SOURCE_LIMIT)}...`
    : `${DEFAULT_DOCUMENT_TITLE}: ${source}`
}

const findOffsetFromLineColumn = (
  source: string,
  line: number,
  column: number,
): number | undefined => {
  let currentLine = 1
  let currentColumn = 1

  for (let offset = 0; offset < source.length; offset++) {
    if (currentLine === line && currentColumn === column) return offset

    if (source[offset] === '\n') {
      currentLine++
      currentColumn = 1
    } else {
      currentColumn++
    }
  }

  return currentLine === line && currentColumn === column ? source.length : undefined
}

const getErrorOffset = (source: string, error: unknown): number | undefined => {
  const parseError = error as Partial<ParseError>
  const start = parseError.location?.start

  if (typeof start?.offset === 'number') return start.offset
  if (typeof start?.line === 'number' && typeof start?.column === 'number') {
    return findOffsetFromLineColumn(source, start.line, start.column)
  }

  const match = error instanceof Error ? error.message.match(/(\d+):(\d+)/) : undefined
  if (!match) return undefined

  return findOffsetFromLineColumn(source, Number(match[1]), Number(match[2]))
}

export const parseAndProcessSourceCode = (source: string): ParsedSource => {
  try {
    const ast = parse(source, { grammarSource: 'source-code' })
    const { score, initialRulerState } = processGrammar(ast)
    const chars = grammarToChars(ast)

    return {
      ast,
      chars,
      error: '',
      playable: true,
      initialRulerState,
      score: scoreToTime(score),
    }
  } catch (error) {
    const chars: CharData[] = []
    const offset = getErrorOffset(source, error)

    if (typeof offset === 'number') {
      chars[offset] = { color: 'error' }
    }

    return {
      chars,
      error: error instanceof Error ? error.message : 'Unable to parse Xenpaper 2 source code.',
      playable: false,
    }
  }
}

export const getTimeAtLine = (
  source: string,
  charData: CharData[] | undefined,
  line: number,
): number => {
  if (line === 0) return 0

  let time = 0
  let counted = 0
  const sourceCharacters = source.split('')

  for (let i = 0; i < sourceCharacters.length; i++) {
    const character = sourceCharacters[i]
    const characterData = charData?.[i]
    const characterPlayTimes =
      characterData?.playTimes ?? (characterData?.playTime ? [characterData.playTime] : [])
    const latestEnd = Math.max(...characterPlayTimes.map(([, end]) => end))

    if (Number.isFinite(latestEnd)) time = latestEnd

    if (character === '\n') {
      counted++
      if (counted === line) return time
    }
  }

  return 0
}

export const copyText = async (text: string): Promise<boolean> => {
  if (!text) return false

  const writeClipboardText = navigator.clipboard?.writeText

  if (writeClipboardText) {
    try {
      await writeClipboardText.call(navigator.clipboard, text)
      return true
    } catch {
      // Fall back for browsers that do not expose Clipboard API outside secure contexts.
    }
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.append(textArea)
  textArea.select()
  const copied = document.execCommand('copy')
  textArea.remove()
  return copied
}
