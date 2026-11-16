import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

export type WatermarkPosition = 'center' | 'diagonal' | 'top' | 'bottom'

export async function addTextWatermark(buffer: ArrayBuffer, text: string, opacity: number, position: WatermarkPosition): Promise<Uint8Array> {
  if (!text.trim()) throw new Error('Enter the watermark text.')
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const size = 42
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const tw = font.widthOfTextAtSize(text, size)
    if (position === 'diagonal') {
      page.drawText(text, { x: (width - tw * 0.72) / 2, y: height / 2, size, font, color: rgb(0.45, 0.45, 0.55), opacity, rotate: degrees(38) })
    } else {
      const y = position === 'top' ? height - 72 : position === 'bottom' ? 40 : (height - size) / 2
      page.drawText(text, { x: (width - tw) / 2, y, size, font, color: rgb(0.45, 0.45, 0.55), opacity })
    }
  }
  return doc.save()
}

export async function addImageWatermark(buffer: ArrayBuffer, png: Uint8Array, opacity: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const img = await doc.embedPng(png)
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const w = Math.min(220, width * 0.4)
    const h = (img.height / img.width) * w
    page.drawImage(img, { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h, opacity })
  }
  return doc.save()
}
