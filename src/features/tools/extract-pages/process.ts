import { PDFDocument } from 'pdf-lib'

export async function extractPages(buffer: ArrayBuffer, selected: number[]): Promise<Uint8Array> {
  if (selected.length === 0) throw new Error('Select at least one page to extract.')
  const src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const sorted = [...selected].sort((a, b) => a - b)
  if (sorted.some((p) => p < 1 || p > src.getPageCount())) throw new Error('A selected page is outside this document.')
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, sorted.map((p) => p - 1))
  pages.forEach((p) => out.addPage(p))
  return out.save()
}
