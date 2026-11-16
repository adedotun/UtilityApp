import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { cellRect, gridFor, nUpPdf, SHEET_MARGIN_PT, SHEET_SIZES } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('gridFor', () => {
  it('stacks 2 and 6 on portrait sheets and runs them across on landscape', () => {
    expect(gridFor(2, 'portrait')).toEqual({ cols: 1, rows: 2 })
    expect(gridFor(2, 'landscape')).toEqual({ cols: 2, rows: 1 })
    expect(gridFor(6, 'portrait')).toEqual({ cols: 2, rows: 3 })
    expect(gridFor(6, 'landscape')).toEqual({ cols: 3, rows: 2 })
    expect(gridFor(4, 'portrait')).toEqual({ cols: 2, rows: 2 })
    expect(gridFor(9, 'landscape')).toEqual({ cols: 3, rows: 3 })
  })
})

describe('cellRect', () => {
  it('places the first cell at the top left inside the margin', () => {
    const { widthPt: w, heightPt: h } = SHEET_SIZES.a4
    const cell = cellRect(0, { cols: 2, rows: 2 }, w, h, 12)
    expect(cell.x).toBe(SHEET_MARGIN_PT)
    expect(cell.y + cell.height).toBeCloseTo(h - SHEET_MARGIN_PT)
  })
  it('places the second cell to the right of the first, one gap away', () => {
    const { widthPt: w, heightPt: h } = SHEET_SIZES.a4
    const grid = { cols: 2, rows: 2 }
    const first = cellRect(0, grid, w, h, 12)
    const second = cellRect(1, grid, w, h, 12)
    expect(second.x).toBeCloseTo(first.x + first.width + 12)
    expect(second.y).toBeCloseTo(first.y)
  })
})

async function sheetSizes(data: Uint8Array): Promise<{ width: number; height: number }[]> {
  const doc = await PDFDocument.load(data.slice())
  return doc.getPages().map((p) => p.getSize())
}

describe('nUpPdf', () => {
  it('puts a 9-page document on 3 sheets at 4-up, each sheet A4', async () => {
    const src = await makePdf(9)
    const { data, sheetCount, pageCount } = await nUpPdf(buf(src), { perSheet: 4, sheet: 'a4', orientation: 'portrait', gapPt: 12 })
    expect(pageCount).toBe(9)
    expect(sheetCount).toBe(3)
    const sizes = await sheetSizes(data)
    expect(sizes).toHaveLength(3)
    for (const s of sizes) {
      expect(s.width).toBeCloseTo(SHEET_SIZES.a4.widthPt, 1)
      expect(s.height).toBeCloseTo(SHEET_SIZES.a4.heightPt, 1)
    }
  })

  it('swaps the sheet dimensions in landscape', async () => {
    const src = await makePdf(2)
    const { data, sheetCount } = await nUpPdf(buf(src), { perSheet: 2, sheet: 'letter', orientation: 'landscape', gapPt: 0 })
    expect(sheetCount).toBe(1)
    const sizes = await sheetSizes(data)
    expect(sizes[0].width).toBeCloseTo(SHEET_SIZES.letter.heightPt, 1)
    expect(sizes[0].height).toBeCloseTo(SHEET_SIZES.letter.widthPt, 1)
  })

  it('rounds a partial last sheet up', async () => {
    const src = await makePdf(5)
    const { sheetCount } = await nUpPdf(buf(src), { perSheet: 2, sheet: 'a4', orientation: 'portrait', gapPt: 12 })
    expect(sheetCount).toBe(3)
  })

  it('rejects an unsupported count', async () => {
    const src = await makePdf(2)
    await expect(nUpPdf(buf(src), { perSheet: 3 as never, sheet: 'a4', orientation: 'portrait', gapPt: 12 })).rejects.toThrow('must be 2, 4, 6 or 9')
  })
})
