import { PDFDocument } from 'pdf-lib'

/** order is the new sequence of 1-based page numbers; it must be a permutation of all pages. */
export async function reorderPages(buffer: ArrayBuffer, order: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const count = src.getPageCount()
  const sorted = [...order].sort((a, b) => a - b)
  if (order.length !== count || sorted.some((p, i) => p !== i + 1)) {
    throw new Error('The new order must include every page exactly once.')
  }
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, order.map((p) => p - 1))
  pages.forEach((p) => out.addPage(p))
  return out.save()
}
