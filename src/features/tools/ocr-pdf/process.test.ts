import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSearchablePdf, createRecognizer, linesFromBlocks, ocrPdf, toDrawableText, type RenderedPage } from './process'
import { extractPdfText } from '../pdf-to-text/process'
import { pdfjsLib } from '../../../lib/pdfjs'
import { buf, PNG_1X1 } from '../test-fixtures'

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

describe('toDrawableText', () => {
  it('maps typographic characters and drops what Helvetica cannot draw', () => {
    expect(toDrawableText('a “quoted” word — with dash…')).toBe('a "quoted" word - with dash...')
    expect(toDrawableText('emoji \u{1F600} gone')).toBe('emoji  gone')
  })
})

describe('linesFromBlocks', () => {
  it('flattens blocks to positioned lines and skips empty ones', () => {
    const lines = linesFromBlocks([
      { paragraphs: [{ lines: [
        { text: 'Hello world', bbox: { x0: 1, y0: 2, x1: 50, y1: 12 } },
        { text: '  ', bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
      ] }] },
    ])
    expect(lines).toEqual([{ text: 'Hello world', x0: 1, y0: 2, x1: 50, y1: 12 }])
  })
})

describe('buildSearchablePdf', () => {
  it('adds an extractable invisible text layer over the page image', async () => {
    const rendered: RenderedPage = { image: PNG_1X1, format: 'png', widthPx: 800, heightPx: 600, widthPt: 400, heightPt: 300 }
    const pdf = await buildSearchablePdf([{ rendered, ocr: { text: 'Layer words', lines: [{ text: 'Layer words', x0: 40, y0: 60, x1: 360, y1: 84 }] } }])
    const extracted = await extractPdfText(buf(pdf))
    expect(extracted.text).toContain('Layer words')
  })
})

function drawTextPng(lines: string[]): Uint8Array {
  const canvas = createCanvas(1200, 400)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1200, 400)
  ctx.fillStyle = '#000000'
  ctx.font = '64px sans-serif'
  ctx.fillText(lines[0], 60, 140)
  ctx.font = '44px sans-serif'
  ctx.fillText(lines[1], 60, 260)
  return new Uint8Array(canvas.toBuffer('image/png'))
}

async function makeScannedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const first = await doc.embedPng(drawTextPng(['SECRET LEDGER', 'Account summary page']))
  const p1 = doc.addPage([612, 204])
  p1.drawImage(first, { x: 0, y: 0, width: 612, height: 204 })
  const second = await doc.embedPng(drawTextPng(['SECOND PAGE', 'Nothing hidden here']))
  const p2 = doc.addPage([612, 204])
  p2.drawImage(second, { x: 0, y: 0, width: 612, height: 204 })
  return doc.save()
}

/** Renders a page with PDF.js on the Node canvas, the test twin of the browser renderer in Tool.tsx. */
async function renderPage(buffer: ArrayBuffer, pageNum: number): Promise<RenderedPage> {
  resolveWorkerForNode()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  const page = await doc.getPage(pageNum)
  const pt = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: 3 })
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport } as never).promise
  return {
    image: new Uint8Array(canvas.toBuffer('image/png')),
    format: 'png',
    widthPx: canvas.width,
    heightPx: canvas.height,
    widthPt: pt.width,
    heightPt: pt.height,
  }
}

describe('ocrPdf with the real local tesseract engine', () => {
  it('reads the words in scanned pages and returns a searchable PDF', async () => {
    const src = await makeScannedPdf()
    const recognizer = await createRecognizer({
      langPath: join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
      cachePath: mkdtempSync(join(tmpdir(), 'pdf-tweaks-ocr-')),
    })
    try {
      const progress: number[] = []
      const result = await ocrPdf(buf(src), {
        renderPage: (n) => renderPage(buf(src), n),
        recognize: (image) => recognizer.recognize(image),
        onProgress: (page) => progress.push(page),
      })
      expect(result.pageCount).toBe(2)
      expect(result.pagesWithText).toBe(2)
      expect(progress).toEqual([1, 2])
      expect(result.text).toContain('SECRET LEDGER')
      expect(result.text).toContain('SECOND PAGE')
      // The searchable PDF must expose the recognised words to text extraction.
      const extracted = await extractPdfText(buf(result.pdf))
      expect(extracted.text).toContain('SECRET LEDGER')
      expect(extracted.text).toContain('SECOND PAGE')
    } finally {
      await recognizer.terminate()
    }
  }, 120_000)
})
