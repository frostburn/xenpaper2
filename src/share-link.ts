const ENCODED_SPACE_TOKEN = '_'
const MODERN_SOURCE_PREFIX = '.'

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

const MODERN_SOURCE_ESCAPES: Record<string, string> = {
  [MODERN_SOURCE_PREFIX]: '..',
  '%': '.p',
  ':': '.c',
  [SOURCE_SEPARATOR]: '.t',
  _: '.u',
  ' ': ENCODED_SPACE_TOKEN,
}

const MODERN_SOURCE_UNESCAPES: Record<string, string> = {
  [MODERN_SOURCE_PREFIX]: MODERN_SOURCE_PREFIX,
  p: '%',
  c: ':',
  t: SOURCE_SEPARATOR,
  u: '_',
}

export const encodeSharedSource = (sourceCode: string): string =>
  `${MODERN_SOURCE_PREFIX}${sourceCode.replace(/[.%:~_ ]/g, (character) => MODERN_SOURCE_ESCAPES[character] ?? character)}`

const decodeModernSharedSource = (encodedSource: string): string => {
  let restoredSource = ''

  for (let index = MODERN_SOURCE_PREFIX.length; index < encodedSource.length; index += 1) {
    const character = encodedSource[index]

    if (character === ENCODED_SPACE_TOKEN) {
      restoredSource += ' '
      continue
    }

    if (character !== MODERN_SOURCE_PREFIX) {
      restoredSource += character
      continue
    }

    const escapedCharacter = encodedSource[index + 1]
    const unescapedCharacter = MODERN_SOURCE_UNESCAPES[escapedCharacter ?? '']

    if (unescapedCharacter === undefined) {
      restoredSource += character
      continue
    }

    restoredSource += unescapedCharacter
    index += 1
  }

  return restoredSource
}

const decodeLegacySharedSource = (encodedSource: string): string => {
  const percentPlaceholder = '\0percent\0'
  const underscorePlaceholder = '\0underscore\0'
  let restoredSource = encodedSource
    .replace(/%25/g, percentPlaceholder)
    .replace(/%_/g, underscorePlaceholder) // Old URLs use an illegal URI scheme
    .replace(/ /g, underscorePlaceholder) // Say hi to Vue Router
    .replace(/%20/g, underscorePlaceholder)

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
}

export const decodeSharedSource = (encodedSource: string): string =>
  encodedSource.startsWith(MODERN_SOURCE_PREFIX)
    ? decodeModernSharedSource(encodedSource)
    : decodeLegacySharedSource(encodedSource)

export const encodeSharedSources = (sourceCodes: string[]): string => {
  const normalizedSourceCodes = normalizeSourceCodes(sourceCodes)

  return normalizedSourceCodes.length === 1
    ? encodeSharedSource(normalizedSourceCodes[0] ?? '')
    : normalizedSourceCodes.map(encodeSharedSource).join(SOURCE_SEPARATOR)
}

const isEncodedWhitespace = (character: string | undefined): boolean =>
  character !== undefined && /[\s_]/.test(character)

const splitLegacyEncodedSources = (encodedSources: string): string[] => {
  const encodedSourceCodes: string[] = []
  let sourceStartIndex = 0

  for (let index = 0; index < encodedSources.length; index += 1) {
    const previousCharacter = encodedSources[index - 1]
    const nextCharacter = encodedSources[index + 1]
    const isSourceTilde =
      previousCharacter === undefined ||
      isEncodedWhitespace(previousCharacter) ||
      isEncodedWhitespace(nextCharacter)

    if (encodedSources[index] !== SOURCE_SEPARATOR || isSourceTilde) {
      continue
    }

    encodedSourceCodes.push(encodedSources.slice(sourceStartIndex, index))
    sourceStartIndex = index + SOURCE_SEPARATOR.length
  }

  encodedSourceCodes.push(encodedSources.slice(sourceStartIndex))

  return encodedSourceCodes
}

export const decodeSharedSources = (encodedSources: string): string[] => {
  const encodedSourceCodes = encodedSources.startsWith(MODERN_SOURCE_PREFIX)
    ? encodedSources.split(SOURCE_SEPARATOR)
    : splitLegacyEncodedSources(encodedSources)

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
