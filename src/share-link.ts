const hasBrowserWindow = (): boolean => typeof window !== 'undefined'

const EMBED_PREFIX = 'embed:'
const MODERN_SOURCE_PREFIX = 'v2:'
const SOURCE_SEPARATOR = '~'
const COMPRESSION_FORMAT = 'gzip'

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

const bytesToBinaryString = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return binary
}

const binaryStringToBytes = (binary: string): Uint8Array =>
  Uint8Array.from(binary, (character) => character.charCodeAt(0))

const encodeBase64Url = (bytes: Uint8Array): string =>
  btoa(bytesToBinaryString(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const decodeBase64Url = (encodedValue: string): Uint8Array => {
  const base64 = encodedValue.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')

  return binaryStringToBytes(atob(paddedBase64))
}

const transformBytes = async (
  bytes: Uint8Array,
  transformer: CompressionStream | DecompressionStream,
): Promise<Uint8Array> => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  }).pipeThrough(transformer as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  const transformedBuffer = await new Response(stream).arrayBuffer()

  return new Uint8Array(transformedBuffer)
}

const compressString = async (value: string): Promise<Uint8Array> =>
  transformBytes(new TextEncoder().encode(value), new CompressionStream(COMPRESSION_FORMAT))

const decompressString = async (bytes: Uint8Array): Promise<string> => {
  const decompressedBytes = await transformBytes(bytes, new DecompressionStream(COMPRESSION_FORMAT))

  return new TextDecoder().decode(decompressedBytes)
}

const encodeModernPayload = async (value: unknown): Promise<string> =>
  `${MODERN_SOURCE_PREFIX}${encodeBase64Url(await compressString(JSON.stringify(value)))}`

const decodeModernPayload = async (encodedSources: string): Promise<unknown | undefined> => {
  if (!encodedSources.startsWith(MODERN_SOURCE_PREFIX)) return undefined

  try {
    const payload = decodeBase64Url(encodedSources.slice(MODERN_SOURCE_PREFIX.length))

    return JSON.parse(await decompressString(payload))
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

export const encodeSharedSource = (sourceCode: string): Promise<string> =>
  encodeModernPayload(sourceCode)

export const decodeSharedSource = async (encodedSource: string): Promise<string> => {
  const modernSource = await decodeModernPayload(encodedSource)

  return typeof modernSource === 'string' ? modernSource : decodeLegacySharedSource(encodedSource)
}

export const encodeSharedSources = (sourceCodes: string[]): Promise<string> =>
  encodeModernPayload(normalizeSourceCodes(sourceCodes))

export const decodeSharedSources = async (encodedSources: string): Promise<string[]> => {
  const modernSources = await decodeModernPayload(encodedSources)
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

export const getShareHash = async (sourceCode: string | string[]): Promise<string> =>
  `#${await encodeSharedSources(Array.isArray(sourceCode) ? sourceCode : [sourceCode])}`

export const getEmbedShareHash = async (sourceCode: string | string[]): Promise<string> =>
  `#${EMBED_PREFIX}${await encodeSharedSources(Array.isArray(sourceCode) ? sourceCode : [sourceCode])}`

export const isEmbedHash = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash).startsWith(EMBED_PREFIX)
}

export const hasSharedSourceCode = (hash: unknown): boolean => {
  return typeof hash === 'string' && removeHashPrefix(hash) !== ''
}

export const getSharedSourceCodes = async (hash: unknown): Promise<string[]> => {
  if (!hasSharedSourceCode(hash)) return ['']

  return decodeSharedSources(removeEmbedPrefix(removeHashPrefix(hash as string)))
}

export const getSavedSourceCodes = async (hash: unknown): Promise<string[]> => {
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
