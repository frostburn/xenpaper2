const SPACE_TOKEN = '_'
const ESCAPED_UNDERSCORE = '%_'

const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const restoreSpaces = (value: string): string => value.replace(/(^|[^%])_/g, '$1%20')

export const encodeShareHash = (sourceCode: string): string =>
  encodeURIComponent(sourceCode).replace(/_/g, ESCAPED_UNDERSCORE).replace(/%20/g, SPACE_TOKEN)

export const decodeShareHash = (hash: string): string => {
  const hashWithoutPrefix = hash.startsWith('#') ? hash.slice(1) : hash

  try {
    return decodeURIComponent(restoreSpaces(hashWithoutPrefix).replace(/%_/g, SPACE_TOKEN))
  } catch {
    return hashWithoutPrefix
  }
}

export const getSharedSourceFromLocation = (): string => {
  if (!hasBrowserWindow()) return ''

  return decodeShareHash(window.location.hash)
}

export const getSavedSourceCode = (): string => {
  if (!hasBrowserWindow()) return ''

  return getSharedSourceFromLocation() || window.localStorage?.getItem('lasttune') || ''
}

export const getShareUrl = (sourceCode: string): string => {
  if (!hasBrowserWindow()) return ''

  const url = new URL(window.location.href)
  url.hash = encodeShareHash(sourceCode)
  return url.toString()
}

export const replaceShareHash = (sourceCode: string): void => {
  if (!hasBrowserWindow()) return

  const encodedHash = encodeShareHash(sourceCode)
  const nextUrl = new URL(window.location.href)
  nextUrl.hash = encodedHash

  if (window.location.href !== nextUrl.toString()) {
    window.history.replaceState(undefined, '', nextUrl)
  }

  window.localStorage?.setItem('lasttune', sourceCode)
}
