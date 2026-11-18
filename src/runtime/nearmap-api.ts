export type CoverageErrorReason = 'invalidKey' | 'notAuthorised' | 'noCoverage' | 'network'

export class CoverageError extends Error {
  reason: CoverageErrorReason
  constructor (reason: CoverageErrorReason) {
    super(reason)
    this.reason = reason
  }
}

interface NearmapSurvey {
  captureDate: string
  resources?: { tiles?: Array<{ type?: string }> }
}

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
export const lonToTileX = (lon: number, zoom: number): number =>
  Math.floor(((lon + 180) / 360) * Math.pow(2, zoom))

export const latToTileY = (lat: number, zoom: number): number => {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom))
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/** Capture dates (YYYY-MM-DD) for the coverage tile, newest first and without duplicates. */
export async function fetchCaptureDates (options: {
  coverageUrl: string
  apiKey: string
  zoom: number
  x: number
  y: number
  tileType: string
  signal: AbortSignal
}): Promise<string[]> {
  const { coverageUrl, apiKey, zoom, x, y, tileType, signal } = options
  const url = `${trimSlash(coverageUrl)}/${zoom}/${x}/${y}?apikey=${encodeURIComponent(apiKey)}&limit=500`

  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new CoverageError('network')
  }

  const body = await response.json().catch(() => null)
  const message = typeof body?.error === 'string' ? body.error.toLowerCase() : ''
  if (response.status === 401 || message.includes('key')) throw new CoverageError('invalidKey')
  if (response.status === 403 || message.includes('authori')) throw new CoverageError('notAuthorised')
  if (!response.ok || !Array.isArray(body?.surveys)) throw new CoverageError('network')

  const dates = (body.surveys as NearmapSurvey[])
    // Older responses have no resources list, so keep those surveys.
    .filter(s => !s.resources?.tiles || s.resources.tiles.some(t => t.type === tileType))
    .map(s => s.captureDate)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
  const unique = Array.from(new Set(dates)).sort((a, b) => (a < b ? 1 : -1))
  if (unique.length === 0) throw new CoverageError('noCoverage')
  return unique
}

/** `until` returns the newest imagery captured on or before the date, so gaps fill with older captures. */
export const tileUrlTemplate = (tileUrl: string, tileType: string, apiKey: string, date: string): string =>
  `${trimSlash(tileUrl)}/${tileType}/{level}/{col}/{row}.img?apikey=${encodeURIComponent(apiKey)}&until=${date}`

/** The date in `dates` closest in time to `date`; used to keep a similar capture when the list changes. */
export const nearestDate = (dates: string[], date: string | null): string | null => {
  if (dates.length === 0) return null
  if (!date) return dates[0]
  if (dates.includes(date)) return date
  const target = Date.parse(date)
  return dates.reduce((best, d) => (Math.abs(Date.parse(d) - target) < Math.abs(Date.parse(best) - target) ? d : best), dates[0])
}

const parseUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const formatDate = (date: string, locale: string, options: Intl.DateTimeFormatOptions): string => {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(parseUtc(date))
  } catch {
    return date
  }
}
