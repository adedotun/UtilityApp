import { PDFDocument } from 'pdf-lib'

export interface CropFractions { left: number; bottom: number; right: number; top: number }

/** Fractions are 0..0.45 of the page size trimmed from each edge. */
export async function cropPdf(buffer: ArrayBuffer, crop: CropFractions, selected: number[]): Promise<Uint8Array> {
  for (const [k, v] of Object.entries(crop)) {
    if (v < 0 || v >= 0.5) throw new Error(`The ${k} crop must be between 0 and 50 percent of the page.`)
  }
  if (crop.left + crop.right >= 0.9 || crop.top + crop.bottom >= 0.9) throw new Error('That crop would leave almost nothing of the page. Reduce one of the edges.')
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const pages = doc.getPages()
  const targets = selected.length ? selected : pages.map((_, i) => i + 1)
  for (const p of targets) {
    const page = pages[p - 1]
    if (!page) continue
    const { width, height } = page.getSize()
    const x = width * crop.left
    const y = height * crop.bottom
    const w = width * (1 - crop.left - crop.right)
    const h = height * (1 - crop.top - crop.bottom)
    page.setCropBox(x, y, w, h)
    page.setMediaBox(x, y, w, h)
  }
  return doc.save()
}
