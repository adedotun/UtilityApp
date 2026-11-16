import { PDFDocument } from 'pdf-lib'

export type CompressLevel = 'email' | 'balanced' | 'quality'
export const LEVEL_DPI: Record<CompressLevel, { dpi: number; jpegQuality: number }> = {
  email: { dpi: 100, jpegQuality: 0.6 },
  balanced: { dpi: 150, jpegQuality: 0.75 },
  quality: { dpi: 200, jpegQuality: 0.85 },
}

export interface CompressResult { data: Uint8Array; originalSize: number; outputSize: number; returnedOriginal: boolean; method: 'rasterized' | 'resaved' }

/**
 * Rasterized path: pages rendered to JPEG at the level DPI and rebuilt as a PDF.
 * The renderer is injected so this stays testable and the browser supplies PDF.js + canvas.
 */
export async function buildRasterizedPdf(pages: { jpeg: Uint8Array; widthPt: number; heightPt: number }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const p of pages) {
    const img = await doc.embedJpg(p.jpeg)
    const page = doc.addPage([p.widthPt, p.heightPt])
    page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt })
  }
  return doc.save()
}

/**
 * Guarantees the output is never larger than the input: when a candidate is
 * bigger, the original bytes are returned and flagged.
 */
export function enforceNotLarger(original: Uint8Array, candidate: Uint8Array): { data: Uint8Array; returnedOriginal: boolean } {
  if (candidate.length >= original.length) return { data: original, returnedOriginal: true }
  return { data: candidate, returnedOriginal: false }
}

export async function resaveCompressed(buffer: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}

export async function compressPdf(buffer: ArrayBuffer, rasterizedCandidate?: Uint8Array): Promise<CompressResult> {
  const original = new Uint8Array(buffer.slice(0))
  let candidate: Uint8Array
  let method: CompressResult['method'] = 'resaved'
  if (rasterizedCandidate) { candidate = rasterizedCandidate; method = 'rasterized' }
  else candidate = await resaveCompressed(buffer)
  const { data, returnedOriginal } = enforceNotLarger(original, candidate)
  return { data, originalSize: original.length, outputSize: data.length, returnedOriginal, method: returnedOriginal ? 'resaved' : method }
}
