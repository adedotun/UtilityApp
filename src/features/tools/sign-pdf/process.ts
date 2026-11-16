import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/** Coordinates are fractions of page width/height (0..1), origin bottom-left, so placements survive any render scale. */
export interface SignaturePlacement { page: number; x: number; y: number; width: number; png: Uint8Array }
export interface TextPlacement { page: number; x: number; y: number; text: string; size: number }

export async function signPdf(buffer: ArrayBuffer, signatures: SignaturePlacement[], texts: TextPlacement[]): Promise<Uint8Array> {
  if (signatures.length === 0 && texts.length === 0) throw new Error('Place at least one signature or piece of text on the document first.')
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const pages = doc.getPages()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const embedded = new Map<Uint8Array, Awaited<ReturnType<PDFDocument['embedPng']>>>()
  for (const sig of signatures) {
    const page = pages[sig.page - 1]
    if (!page) continue
    if (!embedded.has(sig.png)) embedded.set(sig.png, await doc.embedPng(sig.png))
    const img = embedded.get(sig.png)!
    const { width, height } = page.getSize()
    const w = width * sig.width
    const h = (img.height / img.width) * w
    page.drawImage(img, { x: width * sig.x, y: height * sig.y, width: w, height: h })
  }
  for (const t of texts) {
    const page = pages[t.page - 1]
    if (!page) continue
    const { width, height } = page.getSize()
    page.drawText(t.text, { x: width * t.x, y: height * t.y, size: t.size, font, color: rgb(0.05, 0.05, 0.1) })
  }
  return doc.save()
}

/** Renders typed text to a transparent PNG via canvas (browser only), used as a typed signature. */
export async function textToSignaturePng(text: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  const font = '48px "Manrope Variable", sans-serif'
  const meas = document.createElement('canvas').getContext('2d')
  if (!meas) throw new Error('Canvas is not available in this browser.')
  meas.font = font
  canvas.width = Math.ceil(meas.measureText(text).width) + 24
  canvas.height = 72
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.font = font; ctx.fillStyle = '#111827'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 12, 38)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('The signature could not be created.')
  return new Uint8Array(await blob.arrayBuffer())
}
