import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fillForm, hasXfaForm, listFormFields } from './process'
import { buf, makePdf } from '../test-fixtures'

/** A one-page form with a text field, a checkbox, a dropdown and a radio group. */
async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([600, 400])
  const form = doc.getForm()
  const name = form.createTextField('fullName')
  name.addToPage(page, { x: 50, y: 300, width: 200, height: 24, font })
  const agree = form.createCheckBox('agree')
  agree.addToPage(page, { x: 50, y: 250, width: 18, height: 18 })
  const colour = form.createDropdown('colour')
  colour.addOptions(['Red', 'Green'])
  colour.addToPage(page, { x: 50, y: 200, width: 160, height: 24, font })
  const size = form.createRadioGroup('size')
  size.addOptionToPage('S', page, { x: 50, y: 150, width: 16, height: 16 })
  size.addOptionToPage('L', page, { x: 90, y: 150, width: 16, height: 16 })
  return doc.save()
}

/**
 * Builds a form PDF whose AcroForm carries an XFA entry. pdf-lib deletes
 * XFA data when it saves (its getForm warns and strips it), so the entry
 * cannot be baked in by pdf-lib itself; instead it is appended as a PDF
 * incremental update — the standard mechanism for modifying a PDF without
 * rewriting it — replacing the AcroForm object with one that has /XFA.
 */
async function makeXfaPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([300, 300])
  const form = doc.getForm()
  const field = form.createTextField('anything')
  field.addToPage(page, { x: 10, y: 10, width: 100, height: 20 })
  const base = await doc.save({ useObjectStreams: false })
  const text = new TextDecoder('latin1').decode(base)
  const acroNum = Number(text.match(/\/AcroForm (\d+) 0 R/)![1])
  const acroStart = text.indexOf(`${acroNum} 0 obj`)
  const acroBody = text.slice(acroStart, text.indexOf('endobj', acroStart))
  const fieldsArray = acroBody.match(/\/Fields (\[[^\]]*\])/)![1]
  const prevXref = Number([...text.matchAll(/startxref\s*(\d+)/g)].pop()![1])
  const size = Number(text.match(/\/Size (\d+)/)![1])
  const rootNum = Number(text.match(/\/Root (\d+) 0 R/)![1])
  const objText = `${acroNum} 0 obj\n<< /Fields ${fieldsArray} /XFA (placeholder) >>\nendobj\n`
  const xrefOffset = base.length + objText.length
  const update = objText
    + `xref\n${acroNum} 1\n${String(base.length).padStart(10, '0')} 00000 n \n`
    + `trailer\n<< /Size ${size} /Root ${rootNum} 0 R /Prev ${prevXref} >>\nstartxref\n${xrefOffset}\n%%EOF`
  const out = new Uint8Array(base.length + update.length)
  out.set(base)
  for (let i = 0; i < update.length; i++) out[base.length + i] = update.charCodeAt(i)
  return out
}

describe('listFormFields', () => {
  it('describes every field with its type and options', async () => {
    const src = await makeFormPdf()
    const info = await listFormFields(buf(src))
    expect(info.hasXfa).toBe(false)
    expect(info.fields.map((f) => [f.name, f.type])).toEqual([
      ['fullName', 'text'],
      ['agree', 'checkbox'],
      ['colour', 'dropdown'],
      ['size', 'radio'],
    ])
    const colour = info.fields.find((f) => f.name === 'colour')!
    expect(colour.options).toEqual(['Red', 'Green'])
    expect(colour.editable).toBe(true)
    const agree = info.fields.find((f) => f.name === 'agree')!
    expect(agree.value).toBe(false)
  })

  it('reports a plain PDF as having no fields and no XFA', async () => {
    const src = await makePdf(2)
    const info = await listFormFields(buf(src))
    expect(info.fields).toEqual([])
    expect(info.hasXfa).toBe(false)
  })

  it('detects an XFA entry in the AcroForm dictionary', async () => {
    const bytes = await makeXfaPdf()
    const reloaded = await PDFDocument.load(bytes.slice())
    expect(hasXfaForm(reloaded)).toBe(true)
    const info = await listFormFields(buf(bytes))
    expect(info.hasXfa).toBe(true)
    expect(info.fields.map((f) => f.name)).toEqual(['anything'])
  })
})

describe('fillForm', () => {
  it('fills text, checkbox, dropdown and radio values that read back from the output', async () => {
    const src = await makeFormPdf()
    const result = await fillForm(buf(src), {
      fullName: 'Ada Lovelace',
      agree: true,
      colour: 'Green',
      size: 'L',
    })
    expect(result.filledCount).toBe(4)
    const out = await PDFDocument.load(result.data.slice())
    const form = out.getForm()
    expect(form.getTextField('fullName').getText()).toBe('Ada Lovelace')
    expect(form.getCheckBox('agree').isChecked()).toBe(true)
    expect(form.getDropdown('colour').getSelected()).toEqual(['Green'])
    expect(form.getRadioGroup('size').getSelected()).toBe('L')
  })

  it('flattens on request, leaving no fields behind', async () => {
    const src = await makeFormPdf()
    const result = await fillForm(buf(src), { fullName: 'Grace Hopper' }, { flatten: true })
    const out = await PDFDocument.load(result.data.slice())
    expect(out.getForm().getFields()).toHaveLength(0)
  })

  it('rejects a value that is not one of a field’s choices, naming the field', async () => {
    const src = await makeFormPdf()
    await expect(fillForm(buf(src), { colour: 'Blue' })).rejects.toThrow('"Blue" is not one of the choices for the field "colour"')
  })

  it('rejects an unknown field name', async () => {
    const src = await makeFormPdf()
    await expect(fillForm(buf(src), { nickname: 'Ada' })).rejects.toThrow('no field called "nickname"')
  })

  it('refuses to save when nothing was filled', async () => {
    const src = await makeFormPdf()
    await expect(fillForm(buf(src), {})).rejects.toThrow('at least one field')
    await expect(fillForm(buf(src), { colour: '' })).rejects.toThrow('at least one field')
  })
})
