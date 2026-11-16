import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createCanvas, Path2D } from '@napi-rs/canvas'
import { analyzePage, detectBlankPages, inkRatio, type PixelImage } from './process'
import { deletePages } from '../delete-pages/process'
import { extractPdfText, pageTextFromItems } from '../pdf-to-text/process'
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

// PDF.js draws vector paths through a global Path2D, which Node lacks; the
// Node canvas package supplies one (browsers have it natively).
const g = globalThis as { Path2D?: unknown }
if (!g.Path2D) g.Path2D = Path2D

function resolveWorkerForNode(): void {
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${process.cwd()}${src}`
  }
}

function solidImage(width: number, height: number, r: number, g: number, b: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255 }
  return { data, width, height }
}

describe('analyzePage', () => {
  it('calls a uniform page with no text blank at every sensitivity', () => {
    const img = solidImage(50, 50, 255, 255, 255)
    expect(inkRatio(img)).toBe(0)
    for (const s of ['strict', 'normal', 'loose'] as const) {
      expect(analyzePage(img, '', s).blank).toBe(true)
    }
  })

  it('never calls a page with text blank, however clean the pixels', () => {
    const img = solidImage(50, 50, 255, 255, 255)
    const a = analyzePage(img, 'One line of text', 'loose')
    expect(a.hasText).toBe(true)
    expect(a.blank).toBe(false)
  })

  it('measures ink coverage and lets sensitivity decide borderline pages', () => {
    const img = solidImage(100, 100, 255, 255, 255)
    // Ten black pixels in 10,000: an ink ratio of exactly 0.001.
    for (let p = 0; p < 10; p++) { const i = p * 4; img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0 }
    expect(inkRatio(img)).toBeCloseTo(0.001, 6)
    expect(analyzePage(img, '', 'strict').blank).toBe(false)
    expect(analyzePage(img, '', 'normal').blank).toBe(true)
    expect(analyzePage(img, '', 'loose').blank).toBe(true)
  })

  it('treats an off-white scan background as background, not ink', () => {
    const img = solidImage(40, 40, 238, 234, 224)
    expect(inkRatio(img)).toBe(0)
    expect(analyzePage(img, '', 'strict').blank).toBe(true)
  })
})

/** Pages: 1 text, 2 empty, 3 a drawn rectangle only, 4 empty, 5 text. */
async function makeMixedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([612, 792])
  p1.drawText('Page one has words', { x: 60, y: 700, size: 18, font })
  doc.addPage([612, 792])
  const p3 = doc.addPage([612, 792])
  p3.drawRectangle({ x: 100, y: 400, width: 240, height: 120, color: rgb(0.85, 0.2, 0.2) })
  doc.addPage([612, 792])
  const p5 = doc.addPage([612, 792])
  p5.drawText('Page five also has words', { x: 60, y: 700, size: 18, font })
  return doc.save()
}

/** Renders a page with PDF.js on the Node canvas, the test twin of the browser renderer in Tool.tsx. */
async function makeRenderer(buffer: ArrayBuffer) {
  resolveWorkerForNode()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  return async (pageNum: number) => {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport } as never).promise
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const content = await page.getTextContent()
    return {
      pixels: { data: image.data, width: image.width, height: image.height },
      text: pageTextFromItems(content.items as unknown[]),
    }
  }
}

describe('detectBlankPages on a mixed fixture', () => {
  it('finds exactly the two truly blank pages and removes exactly those', async () => {
    const src = await makeMixedPdf()
    const renderPage = await makeRenderer(buf(src))
    for (const sensitivity of ['strict', 'normal', 'loose'] as const) {
      const result = await detectBlankPages(buf(src), sensitivity, { renderPage })
      expect(result.pageCount).toBe(5)
      expect(result.blankPages).toEqual([2, 4])
      // The rectangle-only page has ink but no text: pixels, not text, keep it.
      expect(result.pages[2].hasText).toBe(false)
      expect(result.pages[2].inkRatio).toBeGreaterThan(0.01)
      expect(result.pages[2].blank).toBe(false)
      expect(result.pages[0].hasText).toBe(true)
    }
    const detection = await detectBlankPages(buf(src), 'normal', { renderPage })
    const cleaned = await deletePages(buf(src), detection.blankPages)
    expect((await PDFDocument.load(cleaned.slice())).getPageCount()).toBe(3)
    const text = await extractPdfText(buf(cleaned))
    expect(text.text).toContain('Page one has words')
    expect(text.text).toContain('Page five also has words')
  })

  it('reports progress page by page', async () => {
    const src = await makeMixedPdf()
    const renderPage = await makeRenderer(buf(src))
    const seen: number[] = []
    await detectBlankPages(buf(src), 'normal', { renderPage, onProgress: (p) => seen.push(p) })
    expect(seen).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects a file that is not a PDF', async () => {
    const renderPage = async () => { throw new Error('should not be called') }
    await expect(detectBlankPages(buf(new Uint8Array([1, 2, 3])), 'normal', { renderPage })).rejects.toThrow('could not be read as a PDF')
  })
})
