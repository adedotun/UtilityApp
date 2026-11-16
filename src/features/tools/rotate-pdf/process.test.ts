import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { rotatePdf } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('rotatePdf', () => {
  it('rotates all pages by 90', async () => {
    const src = await makePdf(2)
    const out = await rotatePdf(buf(src), 90, [])
    const doc = await PDFDocument.load(out.slice())
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 90])
  })
  it('rotates only selected pages and adds to existing rotation', async () => {
    const src = await makePdf(3)
    const once = await rotatePdf(buf(src), 90, [2])
    const twice = await rotatePdf(buf(once), 90, [2])
    const doc = await PDFDocument.load(twice.slice())
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 180, 0])
  })
})
