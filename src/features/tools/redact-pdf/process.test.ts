import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import { boxesByPage, buildRedactedPdf, burnRedactionBoxes, REDACT_DPI, type RedactionBox } from './process'
import { extractPdfText } from '../pdf-to-text/process'
import { pdfjsLib } from '../../../lib/pdfjs'
import { buf } from '../test-fixtures'

// Test-environment polyfills: PDF.js uses Uint8Array.prototype.toHex and the
// Map/WeakMap upsert helpers, which this Node runtime lacks (browsers have them).
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}
type UpsertProto = Record<string, unknown>
const upsertImpl = function (this: Map<unknown, unknown>, key: unknown, fn: (k: unknown) => unknown) { if (!this.has(key)) this.set(key, fn(key)); return this.get(key) }
const mapProto = Map.prototype as unknown as UpsertProto
if (typeof mapProto.getOrInsertComputed !== 'function') {
  mapProto.getOrInsertComputed = upsertImpl
  ;(WeakMap.prototype as unknown as UpsertProto).getOrInsertComputed = upsertImpl
}

function resolveWorkerForNode(): void {
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${process.cwd()}${src}`
  }
}

describe('burnRedactionBoxes', () => {
  it('blacks exactly the boxed fraction, flipped from bottom-left origin', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    // Bottom-left quarter of the page: x 0..0.5, y 0..0.5 in page fractions.
    burnRedactionBoxes({ data, width, height }, [{ page: 1, x: 0, y: 0, w: 0.5, h: 0.5 }])
    const px = (x: number, yTop: number) => data[(yTop * width + x) * 4]
    expect(px(10, 90)).toBe(0) // bottom-left in pixels (near the bottom rows)
    expect(px(10, 10)).toBe(255) // top-left untouched
    expect(px(90, 90)).toBe(255) // bottom-right untouched
  })
})

describe('boxesByPage', () => {
  it('groups boxes by page', () => {
    const map = boxesByPage([
      { page: 2, x: 0, y: 0, w: 0.1, h: 0.1 },
      { page: 1, x: 0, y: 0, w: 0.1, h: 0.1 },
      { page: 2, x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
    ])
    expect(map.get(2)).toHaveLength(2)
    expect(map.get(1)).toHaveLength(1)
  })
})

async function makeSecretPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([612, 792])
  p1.drawText('The secret code is 481516', { x: 56, y: 700, size: 20, font })
  p1.drawText('Public information line', { x: 56, y: 640, size: 12, font })
  const p2 = doc.addPage([612, 792])
  p2.drawText('Untouched page keeps its text', { x: 56, y: 700, size: 14, font })
  return doc.save()
}

const SECRET_BOX: RedactionBox = { page: 1, x: 0.05, y: 0.865, w: 0.8, h: 0.06 }

/** Renders one page with PDF.js on the Node canvas, burns the boxes in, returns JPEG. */
async function renderRedactedPage(buffer: ArrayBuffer, pageNum: number, boxes: RedactionBox[]) {
  resolveWorkerForNode()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  const page = await doc.getPage(pageNum)
  const pt = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: REDACT_DPI / 72 })
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // @napi-rs/canvas supplies a real 2d context, which is what PDF.js draws into.
  await page.render({ canvasContext: ctx, viewport } as never).promise
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  burnRedactionBoxes({ data: pixels.data, width: pixels.width, height: pixels.height }, boxes)
  ctx.putImageData(pixels, 0, 0)
  return { jpeg: new Uint8Array(canvas.toBuffer('image/jpeg')), widthPt: pt.width, heightPt: pt.height }
}

describe('buildRedactedPdf', () => {
  it('removes the secret from the redacted page text layer and keeps the untouched page readable', async () => {
    const src = await makeSecretPdf()
    const rendered = new Map([[1, await renderRedactedPage(buf(src), 1, [SECRET_BOX])]])
    const result = await buildRedactedPdf(buf(src), [SECRET_BOX], rendered)
    expect(result.redactedPages).toEqual([1])
    const extracted = await extractPdfText(buf(result.data))
    expect(extracted.pageCount).toBe(2)
    expect(extracted.text).not.toContain('481516')
    expect(extracted.text).not.toContain('secret code')
    // The whole redacted page is an image now, so even its public line has no text layer.
    expect(extracted.text).not.toContain('Public information line')
    expect(extracted.text).toContain('Untouched page keeps its text')
  }, 60_000)

  it('rejects an empty box list and a page outside the document', async () => {
    const src = await makeSecretPdf()
    await expect(buildRedactedPdf(buf(src), [], new Map())).rejects.toThrow('at least one box')
    const rendered = new Map([[9, { jpeg: new Uint8Array([1]), widthPt: 10, heightPt: 10 }]])
    await expect(buildRedactedPdf(buf(src), [{ page: 9, x: 0, y: 0, w: 0.1, h: 0.1 }], rendered)).rejects.toThrow('not in this document')
  })
})
