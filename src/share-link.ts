const SPACE_TOKEN = '_'
const ESCAPED_UNDERSCORE = '%_'

const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const EMBED_PREFIX = 'embed:'

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

export const getShareHash = (sourceCode: string): string => `#${encodeSharedSource(sourceCode)}`

export const getEmbedShareHash = (sourceCode: string): string =>
  `#${EMBED_PREFIX}${encodeSharedSource(sourceCode)}`

export const isEmbedHash = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash).startsWith(EMBED_PREFIX)
}

export const hasSharedSourceCode = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash) !== ''
}

export const getSharedSourceCode = (hash: unknown): string => {
  if (!hasSharedSourceCode(hash)) return ''

  return decodeSharedSource(removeEmbedPrefix(removeHashPrefix(hash as string)))
}

export const getSavedSourceCode = (hash: unknown): string => {
  if (hasSharedSourceCode(hash)) return getSharedSourceCode(hash)
  if (!hasBrowserWindow()) return ''

  return window.localStorage?.getItem('lasttune') || ''
}

export const saveSourceCode = (sourceCode: string): void => {
  if (!hasBrowserWindow()) return

  window.localStorage?.setItem('lasttune', sourceCode)
}
