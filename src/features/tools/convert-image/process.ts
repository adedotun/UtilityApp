import { FORMAT_MIME, type ImageEngine, type ImageFormat } from '../image/engine'

export { isHeicFile } from '../image/engine'

export interface ConvertResult {
  data: Uint8Array
  width: number
  height: number
  format: ImageFormat
}

/**
 * Converts one image to PNG, JPEG or WebP through the canvas engine.
 * JPEG has no transparency, so the canvas is painted white first and any
 * transparent areas become white — the tool says so before converting.
 */
export async function convertImage(
  data: Uint8Array,
  engine: ImageEngine,
  sourceMime: string,
  target: ImageFormat,
  quality = 0.92,
): Promise<ConvertResult> {
  const decoded = await engine.decode(data, sourceMime)
  const canvas = engine.createCanvas(decoded.width, decoded.height)
  if (target === 'jpeg') {
    canvas.context.fillStyle = '#ffffff'
    canvas.context.fillRect(0, 0, decoded.width, decoded.height)
  }
  canvas.context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height)
  const out = await canvas.encode(target, quality)
  return { data: out, width: decoded.width, height: decoded.height, format: target }
}

/**
 * Decodes a HEIC/HEIF photo to JPEG bytes with heic2any, a decoder bundled
 * with this site and loaded only when a HEIC file is added. It is a
 * browser-only library, so there is no Node test for this path: instead,
 * any failure — the library not loading, the browser refusing to run it,
 * the file not decoding — becomes this explicit error, naming the file's
 * problem, rather than a silent failure or a wrong output.
 */
export async function decodeHeicToJpeg(file: File): Promise<Uint8Array> {
  try {
    const heic2any = (await import(/* viteChunkName: "heic2any" */ 'heic2any')).default
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
    const blob = Array.isArray(out) ? out[0] : out
    if (!blob) throw new Error('empty result')
    return new Uint8Array(await blob.arrayBuffer())
  } catch {
    throw new Error(
      `"${file.name}" could not be decoded as a HEIC photo in this browser. HEIC decoding runs on your device with an engine bundled with this site, and some browsers cannot run it. Saving the photo as JPEG on the device it came from, then adding that file, will work.`,
    )
  }
}

export { FORMAT_MIME }
