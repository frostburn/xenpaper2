const SPACE_TOKEN = '_'
const ESCAPED_UNDERSCORE = '%_'

const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const EMBED_PREFIX = 'embed:'
const SOURCE_CODE_SEPARATOR = '::'
const LAST_TUNE_KEY = 'lasttune'

const normalizeSourceCodes = (sourceCodes: readonly string[]): string[] =>
  sourceCodes.length > 0 ? [...sourceCodes] : ['']

const removeHashPrefix = (hash: string): string => (hash.startsWith('#') ? hash.slice(1) : hash)

const removeEmbedPrefix = (hash: string): string =>
  hash.startsWith(EMBED_PREFIX) ? hash.slice(EMBED_PREFIX.length) : hash

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

export const encodeShareHashForUrl = (hash: string): string =>
  Array.from(hash, (character) => {
    const charCode = character.charCodeAt(0)

    return charCode <= 0x1f || charCode === 0x7f
      ? encodeURIComponent(character).toUpperCase()
      : character
  }).join('')

export const encodeSharedSourceCodes = (sourceCodes: readonly string[]): string =>
  normalizeSourceCodes(sourceCodes).map(encodeSharedSource).join(SOURCE_CODE_SEPARATOR)

export const decodeSharedSourceCodes = (encodedSources: string): string[] =>
  encodedSources.split(SOURCE_CODE_SEPARATOR).map(decodeSharedSource)

export const getShareHash = (sourceCode: string | readonly string[]): string =>
  `#${typeof sourceCode === 'string' ? encodeSharedSource(sourceCode) : encodeSharedSourceCodes(sourceCode)}`

export const getEmbedShareHash = (sourceCode: string | readonly string[]): string =>
  `#${EMBED_PREFIX}${
    typeof sourceCode === 'string'
      ? encodeSharedSource(sourceCode)
      : encodeSharedSourceCodes(sourceCode)
  }`

export const isEmbedHash = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash).startsWith(EMBED_PREFIX)
}

export const hasSharedSourceCode = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash) !== ''
}

export const getSharedSourceCodes = (hash: unknown): string[] => {
  if (!hasSharedSourceCode(hash)) return ['']

  return decodeSharedSourceCodes(removeEmbedPrefix(removeHashPrefix(hash as string)))
}

export const getSharedSourceCode = (hash: unknown): string => getSharedSourceCodes(hash)[0] || ''

export const getSavedSourceCodes = (hash: unknown): string[] => {
  if (hasSharedSourceCode(hash)) return getSharedSourceCodes(hash)
  if (!hasBrowserWindow()) return ['']

  const saved = window.localStorage?.getItem(LAST_TUNE_KEY) || ''
  return hasSharedSourceCode(saved) ? getSharedSourceCodes(saved) : [saved]
}

export const getSavedSourceCode = (hash: unknown): string => getSavedSourceCodes(hash)[0] || ''

export const saveSourceCodes = (sourceCodes: readonly string[]): void => {
  if (!hasBrowserWindow()) return

  window.localStorage?.setItem(LAST_TUNE_KEY, encodeSharedSourceCodes(sourceCodes))
}

export const saveSourceCode = (sourceCode: string): void => {
  if (!hasBrowserWindow()) return

  window.localStorage?.setItem(LAST_TUNE_KEY, sourceCode)
}
