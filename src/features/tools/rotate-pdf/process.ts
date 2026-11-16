import { PDFDocument, degrees } from 'pdf-lib'

export type RotationAngle = 90 | 180 | 270

/** Rotates selected 1-based pages (or all pages when selected is empty) by the angle, added to any existing rotation. */
export async function rotatePdf(buffer: ArrayBuffer, angle: RotationAngle, selected: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const pages = doc.getPages()
  const targets = selected.length ? selected : pages.map((_, i) => i + 1)
  for (const p of targets) {
    const page = pages[p - 1]
    if (!page) continue
    page.setRotation(degrees((page.getRotation().angle + angle) % 360))
  }
  return doc.save()
}
