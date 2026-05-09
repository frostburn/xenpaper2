const SPACE_TOKEN = '_'
const ESCAPED_UNDERSCORE = '%_'

const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const EMBED_PREFIX = 'embed:'
const SOURCE_SEPARATOR = '~'
const ESCAPED_SOURCE_SEPARATOR = '%7E'

const removeHashPrefix = (hash: string): string => (hash.startsWith('#') ? hash.slice(1) : hash)

const removeEmbedPrefix = (hash: string): string =>
  hash.startsWith(EMBED_PREFIX) ? hash.slice(EMBED_PREFIX.length) : hash

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

export const encodeSharedSource = (sourceCode: string): string =>
  sourceCode
    .replace(/%/g, '%25')
    .replace(/:/g, '%3A')
    .replace(/_/g, ESCAPED_UNDERSCORE)
    .replace(/ /g, SPACE_TOKEN)

export const decodeSharedSource = (encodedSource: string): string => {
  const percentPlaceholder = '\0percent\0'
  const underscorePlaceholder = '\0underscore\0'
  let restoredSource = encodedSource
    .replace(/%25/g, percentPlaceholder)
    .replace(/%_/g, underscorePlaceholder)

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

const encodeSharedSourceForMultiSourceHash = (sourceCode: string): string =>
  encodeSharedSource(sourceCode).replace(/~/g, ESCAPED_SOURCE_SEPARATOR)

export const encodeSharedSources = (sourceCodes: string[]): string => {
  const normalizedSourceCodes = normalizeSourceCodes(sourceCodes)

  return normalizedSourceCodes.length === 1
    ? encodeSharedSource(normalizedSourceCodes[0] ?? '')
    : normalizedSourceCodes.map(encodeSharedSourceForMultiSourceHash).join(SOURCE_SEPARATOR)
}

export const decodeSharedSources = (encodedSources: string): string[] => {
  const encodedSourceCodes = encodedSources.split(SOURCE_SEPARATOR)

  return normalizeSourceCodes(encodedSourceCodes.map(decodeSharedSource))
}

export const encodeShareHashForUrl = (hash: string): string =>
  Array.from(hash, (character) => {
    const charCode = character.charCodeAt(0)

    return charCode <= 0x1f || charCode === 0x7f
      ? encodeURIComponent(character).toUpperCase()
      : character
  }).join('')

export const getShareHash = (sourceCode: string | string[]): string =>
  `#${Array.isArray(sourceCode) ? encodeSharedSources(sourceCode) : encodeSharedSource(sourceCode)}`

export const getEmbedShareHash = (sourceCode: string | string[]): string =>
  `#${EMBED_PREFIX}${Array.isArray(sourceCode) ? encodeSharedSources(sourceCode) : encodeSharedSource(sourceCode)}`

export const isEmbedHash = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash).startsWith(EMBED_PREFIX)
}

export const hasSharedSourceCode = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash) !== ''
}

export const getSharedSourceCodes = (hash: unknown): string[] => {
  if (!hasSharedSourceCode(hash)) return ['']

  return decodeSharedSources(removeEmbedPrefix(removeHashPrefix(hash as string)))
}

export const getSharedSourceCode = (hash: unknown): string => getSharedSourceCodes(hash)[0] ?? ''

export const getSavedSourceCodes = (hash: unknown): string[] => {
  if (hasSharedSourceCode(hash)) return getSharedSourceCodes(hash)
  if (!hasBrowserWindow()) return ['']

  const storedSourceCodes = parseStoredSourceCodes(window.localStorage?.getItem('lasttunes'))
  if (storedSourceCodes) return storedSourceCodes

  return [window.localStorage?.getItem('lasttune') || '']
}

export const getSavedSourceCode = (hash: unknown): string => getSavedSourceCodes(hash)[0] ?? ''

export const saveSourceCodes = (sourceCodes: string[]): void => {
  if (!hasBrowserWindow()) return

  const normalizedSourceCodes = normalizeSourceCodes(sourceCodes)
  window.localStorage?.setItem('lasttunes', JSON.stringify(normalizedSourceCodes))
  window.localStorage?.setItem('lasttune', normalizedSourceCodes[0] ?? '')
}

export const saveSourceCode = (sourceCode: string): void => {
  saveSourceCodes([sourceCode])
}
