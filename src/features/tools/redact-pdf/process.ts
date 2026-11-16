import { PDFDocument } from 'pdf-lib'

/** All geometry is in page fractions (0..1), origin bottom-left — the same convention as the Edit tool. */
export interface RedactionBox { page: number; x: number; y: number; w: number; h: number }

export const REDACT_DPI = 200

export interface PixelImage { data: Uint8ClampedArray; width: number; height: number }

/**
 * Burns solid black over the boxed areas of a rendered page. Pixels are in
 * top-left origin RGBA order; boxes arrive in bottom-left page fractions
 * and are flipped here. This is the step that makes a redaction permanent:
 * after it, the page is rebuilt as an image and the text that was under
 * the boxes no longer exists anywhere in the file.
 */
export function burnRedactionBoxes(image: PixelImage, boxes: RedactionBox[]): PixelImage {
  const { data, width, height } = image
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x * width))
    const x1 = Math.min(width, Math.ceil((b.x + b.w) * width))
    const y0 = Math.max(0, Math.floor((1 - b.y - b.h) * height))
    const y1 = Math.min(height, Math.ceil((1 - b.y) * height))
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        data[i + 3] = 255
      }
    }
  }
  return image
}

export function boxesByPage(boxes: RedactionBox[]): Map<number, RedactionBox[]> {
  const map = new Map<number, RedactionBox[]>()
  for (const b of boxes) {
    const list = map.get(b.page) ?? []
    list.push(b)
    map.set(b.page, list)
  }
  return map
}

export interface RenderedRedactedPage { jpeg: Uint8Array; widthPt: number; heightPt: number }

/**
 * Rebuilds the PDF: pages named in `rendered` are replaced by their
 * rendered, blacked-out images; every other page is copied across as-is,
 * with its text layer and content untouched.
 */
export async function buildRedactedPdf(
  buffer: ArrayBuffer,
  boxes: RedactionBox[],
  rendered: Map<number, RenderedRedactedPage>,
): Promise<{ data: Uint8Array; redactedPages: number[] }> {
  if (!boxes.length) throw new Error('Draw at least one box over the content you want to remove.')
  const src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const pageCount = src.getPageCount()
  const byPage = boxesByPage(boxes)
  for (const page of byPage.keys()) {
    if (page < 1 || page > pageCount) throw new Error(`Page ${page} is not in this document, which has ${pageCount} pages.`)
    if (!rendered.has(page)) throw new Error(`Page ${page} was not rendered, so its redactions cannot be applied.`)
  }
  const out = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    const image = rendered.get(i + 1)
    if (image) {
      const jpg = await out.embedJpg(image.jpeg)
      const page = out.addPage([image.widthPt, image.heightPt])
      page.drawImage(jpg, { x: 0, y: 0, width: image.widthPt, height: image.heightPt })
    } else {
      const [copied] = await out.copyPages(src, [i])
      out.addPage(copied)
    }
  }
  return { data: await out.save(), redactedPages: [...byPage.keys()].sort((a, b) => a - b) }
}
