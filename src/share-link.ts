const ENCODED_SPACE_TOKEN = '_'
const ENCODED_UNDERSCORE_TOKEN = '%20'
const ENCODED_TILDE_TOKEN = '%1E'

const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const SOURCE_SEPARATOR = '~'

const removeHashPrefix = (hash: string): string => (hash.startsWith('#') ? hash.slice(1) : hash)

const normalizeSourceCodes = (sourceCodes: string[]): string[] =>
  sourceCodes.length ? sourceCodes : ['']

const parseStoredSourceCodes = (storedSourceCodes: string | null): string[] | undefined => {
  if (!storedSourceCodes) return undefined

  try {
    const parsedSourceCodes = JSON.parse(storedSourceCodes)

    return Array.isArray(parsedSourceCodes) &&
      parsedSourceCodes.every((sourceCode) => typeof sourceCode === 'string')
      ? normalizeSourceCodes(parsedSourceCodes)
      : undefined
  } catch {
    return undefined
  }
}

const SHARED_SOURCE_ESCAPES: Record<string, string> = {
  '%': '%25',
  ':': '%3A',
  [SOURCE_SEPARATOR]: ENCODED_TILDE_TOKEN,
  _: ENCODED_UNDERSCORE_TOKEN,
  ' ': ENCODED_SPACE_TOKEN,
}

export const encodeSharedSource = (sourceCode: string): string =>
  sourceCode.replace(/[%:~_ ]/g, (character) => SHARED_SOURCE_ESCAPES[character] ?? character)

export const decodeSharedSource = (encodedSource: string): string => {
  const percentPlaceholder = '\0percent\0'
  const underscorePlaceholder = '\0underscore\0'
  const tildePlaceholder = '\0tilde\0'
  let restoredSource = encodedSource
    .replace(/%25/g, percentPlaceholder)
    .replace(/%_/g, underscorePlaceholder) // Old URLs use an illegal URI scheme
    .replace(/ /g, underscorePlaceholder) // Say hi to Vue Router
    .replace(/%20/g, underscorePlaceholder)
    .replace(/%1E/gi, tildePlaceholder)

  try {
    restoredSource = decodeURIComponent(restoredSource)
  } catch {
    // If the hash contains a literal malformed percent sequence, leave it as-is.
  }

  return restoredSource
    .replace(/_/g, ' ')
    .split(percentPlaceholder)
    .join('%')
    .split(underscorePlaceholder)
    .join('_')
    .split(tildePlaceholder)
    .join(SOURCE_SEPARATOR)
}

export const encodeSharedSources = (sourceCodes: string[]): string => {
  const normalizedSourceCodes = normalizeSourceCodes(sourceCodes)

  return normalizedSourceCodes.length === 1
    ? encodeSharedSource(normalizedSourceCodes[0] ?? '')
    : normalizedSourceCodes.map(encodeSharedSource).join(SOURCE_SEPARATOR)
}

export const decodeSharedSources = (encodedSources: string): string[] => {
  const encodedSourceCodes = encodedSources.split(SOURCE_SEPARATOR)

  return normalizeSourceCodes(encodedSourceCodes.map(decodeSharedSource))
}

export const encodeShareHashForUrl = (hash: string): string =>
  Array.from(hash, (character) => {
    const charCode = character.charCodeAt(0)

    return charCode <= 0x1f || charCode === 0x7f || character === '[' || character === ']'
      ? encodeURIComponent(character).toUpperCase()
      : character
  }).join('')

export const getShareHash = (sourceCode: string | string[]): string =>
  `#${Array.isArray(sourceCode) ? encodeSharedSources(sourceCode) : encodeSharedSource(sourceCode)}`

export const hasSharedSourceCode = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash) !== ''
}

export const getSharedSourceCodes = (hash: unknown): string[] => {
  if (!hasSharedSourceCode(hash)) return ['']

  return decodeSharedSources(removeHashPrefix(hash as string))
}

export const getSavedSourceCodes = (hash: unknown): string[] => {
  if (hasSharedSourceCode(hash)) return getSharedSourceCodes(hash)
  if (!hasBrowserWindow()) return ['']

  try {
    const storedSourceCodes = parseStoredSourceCodes(window.localStorage?.getItem('lasttunes'))
    if (storedSourceCodes) return storedSourceCodes
  } catch {
    // Local storage access may throw SecurityError in some contexts
    console.warn('Failed to load previous tune')
  }

  return ['']
}

export const saveSourceCodes = (sourceCodes: string[]): void => {
  if (!hasBrowserWindow()) return

  const normalizedSourceCodes = normalizeSourceCodes(sourceCodes)
  try {
    window.localStorage?.setItem('lasttunes', JSON.stringify(normalizedSourceCodes))
  } catch {
    // Local storage access may throw SecurityError in some contexts
    console.warn('Failed to save current tune')
  }
}
