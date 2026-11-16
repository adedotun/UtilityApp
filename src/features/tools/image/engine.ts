/**
 * Shared canvas engine for the image tools (Wave 5).
 *
 * Every image process function works against this small interface instead
 * of the DOM canvas directly, so the same code runs in the browser (DOM
 * canvas + createImageBitmap) and under the Node unit tests (@napi-rs/canvas,
 * see node-engine.ts) — the same injected-renderer pattern the OCR and
 * Compress PDF tools already use.
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export const FORMAT_MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const FORMAT_EXT: Record<ImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

/** The image format of a file from its name or MIME type, or null. */
export function formatFromFile(name: string, type: string): ImageFormat | null {
  if (type === 'image/png' || name.toLowerCase().endsWith('.png')) return 'png'
  if (type === 'image/jpeg' || /\.jpe?g$/i.test(name)) return 'jpeg'
  if (type === 'image/webp' || name.toLowerCase().endsWith('.webp')) return 'webp'
  return null
}

/** HEIC/HEIF photos (the iPhone default) need a dedicated decoder. */
export function isHeicFile(name: string, type: string): boolean {
  return type === 'image/heic' || type === 'image/heif' || /\.hei[cf]$/i.test(name)
}

export interface ImageContext {
  fillStyle: string
  globalAlpha: number
  font: string
  textAlign: string
  textBaseline: string
  fillRect(x: number, y: number, w: number, h: number): void
  drawImage(source: unknown, dx: number, dy: number, dw: number, dh: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  save(): void
  restore(): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray }
}

export interface ImageCanvas {
  width: number
  height: number
  context: ImageContext
  /** Encodes the canvas. Quality (0–1) applies to JPEG and WebP; PNG ignores it. */
  encode(format: ImageFormat, quality?: number): Promise<Uint8Array>
}

export interface DecodedImage {
  source: unknown
  width: number
  height: number
}

export interface ImageEngine {
  decode(data: Uint8Array, mime: string): Promise<DecodedImage>
  createCanvas(width: number, height: number): ImageCanvas
}

/** Scales dimensions down to fit a maximum side length; never enlarges. */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxDimension) return { width, height }
  const scale = maxDimension / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * Decodes an image and draws it onto a fresh canvas at the given size.
 * JPEG output has no transparency, so the canvas is painted white first —
 * callers that produce JPEG say so in their UI copy.
 */
export async function drawDecoded(
  engine: ImageEngine,
  data: Uint8Array,
  mime: string,
  target: { width: number; height: number },
  background: string | null,
): Promise<{ canvas: ImageCanvas; decoded: DecodedImage }> {
  const decoded = await engine.decode(data, mime)
  const canvas = engine.createCanvas(target.width, target.height)
  if (background) {
    canvas.context.fillStyle = background
    canvas.context.fillRect(0, 0, target.width, target.height)
  }
  canvas.context.drawImage(decoded.source, 0, 0, target.width, target.height)
  return { canvas, decoded }
}

/** Browser engine: DOM canvas and createImageBitmap, all same-origin. */
export function createBrowserEngine(): ImageEngine {
  return {
    async decode(data, mime) {
      let bitmap: ImageBitmap
      try {
        bitmap = await createImageBitmap(new Blob([data as BlobPart], { type: mime }))
      } catch {
        throw new Error('This image could not be decoded in this browser. It may be damaged, or in a format this browser cannot read.')
      }
      return { source: bitmap, width: bitmap.width, height: bitmap.height }
    },
    createCanvas(width, height) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is not available in this browser.')
      return {
        width,
        height,
        context: ctx as unknown as ImageContext,
        async encode(format, quality) {
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, FORMAT_MIME[format], quality))
          if (!blob) throw new Error('The image could not be written in that format in this browser.')
          return new Uint8Array(await blob.arrayBuffer())
        },
      }
    },
  }
}
