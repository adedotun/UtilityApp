import { PDFDocument } from 'pdf-lib'

export async function mergePdfs(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  if (buffers.length < 2) throw new Error('Add at least two PDFs to merge.')
  const out = await PDFDocument.create()
  for (const buf of buffers) {
    const src = await PDFDocument.load(new Uint8Array(buf.slice(0)), { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return out.save()
}
