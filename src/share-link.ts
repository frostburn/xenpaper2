export const SHARE_QUERY_KEY = 'tune'

const SPACE_TOKEN = '_'
const ESCAPED_UNDERSCORE = '%_'

const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const getFirstQueryValue = (queryValue: unknown): string => {
  if (Array.isArray(queryValue)) return getFirstQueryValue(queryValue[0])
  return typeof queryValue === 'string' ? queryValue : ''
}

export const hasSharedSourceCode = (queryValue: unknown): boolean => {
  if (Array.isArray(queryValue)) return queryValue.some(hasSharedSourceCode)
  return queryValue !== undefined
}

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

export const getSharedSourceCode = (queryValue: unknown): string => {
  const encodedSource = getFirstQueryValue(queryValue)
  return encodedSource ? decodeSharedSource(encodedSource) : ''
}

export const getSavedSourceCode = (queryValue: unknown): string => {
  if (hasSharedSourceCode(queryValue)) return getSharedSourceCode(queryValue)
  if (!hasBrowserWindow()) return ''

  return window.localStorage?.getItem('lasttune') || ''
}

export const saveSourceCode = (sourceCode: string): void => {
  if (!hasBrowserWindow()) return

  window.localStorage?.setItem('lasttune', sourceCode)
}
