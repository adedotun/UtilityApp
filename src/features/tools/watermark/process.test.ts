import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { addImageWatermark, addTextWatermark } from './process'
import { PNG_1X1, buf, makePdf } from '../test-fixtures'

describe('watermark', () => {
  it('adds a text watermark and keeps page count', async () => {
    const src = await makePdf(2)
    const out = await addTextWatermark(buf(src), 'DRAFT', 0.3, 'diagonal')
    expect((await PDFDocument.load(out.slice())).getPageCount()).toBe(2)
    expect(out.length).toBeGreaterThan(src.length)
  })
  it('rejects empty text', async () => {
    const src = await makePdf(1)
    await expect(addTextWatermark(buf(src), '  ', 0.3, 'center')).rejects.toThrow('watermark text')
  })
  it('adds an image watermark', async () => {
    const src = await makePdf(1)
    const out = await addImageWatermark(buf(src), PNG_1X1, 0.5)
    expect((await PDFDocument.load(out.slice())).getPageCount()).toBe(1)
  })
})
