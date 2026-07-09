import type { SourceDisplayToken } from './types'

const createCharDataIndexMapper = (source: string, highlightedSource: string) => {
  if (source === highlightedSource) return (index: number): number => index

  let commonPrefixLength = 0
  const shortestLength = Math.min(source.length, highlightedSource.length)

  while (
    commonPrefixLength < shortestLength &&
    source[commonPrefixLength] === highlightedSource[commonPrefixLength]
  ) {
    commonPrefixLength++
  }

  let commonSuffixLength = 0
  while (
    commonSuffixLength < shortestLength - commonPrefixLength &&
    source[source.length - 1 - commonSuffixLength] ===
      highlightedSource[highlightedSource.length - 1 - commonSuffixLength]
  ) {
    commonSuffixLength++
  }

  const changedSourceEnd = source.length - commonSuffixLength
  const changedHighlightedSourceEnd = highlightedSource.length - commonSuffixLength
  const suffixIndexOffset = highlightedSource.length - source.length

  return (index: number): number | undefined => {
    if (index < commonPrefixLength) return index
    if (index >= changedSourceEnd) return index + suffixIndexOffset
    if (index < changedHighlightedSourceEnd && source[index] === highlightedSource[index])
      return index

    return undefined
  }
}

export const createSourceDisplayTokens = (
  source: string,
  highlightedSource = source,
): SourceDisplayToken[] => {
  const sourceCharacters = source.split('')
  const hasPlayStartMarkers = source.includes('\n')
  const tokens: SourceDisplayToken[] = []
  const getCharDataIndex = createCharDataIndexMapper(source, highlightedSource)
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
    const charDataIndex = getCharDataIndex(index)

    tokens.push({
      type: 'character',
      key: `character-${charDataIndex ?? `pending-${index}`}`,
      character,
      index,
      charDataIndex,
    })

    if (hasPlayStartMarkers && character === '\n') addPlayStart()
  })

  return tokens
}

export const getSourceLineAtOffset = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length - 1
