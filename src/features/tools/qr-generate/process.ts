import QRCode from 'qrcode'
import type { ImageEngine } from '../image/engine'

/** The black/white module grid of a QR code, quiet zone not included. */
export interface QrMatrix {
  /** Modules per side. */
  size: number
  /** Row-major module values: 1 is a dark module, 0 is light. */
  data: Uint8Array
}

/** Modules of quiet zone drawn around the code, as the QR standard expects. */
export const QR_QUIET_ZONE = 4

/**
 * Builds the module grid for the text at error-correction level M.
 * The same grid drives the on-screen preview and the saved PNG, so what
 * the user sees is exactly what downloads.
 */
export function qrModules(text: string): QrMatrix {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Enter some text or a web address first.')
  try {
    const qr = QRCode.create(trimmed, { errorCorrectionLevel: 'M' })
    return { size: qr.modules.size, data: qr.modules.data }
  } catch {
    throw new Error('That text is too long for a single QR code. Shorten it and try again.')
  }
}

/** Renders the code as a PNG at (at least close to) the requested pixel size. */
export async function generateQrPng(engine: ImageEngine, text: string, size: number): Promise<Uint8Array> {
  const matrix = qrModules(text)
  const total = matrix.size + QR_QUIET_ZONE * 2
  const scale = Math.max(1, Math.floor(size / total))
  const canvas = engine.createCanvas(total * scale, total * scale)
  const ctx = canvas.context
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.data[y * matrix.size + x]) {
        ctx.fillRect((x + QR_QUIET_ZONE) * scale, (y + QR_QUIET_ZONE) * scale, scale, scale)
      }
    }
  }
  return canvas.encode('png')
}
