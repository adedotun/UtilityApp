import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { cropPdf } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('cropPdf', () => {
  it('sets crop and media boxes from fractions', async () => {
    const src = await makePdf(1) // 400 x 600
    const out = await cropPdf(buf(src), { left: 0.1, bottom: 0.1, right: 0.1, top: 0.1 }, [])
    const page = (await PDFDocument.load(out.slice())).getPage(0)
    const box = page.getCropBox()
    expect(Math.round(box.x)).toBe(40)
    expect(Math.round(box.y)).toBe(60)
    expect(Math.round(box.width)).toBe(320)
    expect(Math.round(box.height)).toBe(480)
    const media = page.getMediaBox()
    expect(Math.round(media.width)).toBe(320)
  })
  it('crops only selected pages', async () => {
    const src = await makePdf(2)
    const out = await cropPdf(buf(src), { left: 0.25, bottom: 0, right: 0, top: 0 }, [2])
    const doc = await PDFDocument.load(out.slice())
    expect(Math.round(doc.getPage(0).getCropBox().width)).toBe(400)
    expect(Math.round(doc.getPage(1).getCropBox().width)).toBe(315)
  })
  it('rejects an excessive crop', async () => {
    const src = await makePdf(1)
    await expect(cropPdf(buf(src), { left: 0.5, bottom: 0, right: 0.4, top: 0 }, [])).rejects.toThrow()
  })
})
