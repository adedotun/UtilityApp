import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildRasterizedPdf, compressPdf, enforceNotLarger } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('enforceNotLarger', () => {
  it('returns the original when the candidate is bigger', () => {
    const original = new Uint8Array([1, 2, 3])
    const candidate = new Uint8Array([1, 2, 3, 4])
    const r = enforceNotLarger(original, candidate)
    expect(r.returnedOriginal).toBe(true)
    expect(r.data).toBe(original)
  })
  it('keeps a smaller candidate', () => {
    const r = enforceNotLarger(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))
    expect(r.returnedOriginal).toBe(false)
    expect(r.data.length).toBe(2)
  })
})
describe('compressPdf', () => {
  it('never returns something larger than the input', async () => {
    const src = await makePdf(2)
    const result = await compressPdf(buf(src))
    expect(result.outputSize).toBeLessThanOrEqual(result.originalSize)
    expect((await PDFDocument.load(result.data.slice())).getPageCount()).toBe(2)
  })
  it('accepts a rasterized candidate and applies the guarantee', async () => {
    const src = await makePdf(1)
    const raster = await buildRasterizedPdf([])
    const result = await compressPdf(buf(src), raster.length ? raster : new Uint8Array([9, 9, 9]))
    expect(result.outputSize).toBeLessThanOrEqual(result.originalSize)
  })
})
