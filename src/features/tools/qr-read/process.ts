import type { ImageEngine } from '../image/engine'

export interface QrReadResult {
  /** The decoded content of the code. */
  text: string
  /** True when the content is a single http(s) web address. */
  isUrl: boolean
}

/**
 * Decodes the first QR code found in an image, entirely on the device.
 * Returns null when the image holds no readable code — an ordinary
 * outcome the UI states plainly, not a failure.
 */
export async function readQrCode(engine: ImageEngine, data: Uint8Array, mime: string): Promise<QrReadResult | null> {
  // jsQR is a large single-tool engine; it loads on demand, never with the app shell.
  const { default: jsQR } = await import('jsqr')
  const decoded = await engine.decode(data, mime)
  const canvas = engine.createCanvas(decoded.width, decoded.height)
  canvas.context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height)
  const pixels = canvas.context.getImageData(0, 0, decoded.width, decoded.height)
  const code = jsQR(new Uint8ClampedArray(pixels.data), decoded.width, decoded.height)
  if (!code || !code.data) return null
  return { text: code.data, isUrl: /^https?:\/\/\S+$/i.test(code.data.trim()) }
}
