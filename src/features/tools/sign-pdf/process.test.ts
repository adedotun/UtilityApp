import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { signPdf } from './process'
import { PNG_1X1, buf, makePdf } from '../test-fixtures'

describe('signPdf', () => {
  it('embeds a signature placement and text', async () => {
    const src = await makePdf(2)
    const out = await signPdf(buf(src), [{ page: 2, x: 0.1, y: 0.1, width: 0.3, png: PNG_1X1 }], [{ page: 1, x: 0.1, y: 0.9, text: 'Approved', size: 12 }])
    expect((await PDFDocument.load(out.slice())).getPageCount()).toBe(2)
    expect(out.length).toBeGreaterThan(src.length)
  })
  it('rejects an empty placement list', async () => {
    const src = await makePdf(1)
    await expect(signPdf(buf(src), [], [])).rejects.toThrow('at least one signature')
  })
})
