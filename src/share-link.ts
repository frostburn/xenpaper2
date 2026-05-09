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

const LZW_FIRST_DICTIONARY_CODE = 256
const LZW_MAX_DICTIONARY_CODE = 0xffff

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

const compressBinaryString = (value: string): Uint16Array => {
  if (!value) return new Uint16Array()

  const dictionary = new Map<string, number>()
  const codes: number[] = []
  let nextCode = LZW_FIRST_DICTIONARY_CODE
  let phrase = value[0]!

  for (let index = 1; index < value.length; index++) {
    const character = value[index]!
    const combinedPhrase = phrase + character

    if (dictionary.has(combinedPhrase)) {
      phrase = combinedPhrase
      continue
    }

    codes.push(phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase)!)
    if (nextCode <= LZW_MAX_DICTIONARY_CODE) {
      dictionary.set(combinedPhrase, nextCode++)
    }
    phrase = character
  }

  codes.push(phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase)!)

  return Uint16Array.from(codes)
}

const decompressBinaryString = (codes: Uint16Array): string => {
  if (!codes.length) return ''

  const dictionary = new Map<number, string>()
  let nextCode = LZW_FIRST_DICTIONARY_CODE
  let previousPhrase = String.fromCharCode(codes[0]!)
  let result = previousPhrase

  for (let index = 1; index < codes.length; index++) {
    const code = codes[index]!
    let phrase = code < LZW_FIRST_DICTIONARY_CODE ? String.fromCharCode(code) : dictionary.get(code)

    if (phrase === undefined) {
      if (code !== nextCode) throw new Error('Invalid compressed share payload')
      phrase = previousPhrase + previousPhrase[0]!
    }

    result += phrase
    if (nextCode <= LZW_MAX_DICTIONARY_CODE) {
      dictionary.set(nextCode++, previousPhrase + phrase[0]!)
    }
    previousPhrase = phrase
  }

  return result
}

const codesToBytes = (codes: Uint16Array): Uint8Array => {
  const bytes = new Uint8Array(codes.length * 2)
  codes.forEach((code, index) => {
    bytes[index * 2] = code >> 8
    bytes[index * 2 + 1] = code & 0xff
  })

  return bytes
}

const bytesToCodes = (bytes: Uint8Array): Uint16Array => {
  if (bytes.length % 2 !== 0) throw new Error('Invalid compressed share payload length')

  const codes = new Uint16Array(bytes.length / 2)
  codes.forEach((_, index) => {
    codes[index] = (bytes[index * 2]! << 8) | bytes[index * 2 + 1]!
  })

  return codes
}

const compressString = (value: string): Uint8Array =>
  codesToBytes(compressBinaryString(bytesToBinaryString(new TextEncoder().encode(value))))

const decompressString = (bytes: Uint8Array): string => {
  const decompressedBytes = binaryStringToBytes(decompressBinaryString(bytesToCodes(bytes)))

  return new TextDecoder().decode(decompressedBytes)
}

const encodeModernPayload = (value: unknown): string =>
  `${MODERN_SOURCE_PREFIX}${encodeBase64Url(compressString(JSON.stringify(value)))}`

const decodeModernPayload = (encodedSources: string): unknown | undefined => {
  if (!encodedSources.startsWith(MODERN_SOURCE_PREFIX)) return undefined

  try {
    const payload = decodeBase64Url(encodedSources.slice(MODERN_SOURCE_PREFIX.length))

    try {
      return JSON.parse(decompressString(payload))
    } catch {
      // Keep decoding the uncompressed v2 format from pre-compression builds.
      return JSON.parse(new TextDecoder().decode(payload))
    }
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
