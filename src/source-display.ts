import type { SourceDisplayToken } from './types'

export const createSourceDisplayTokens = (source: string): SourceDisplayToken[] => {
  const sourceCharacters = source.split('')
  const hasPlayStartMarkers = source.includes('\n')
  const tokens: SourceDisplayToken[] = []
  let playStartLine = 0

  const addPlayStart = (): void => {
    tokens.push({
      type: 'playStart',
      key: `play-start-${playStartLine}`,
      line: playStartLine,
    })
    playStartLine++
  }

  if (hasPlayStartMarkers) addPlayStart()

  sourceCharacters.forEach((character, index) => {
    tokens.push({
      type: 'character',
      key: `character-${index}`,
      character,
      index,
    })

    if (hasPlayStartMarkers && character === '\n') addPlayStart()
  })

  return tokens
}

export const getSourceLineAtOffset = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length - 1
