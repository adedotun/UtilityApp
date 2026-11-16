import { createCanvas as napiCreateCanvas, loadImage } from '@napi-rs/canvas'
import { FORMAT_MIME, type ImageContext, type ImageEngine } from './engine'

/**
 * Node engine for the unit tests, backed by @napi-rs/canvas (already in the
 * dependency tree as a pdfjs-dist optional dependency, and the canvas the
 * OCR tests use). Never imported by browser code.
 */
export function createNodeEngine(): ImageEngine {
  return {
    async decode(data) {
      const img = await loadImage(Buffer.from(data))
      return { source: img, width: img.width, height: img.height }
    },
    createCanvas(width, height) {
      const canvas = napiCreateCanvas(width, height)
      const ctx = canvas.getContext('2d')
      return {
        width,
        height,
        context: ctx as unknown as ImageContext,
        async encode(format, quality) {
          if (format === 'jpeg') {
            return new Uint8Array(canvas.toBuffer('image/jpeg', quality != null ? Math.round(quality * 100) : undefined))
          }
          if (format === 'webp') {
            return new Uint8Array(canvas.toBuffer('image/webp'))
          }
          return new Uint8Array(canvas.toBuffer(FORMAT_MIME[format] as 'image/png'))
        },
      }
    },
  }
}
