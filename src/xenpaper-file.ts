import packageJson from '../package.json'

const XENPAPER_FILE_FORMAT = 'xenpaper'
const XENPAPER_FILE_FORMAT_VERSION = 1

export const XENPAPER_FILE_EXTENSION = '.xenpaper.json'
export const XENPAPER_FILE_NAME = `xenpaper-scores${XENPAPER_FILE_EXTENSION}`
export const XENPAPER_FILE_MIME_TYPE = 'application/vnd.xenpaper+json'

export type XenpaperScoreFile = {
  format: typeof XENPAPER_FILE_FORMAT
  version: typeof XENPAPER_FILE_FORMAT_VERSION
  xenpaperVersion: string
  createdAt: string
  scores: XenpaperScoreFileScore[]
}

type XenpaperScoreFileScore = {
  source: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeSourceCodes = (sourceCodes: string[]): string[] =>
  sourceCodes.length ? sourceCodes : ['']

export const createXenpaperScoreFile = (
  sourceCodes: string[],
  createdAt = new Date().toISOString(),
): XenpaperScoreFile => ({
  format: XENPAPER_FILE_FORMAT,
  version: XENPAPER_FILE_FORMAT_VERSION,
  xenpaperVersion: packageJson.version,
  createdAt,
  scores: normalizeSourceCodes(sourceCodes).map((source) => ({ source })),
})

export const serializeXenpaperScoreFile = (sourceCodes: string[]): string =>
  `${JSON.stringify(createXenpaperScoreFile(sourceCodes), null, 2)}\n`

export const parseXenpaperScoreFile = (fileContents: string): string[] => {
  let parsed: unknown

  try {
    parsed = JSON.parse(fileContents)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }

  if (!isRecord(parsed) || parsed.format !== XENPAPER_FILE_FORMAT) {
    throw new Error('The selected file is not a Xenpaper score file.')
  }

  if (parsed.version !== XENPAPER_FILE_FORMAT_VERSION) {
    throw new Error(`Unsupported Xenpaper score file version: ${String(parsed.version)}.`)
  }

  if (!Array.isArray(parsed.scores)) {
    throw new Error('The selected Xenpaper score file does not contain a scores list.')
  }

  const sourceCodes = parsed.scores.map((score) => {
    if (!isRecord(score) || typeof score.source !== 'string') {
      throw new Error('Each score in the selected Xenpaper score file must contain source text.')
    }

    return score.source
  })

  return normalizeSourceCodes(sourceCodes)
}
