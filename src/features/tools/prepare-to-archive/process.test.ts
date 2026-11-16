import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { pagesLackingText, prepareToArchive, type ArchiveDeps } from './process'
import { extractPdfText } from '../pdf-to-text/process'
import type { RenderedPage } from '../ocr-pdf/process'
import { buf, makePdf, PNG_1X1 } from '../test-fixtures'

// PDF.js uses Uint8Array.prototype.toHex and Map upsert helpers, which this
// Node runtime does not provide (current browsers do). Polyfill for tests
// only, the same block the other PDF.js tests carry.
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

/** Page 1 carries real text; page 2 is a blank scan with no text layer. */
async function makeMixedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([400, 600])
  p1.drawText('Already searchable', { x: 40, y: 520, size: 18, font })
  doc.addPage([400, 600])
  return doc.save()
}

function fakeDeps(calls: { rendered: number[]; recognised: number }): ArchiveDeps {
  return {
    renderPage: async (pageNum): Promise<RenderedPage> => {
      calls.rendered.push(pageNum)
      return { image: PNG_1X1, format: 'png', widthPx: 400, heightPx: 600, widthPt: 400, heightPt: 600 }
    },
    recognize: async () => {
      calls.recognised++
      return { text: 'Scanned words', lines: [{ text: 'Scanned words', x0: 40, y0: 60, x1: 300, y1: 84 }] }
    },
  }
}

describe('pagesLackingText', () => {
  it('finds exactly the pages with no text layer', async () => {
    const mixed = await makeMixedPdf()
    const found = await pagesLackingText(buf(mixed))
    expect(found.pageCount).toBe(2)
    expect(found.lacking).toEqual([2])
  })
})

describe('prepareToArchive', () => {
  it('OCRs only the page without text, adds its words, and leaves the text page as it was', async () => {
    const mixed = await makeMixedPdf()
    const calls = { rendered: [] as number[], recognised: 0 }
    const result = await prepareToArchive(buf(mixed), fakeDeps(calls))
    expect(calls.rendered).toEqual([2])
    expect(calls.recognised).toBe(1)
    expect(result.pagesNeedingOcr).toBe(1)
    expect(result.pagesOcrd).toBe(1)
    expect(result.ocrSkipped).toBe(false)
    expect(result.flattened).toBe(false)
    expect(result.fieldCount).toBe(0)
    const extracted = await extractPdfText(buf(result.data))
    expect(extracted.text).toContain('Already searchable')
    expect(extracted.text).toContain('Scanned words')
    expect(extracted.pagesWithText).toBe(2)
  })

  it('skips OCR entirely when every page already has text, and never calls the recogniser', async () => {
    const source = await makePdf(2)
    const calls = { rendered: [] as number[], recognised: 0 }
    const result = await prepareToArchive(buf(source), fakeDeps(calls))
    expect(result.ocrSkipped).toBe(true)
    expect(result.pagesNeedingOcr).toBe(0)
    expect(result.pagesOcrd).toBe(0)
    expect(calls.rendered).toEqual([])
    expect(calls.recognised).toBe(0)
  })

  it('flattens form fields in step 2 and reports the count', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage([400, 600])
    page.drawText('A form with real text', { x: 40, y: 520, size: 18, font })
    const form = doc.getForm()
    const field = form.createTextField('fullName')
    field.setText('Ada')
    field.addToPage(page, { x: 40, y: 440, width: 200, height: 24, textColor: undefined })
    form.updateFieldAppearances()
    const source = await doc.save()
    const calls = { rendered: [] as number[], recognised: 0 }
    const result = await prepareToArchive(buf(source), fakeDeps(calls))
    expect(result.ocrSkipped).toBe(true)
    expect(result.fieldCount).toBe(1)
    expect(result.flattened).toBe(true)
    const out = await PDFDocument.load(result.data.slice())
    expect(out.getForm().getFields()).toHaveLength(0)
  })

  it('names step 1 when OCR fails and produces no file', async () => {
    const mixed = await makeMixedPdf()
    const deps = fakeDeps({ rendered: [], recognised: 0 })
    deps.recognize = async () => { throw new Error('The recognition engine could not start.') }
    await expect(prepareToArchive(buf(mixed), deps)).rejects.toThrow(/Step 1 of 2, OCR/)
  })

  it('names step 1 when no words can be recognised on the pages that need OCR', async () => {
    const mixed = await makeMixedPdf()
    const deps = fakeDeps({ rendered: [], recognised: 0 })
    deps.recognize = async () => ({ text: '   ', lines: [] })
    await expect(prepareToArchive(buf(mixed), deps)).rejects.toThrow(/Step 1 of 2, OCR/)
  })
})
