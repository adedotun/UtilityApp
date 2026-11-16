import { PDFDocument, StandardFonts } from 'pdf-lib'

/** Builds a PDF whose pages have distinct widths (400 + index * 20) so order can be verified after operations. */
export async function makePdf(pageCount: number, opts: { title?: string; author?: string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400 + i * 20, 600])
    page.drawText(`Page ${i + 1}`, { x: 40, y: 520, size: 18, font })
  }
  if (opts.title) doc.setTitle(opts.title)
  if (opts.author) doc.setAuthor(opts.author)
  return doc.save()
}

export const PNG_1X1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0))

export async function pageWidths(data: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(data.slice())
  return doc.getPages().map((p) => Math.round(p.getSize().width))
}

export function buf(data: Uint8Array): ArrayBuffer {
  return data.slice().buffer as ArrayBuffer
}
