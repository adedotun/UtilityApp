import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { flattenPdf } from './process'
import { buf, makePdf } from '../test-fixtures'

async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([500, 600])
  const form = doc.getForm()
  const name = form.createTextField('fullName')
  name.setText('Ada Lovelace')
  name.addToPage(page, { x: 40, y: 500, width: 220, height: 24 })
  const agree = form.createCheckBox('agree')
  agree.check()
  agree.addToPage(page, { x: 40, y: 460, width: 16, height: 16 })
  form.updateFieldAppearances()
  return doc.save()
}

describe('flattenPdf', () => {
  it('flattens every form field so none remain editable', async () => {
    const src = await makeFormPdf()
    const result = await flattenPdf(buf(src))
    expect(result.fieldCount).toBe(2)
    const doc = await PDFDocument.load(result.data.slice())
    expect(doc.getForm().getFields()).toHaveLength(0)
    expect(doc.getPageCount()).toBe(1)
  })
  it('says plainly when a PDF has no form fields', async () => {
    const src = await makePdf(2)
    await expect(flattenPdf(buf(src))).rejects.toThrow('no form fields')
  })
})
