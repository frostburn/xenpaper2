const SPACE_TOKEN = '_'
const ESCAPED_UNDERSCORE = '%_'

const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const removeHashPrefix = (hash: string): string => (hash.startsWith('#') ? hash.slice(1) : hash)

const restoreSpaces = (value: string): string => value.replace(/(^|[^%])_/g, '$1%20')

export const encodeSharedSource = (sourceCode: string): string =>
  encodeURIComponent(sourceCode).replace(/_/g, ESCAPED_UNDERSCORE).replace(/%20/g, SPACE_TOKEN)

export const decodeSharedSource = (encodedSource: string): string => {
  try {
    return decodeURIComponent(restoreSpaces(encodedSource).replace(/%_/g, SPACE_TOKEN))
  } catch {
    return encodedSource
  }
}

export const getShareHash = (sourceCode: string): string => `#${encodeSharedSource(sourceCode)}`

export const hasSharedSourceCode = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash) !== ''
}

export const getSharedSourceCode = (hash: unknown): string => {
  if (!hasSharedSourceCode(hash)) return ''

  return decodeSharedSource(removeHashPrefix(hash as string))
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
