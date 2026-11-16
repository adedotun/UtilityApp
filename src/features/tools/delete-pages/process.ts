import { PDFDocument } from 'pdf-lib'

export async function deletePages(buffer: ArrayBuffer, selected: number[]): Promise<Uint8Array> {
  if (selected.length === 0) throw new Error('Select at least one page to delete.')
  const src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const total = src.getPageCount()
  const unique = [...new Set(selected)]
  if (unique.some((p) => p < 1 || p > total)) throw new Error('A selected page is outside this document.')
  if (unique.length >= total) throw new Error('Every page is selected. A PDF has to keep at least one page, so leave at least one page unselected.')
  const remove = new Set(unique)
  const keep = Array.from({ length: total }, (_, i) => i + 1).filter((p) => !remove.has(p))
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, keep.map((p) => p - 1))
  pages.forEach((p) => out.addPage(p))
  return out.save()
}
