import type { ImageEngine, ImageFormat } from '../image/engine'

export type ImageWatermarkPosition = 'center' | 'diagonal' | 'top' | 'bottom'

export interface ImageWatermarkOptions {
  text: string
  /** 0–1. */
  opacity: number
  position: ImageWatermarkPosition
}

/**
 * Draws a text watermark over an image, in the same positions and spirit
 * as the PDF watermark tool, and re-encodes in the image's own format.
 */
export async function watermarkImage(
  data: Uint8Array,
  engine: ImageEngine,
  sourceMime: string,
  format: ImageFormat,
  options: ImageWatermarkOptions,
): Promise<Uint8Array> {
  const text = options.text.trim()
  if (!text) throw new Error('Enter the watermark text.')
  const decoded = await engine.decode(data, sourceMime)
  const canvas = engine.createCanvas(decoded.width, decoded.height)
  const ctx = canvas.context
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, decoded.width, decoded.height)
  }
  ctx.drawImage(decoded.source, 0, 0, decoded.width, decoded.height)
  const size = Math.min(120, Math.max(16, Math.round(decoded.width * 0.055)))
  ctx.font = `700 ${size}px Manrope, Arial, sans-serif`
  ctx.fillStyle = '#73738c'
  ctx.globalAlpha = Math.min(1, Math.max(0, options.opacity))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (options.position === 'diagonal') {
    ctx.save()
    ctx.translate(decoded.width / 2, decoded.height / 2)
    ctx.rotate(-0.663)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  } else if (options.position === 'top') {
    ctx.fillText(text, decoded.width / 2, size)
  } else if (options.position === 'bottom') {
    ctx.fillText(text, decoded.width / 2, decoded.height - size)
  } else {
    ctx.fillText(text, decoded.width / 2, decoded.height / 2)
  }
  return canvas.encode(format, 0.92)
}
