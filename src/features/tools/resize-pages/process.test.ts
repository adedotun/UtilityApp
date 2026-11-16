import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { fitTransform, mmToPt, PAGE_SIZES, resizePdf } from './process'
import { extractPdfText } from '../pdf-to-text/process'
import { buf, makePdf } from '../test-fixtures'

// PDF.js uses Uint8Array.prototype.toHex, which this Node runtime does not
// provide (current browsers do). Polyfill it for the test environment only.
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}

describe('fitTransform', () => {
  it('scales by the smaller ratio and centres', () => {
    const fit = fitTransform(400, 600, 600, 600)
    expect(fit.scale).toBe(1)
    expect(fit.x).toBe(100)
    expect(fit.y).toBe(0)
  })
  it('shrinks to fit a smaller target', () => {
    const fit = fitTransform(800, 600, 400, 400)
    expect(fit.scale).toBe(0.5)
    expect(fit.drawnWidth).toBe(400)
    expect(fit.drawnHeight).toBe(300)
    expect(fit.y).toBe(50)
  })
})

describe('mmToPt', () => {
  it('converts A4 width', () => {
    expect(mmToPt(210)).toBeCloseTo(PAGE_SIZES.a4.widthPt, 0)
    expect(mmToPt(297)).toBeCloseTo(PAGE_SIZES.a4.heightPt, 0)
  })
})

async function pageSizes(data: Uint8Array): Promise<{ width: number; height: number }[]> {
  const doc = await PDFDocument.load(data.slice())
  return doc.getPages().map((p) => {
    const s = p.getSize()
    return { width: Math.round(s.width * 100) / 100, height: Math.round(s.height * 100) / 100 }
  })
}

describe('resizePdf', () => {
  it('sets every page to A4 and keeps the content', async () => {
    const src = await makePdf(3)
    const out = await resizePdf(buf(src), PAGE_SIZES.a4.widthPt, PAGE_SIZES.a4.heightPt)
    const sizes = await pageSizes(out)
    expect(sizes).toHaveLength(3)
    for (const s of sizes) {
      expect(s.width).toBeCloseTo(PAGE_SIZES.a4.widthPt, 1)
      expect(s.height).toBeCloseTo(PAGE_SIZES.a4.heightPt, 1)
    }
    const { text } = await extractPdfText(buf(out))
    expect(text).toContain('Page 1')
    expect(text).toContain('Page 3')
  })

  it('sets every page to a custom size given in millimetres', async () => {
    const src = await makePdf(2)
    const out = await resizePdf(buf(src), mmToPt(100), mmToPt(150))
    const sizes = await pageSizes(out)
    for (const s of sizes) {
      expect(s.width).toBeCloseTo(283.46, 1)
      expect(s.height).toBeCloseTo(425.2, 1)
    }
  })

  it('rejects a page size outside the PDF range', async () => {
    const src = await makePdf(1)
    await expect(resizePdf(buf(src), 10, 800)).rejects.toThrow('outside the range')
    await expect(resizePdf(buf(src), 800, 20000)).rejects.toThrow('outside the range')
  })

  it('rejects a file that is not a PDF', async () => {
    await expect(resizePdf(buf(new Uint8Array([1, 2, 3])), 595, 842)).rejects.toThrow('could not be read as a PDF')
  })
})
