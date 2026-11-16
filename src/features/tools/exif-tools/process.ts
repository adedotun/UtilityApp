import type { ImageEngine, ImageFormat } from '../image/engine'

export interface PhotoDataEntry { label: string; value: string }

export interface PhotoDataReport {
  entries: PhotoDataEntry[]
  /** GPS coordinates as numbers, for display as text. Never sent anywhere; no map is loaded. */
  gps: { latitude: number; longitude: number } | null
  /** Short phrases describing what was found, used in the removal summary. */
  found: string[]
  hasMetadata: boolean
}

export function isPng(data: Uint8Array): boolean {
  return data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
}

export function isJpeg(data: Uint8Array): boolean {
  return data.length > 2 && data[0] === 0xff && data[1] === 0xd8
}

async function inflateText(bytes: Uint8Array): Promise<string | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
    const buf = await new Response(stream).arrayBuffer()
    return new TextDecoder().decode(buf)
  } catch {
    return null
  }
}

/**
 * Reads the text chunks stored in a PNG (tEXt, zTXt, iTXt). Cameras and
 * editors hide descriptions, software names and sometimes much more in
 * these; they are part of the file's hidden data, so the report lists them.
 */
export async function pngTextChunks(data: Uint8Array): Promise<{ keyword: string; value: string }[]> {
  const chunks: { keyword: string; value: string }[] = []
  const latin1 = new TextDecoder('latin1')
  let offset = 8
  while (offset + 12 <= data.length) {
    const length = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0)
    const type = latin1.decode(data.slice(offset + 4, offset + 8))
    const body = data.slice(offset + 8, offset + 8 + length)
    if (type === 'IEND') break
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const nul = body.indexOf(0)
      if (nul > 0) {
        const keyword = latin1.decode(body.slice(0, nul))
        if (type === 'tEXt') {
          chunks.push({ keyword, value: latin1.decode(body.slice(nul + 1)) })
        } else if (type === 'zTXt') {
          const text = await inflateText(body.slice(nul + 2))
          chunks.push({ keyword, value: text ?? '(compressed text that could not be read)' })
        } else {
          // iTXt: keyword, compression flag, compression method, language, translated keyword, then text.
          const flag = body[nul + 1]
          let p = nul + 3
          const langEnd = body.indexOf(0, p)
          p = langEnd + 1
          const transEnd = body.indexOf(0, p)
          const rawText = body.slice(transEnd + 1)
          const text = flag === 1 ? await inflateText(rawText) : new TextDecoder().decode(rawText)
          chunks.push({ keyword, value: text ?? '(compressed text that could not be read)' })
        }
      }
    }
    offset += 12 + length
  }
  return chunks
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/**
 * Normalises a raw recorded date/time string for display, without ever
 * converting it: EXIF writes "2024:03:15 10:30:00" (colons in the date
 * part), XMP writes ISO style ("2024-03-15T10:30:00"). Both become
 * "2024-03-15 10:30:00" — the same wall-clock time, only the separators
 * change. Anything else is shown as recorded.
 */
function recordedDateText(value: unknown): string | null {
  const text = asText(value)
  if (!text) return null
  const exif = text.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/)
  if (exif) return `${exif[1]}-${exif[2]}-${exif[3]} ${exif[4]}`
  return text.replace('T', ' ')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Formats one of the photo's dates for the report. EXIF date/times are
 * naive wall-clock strings with no timezone: they mean "the time the
 * camera's clock showed", and the report must show exactly that, on any
 * machine. The raw value (from the reviveValues:false parse) is therefore
 * preferred — it is the recorded string itself. The revived Date is only
 * a fallback: exifr builds it from the recorded components in local time
 * (verified in its source), so its local getters hand the recorded string
 * back, while its UTC form (toISOString) shifts it by the viewer's offset
 * — the bug this function previously had.
 */
function asDateText(revived: unknown, raw: unknown): string | null {
  const fromRaw = recordedDateText(raw)
  if (fromRaw) return fromRaw
  if (revived instanceof Date && !Number.isNaN(revived.getTime())) {
    return `${revived.getFullYear()}-${pad2(revived.getMonth() + 1)}-${pad2(revived.getDate())} `
      + `${pad2(revived.getHours())}:${pad2(revived.getMinutes())}:${pad2(revived.getSeconds())}`
  }
  return recordedDateText(revived)
}

