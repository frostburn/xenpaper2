const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const EMBED_PREFIX = 'embed:'
const MODERN_SOURCE_PREFIX = 'v2:'
const SOURCE_SEPARATOR = '~'

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

const encodeBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const decodeBase64Url = (encodedValue: string): string => {
  const base64 = encodedValue.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(paddedBase64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

const encodeModernPayload = (value: unknown): string =>
  `${MODERN_SOURCE_PREFIX}${encodeBase64Url(JSON.stringify(value))}`

const decodeModernPayload = (encodedSources: string): unknown | undefined => {
  if (!encodedSources.startsWith(MODERN_SOURCE_PREFIX)) return undefined

  try {
    return JSON.parse(decodeBase64Url(encodedSources.slice(MODERN_SOURCE_PREFIX.length)))
  } catch {
    return undefined
  }
}

const decodeLegacySharedSource = (encodedSource: string): string => {
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

export const encodeSharedSource = (sourceCode: string): string => encodeModernPayload(sourceCode)

export const decodeSharedSource = (encodedSource: string): string => {
  const modernSource = decodeModernPayload(encodedSource)

  return typeof modernSource === 'string' ? modernSource : decodeLegacySharedSource(encodedSource)
}

export const encodeSharedSources = (sourceCodes: string[]): string =>
  encodeModernPayload(normalizeSourceCodes(sourceCodes))

export const decodeSharedSources = (encodedSources: string): string[] => {
  const modernSources = decodeModernPayload(encodedSources)
  if (
    Array.isArray(modernSources) &&
    modernSources.every((sourceCode) => typeof sourceCode === 'string')
  ) {
    return normalizeSourceCodes(modernSources)
  }

  const encodedSourceCodes = encodedSources.split(SOURCE_SEPARATOR)

  return normalizeSourceCodes(encodedSourceCodes.map(decodeLegacySharedSource))
}

export const encodeShareHashForUrl = (hash: string): string =>
  Array.from(hash, (character) => {
    const charCode = character.charCodeAt(0)

    return charCode <= 0x1f || charCode === 0x7f
      ? encodeURIComponent(character).toUpperCase()
      : character
  }).join('')

export const getShareHash = (sourceCode: string | string[]): string =>
  `#${encodeSharedSources(Array.isArray(sourceCode) ? sourceCode : [sourceCode])}`

export const getEmbedShareHash = (sourceCode: string | string[]): string =>
  `#${EMBED_PREFIX}${encodeSharedSources(Array.isArray(sourceCode) ? sourceCode : [sourceCode])}`

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

export const getSavedSourceCodes = (hash: unknown): string[] => {
  if (hasSharedSourceCode(hash)) return getSharedSourceCodes(hash)
  if (!hasBrowserWindow()) return ['']

  const storedSourceCodes = parseStoredSourceCodes(window.localStorage?.getItem('lasttunes'))
  if (storedSourceCodes) return storedSourceCodes

  return ['']
}

export const saveSourceCodes = (sourceCodes: string[]): void => {
  if (!hasBrowserWindow()) return

  const normalizedSourceCodes = normalizeSourceCodes(sourceCodes)
  window.localStorage?.setItem('lasttunes', JSON.stringify(normalizedSourceCodes))
}
