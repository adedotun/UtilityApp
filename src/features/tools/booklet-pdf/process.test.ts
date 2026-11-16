import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { bookletPdf, bookletSides, paddedCount } from './process'
import { pdfjsLib } from '../../../lib/pdfjs'
import { buf, makePdf } from '../test-fixtures'

// Test-environment polyfills (same set as the other PDF.js-in-Node tests).
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

describe('bookletSides', () => {
  it('pads the count up to a multiple of four', () => {
    expect(paddedCount(1)).toBe(4)
    expect(paddedCount(4)).toBe(4)
    expect(paddedCount(5)).toBe(8)
    expect(paddedCount(8)).toBe(8)
    expect(paddedCount(9)).toBe(12)
  })

  it('pairs last with first on the front and second with second-last on the back', () => {
    expect(bookletSides(8)).toEqual([
      { left: 8, right: 1 },
      { left: 2, right: 7 },
      { left: 6, right: 3 },
      { left: 4, right: 5 },
    ])
    expect(bookletSides(4)).toEqual([
      { left: 4, right: 1 },
      { left: 2, right: 3 },
    ])
  })

  it('uses every padded page exactly once', () => {
    for (const n of [1, 3, 5, 6, 11]) {
      const flat = bookletSides(n).flatMap((s) => [s.left, s.right]).sort((a, b) => a - b)
      expect(flat).toEqual(Array.from({ length: paddedCount(n) }, (_, i) => i + 1))
    }
  })

  it('rejects an empty document', () => {
    expect(() => bookletSides(0)).toThrow('no pages')
  })
})

interface PlacedText { text: string; x: number }

async function textsWithPositions(data: Uint8Array, pageNum: number): Promise<PlacedText[]> {
  resolveWorkerForNode()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf(data).slice(0)) }).promise
  const page = await doc.getPage(pageNum)
  const content = await page.getTextContent()
  const out: PlacedText[] = []
  for (const item of content.items as { str?: string; transform?: number[] }[]) {
    if (item.str && item.transform) out.push({ text: item.str, x: item.transform[4] })
  }
  return out
}

describe('bookletPdf', () => {
  it('imposes an 8-page document onto 2 landscape sheets with page 8 left and page 1 right on the first side', async () => {
    const src = await makePdf(8)
    const result = await bookletPdf(buf(src), 'a4')
    expect(result.sheetCount).toBe(2)
    expect(result.sideCount).toBe(4)
    expect(result.paddedBlanks).toBe(0)
    const out = await PDFDocument.load(result.data.slice())
    const pages = out.getPages()
    expect(pages).toHaveLength(4)
    for (const p of pages) {
      const { width, height } = p.getSize()
      expect(width).toBeCloseTo(841.89, 1)
      expect(height).toBeCloseTo(595.28, 1)
    }
    const front = await textsWithPositions(result.data, 1)
    const page8 = front.find((t) => t.text === 'Page 8')
    const page1 = front.find((t) => t.text === 'Page 1')
    expect(page8).toBeTruthy()
    expect(page1).toBeTruthy()
    expect(page8!.x).toBeLessThan(841.89 / 2)
    expect(page1!.x).toBeGreaterThan(841.89 / 2)

    const back = await textsWithPositions(result.data, 2)
    expect(back.find((t) => t.text === 'Page 2')!.x).toBeLessThan(841.89 / 2)
    expect(back.find((t) => t.text === 'Page 7')!.x).toBeGreaterThan(841.89 / 2)
  })

  it('pads a 5-page document with blanks and reports them', async () => {
    const src = await makePdf(5)
    const result = await bookletPdf(buf(src), 'letter')
    expect(result.sheetCount).toBe(2)
    expect(result.paddedBlanks).toBe(3)
    const out = await PDFDocument.load(result.data.slice())
    expect(out.getPageCount()).toBe(4)
    const { width, height } = out.getPage(0).getSize()
    expect(width).toBeCloseTo(792, 1)
    expect(height).toBeCloseTo(612, 1)
    // The first side pairs a padding blank (left) with page 1 (right).
    const front = await textsWithPositions(result.data, 1)
    expect(front.map((t) => t.text)).toEqual(['Page 1'])
    expect(front[0].x).toBeGreaterThan(792 / 2)
  })

  it('rejects a file that is not a PDF', async () => {
    await expect(bookletPdf(buf(new Uint8Array([1, 2, 3])), 'a4')).rejects.toThrow('could not be read as a PDF')
  })
})