/**
 * Parses the metadata stored in a JPEG or PNG photo, entirely locally
 * (exifr is bundled with the site and loaded only for this tool). The
 * report is deliberately plain: what was found, in words, with GPS shown
 * as coordinates — no map, no lookup, nothing leaves the device.
 */
export async function parsePhotoData(data: Uint8Array): Promise<PhotoDataReport> {
  if (!isPng(data) && !isJpeg(data)) {
    throw new Error('This file does not look like a JPEG or PNG photo.')
  }
  const entries: PhotoDataEntry[] = []
  const found: string[] = []
  let gps: { latitude: number; longitude: number } | null = null

  if (isPng(data)) {
    const chunks = await pngTextChunks(data)
    for (const chunk of chunks) {
      entries.push({ label: `Text stored in the file (${chunk.keyword})`, value: chunk.value })
    }
    if (chunks.length > 0) {
      found.push(`${chunks.length} text ${chunks.length === 1 ? 'chunk' : 'chunks'} stored in the file`)
    }
  }

  let parsed: Record<string, unknown> | undefined
  let rawParsed: Record<string, unknown> | undefined
  try {
    const exifr = await import(/* viteChunkName: "exifr" */ 'exifr')
    const options = {
      tiff: true, exif: true, gps: true, xmp: true, iptc: true, jfif: false, icc: false,
    }
    parsed = (await exifr.parse(data as never, options as never)) as Record<string, unknown> | undefined
    // Second parse with value reviving off, used only for the date fields:
    // it leaves them as the raw strings recorded in the file, so no Date
    // object (and no timezone) is involved in showing them. Every other
    // field comes from the main parse, unchanged.
    try {
      rawParsed = (await exifr.parse(data as never, { ...options, reviveValues: false } as never)) as Record<string, unknown> | undefined
    } catch {
      rawParsed = undefined
    }
  } catch {
    parsed = undefined
  }

  if (parsed) {
    const add = (label: string, value: string | null) => { if (value) entries.push({ label, value }) }
    const make = asText(parsed.Make)
    const model = asText(parsed.Model)
    const lens = asText(parsed.LensModel)
    add('Camera make', make)
    add('Camera model', model)
    add('Lens', lens)
    if (make || model || lens) found.push('camera and lens details')

    const taken = asDateText(parsed.DateTimeOriginal, rawParsed?.DateTimeOriginal)
    const created = asDateText(parsed.CreateDate, rawParsed?.CreateDate)
    const modified = asDateText(parsed.ModifyDate, rawParsed?.ModifyDate)
    add('Date taken', taken)
    add('Date file created', created)
    add('Date file modified', modified)
    if (taken || created || modified) found.push('dates and times')

    const software = asText(parsed.Software) ?? asText(parsed.CreatorTool)
    add('Software', software)
    if (software) found.push('the software that wrote the file')

    const description = asText(parsed.ImageDescription)
    const artist = asText(parsed.Artist)
    const copyright = asText(parsed.Copyright)
    add('Description', description)
    add('Artist', artist)
    add('Copyright', copyright)
    if (description || artist || copyright) found.push('description and credit text')

    const altitude = parsed.GPSAltitude
    if (typeof altitude === 'number' && Number.isFinite(altitude)) {
      entries.push({ label: 'GPS altitude, metres', value: String(Math.round(altitude * 10) / 10) })
    }
    const lat = parsed.latitude
    const lng = parsed.longitude
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      gps = { latitude: lat, longitude: lng }
      entries.push({ label: 'GPS location', value: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
      found.push('GPS location')
    }
  }

  return { entries, gps, found, hasMetadata: entries.length > 0 }
}

/**
 * Produces a copy of the photo with its metadata stripped, by re-encoding
 * the picture through the canvas: the new file is written from the pixels
 * alone, so it carries no EXIF, GPS, XMP or text chunks. The tool states
 * the re-encode plainly; the picture itself is unchanged.
 */
export async function scrubPhoto(
  data: Uint8Array,
  engine: ImageEngine,
  sourceMime: string,
  format: ImageFormat,
): Promise<Uint8Array> {
  const decoded = await engine.decode(data, sourceMime)
  const canvas = engine.createCanvas(decoded.width, decoded.height)
  if (format === 'jpeg') {
    canvas.context.fillStyle = '#ffffff'
    canvas.context.fillRect(0, 0, decoded.width, decoded.height)
  }
  canvas.context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height)
  return canvas.encode(format, 0.92)
}
