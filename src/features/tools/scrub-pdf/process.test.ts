import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import { detectScrubFindings, scrubPdf } from './process'
import { buf } from '../test-fixtures'

// PDF.js uses Uint8Array.prototype.toHex and Map upsert helpers, which this
// Node runtime does not provide (current browsers do). Polyfill for tests only.
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

async function makeDirtyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 600])
  const font = await doc.embedFont((await import('pdf-lib')).StandardFonts.Helvetica)
  page.drawText('Visible content', { x: 40, y: 520, size: 14, font })
  doc.setTitle('Secret Title')
  doc.setAuthor('Jane Author')
  doc.setSubject('A hidden subject')
  doc.setKeywords(['alpha', 'beta'])
  doc.setCreator('CreatorApp')
  doc.setProducer('ProducerApp')
  await doc.attach(new TextEncoder().encode('hello attachment'), 'notes.txt', { mimeType: 'text/plain', description: 'a note' })
  const ctx = doc.context
  const jsStream = ctx.flateStream('app.alert("boo")')
  const jsAction = ctx.obj({ S: PDFName.of('JavaScript'), JS: jsStream })
  doc.catalog.set(PDFName.of('OpenAction'), ctx.register(jsAction))
  return doc.save()
}

describe('detectScrubFindings', () => {
  it('finds metadata, the attachment and the open-action JavaScript', async () => {
    const findings = await detectScrubFindings(buf(await makeDirtyPdf()))
    expect(findings.metadata.map((m) => m.label)).toEqual(expect.arrayContaining(['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer']))
    expect(findings.metadata.find((m) => m.label === 'Title')?.value).toBe('Secret Title')
    expect(findings.attachments).toContain('notes.txt')
    expect(findings.javascript.join(' ')).toContain('when the document opens')
  })
})

describe('scrubPdf', () => {
  it('clears metadata, removes the attachment and the JavaScript, and names them in the report', async () => {
    const result = await scrubPdf(buf(await makeDirtyPdf()))
    expect(result.removed.join('; ')).toContain('Title metadata: "Secret Title"')
    expect(result.removed.join('; ')).toContain('Attachment: notes.txt')
    expect(result.removed.join('; ')).toContain('JavaScript that runs when the document opens')

    const doc = await PDFDocument.load(result.data.slice(), { updateMetadata: false })
    expect(doc.getTitle()).toBeUndefined()
    expect(doc.getAuthor()).toBeUndefined()
    expect(doc.getSubject()).toBeUndefined()
    expect(doc.getKeywords()).toBeUndefined()
    expect(doc.getCreator()).toBeUndefined()
    expect(doc.getProducer()).toBeUndefined()
    expect(doc.getPageCount()).toBe(1)
    expect(doc.catalog.has(PDFName.of('OpenAction'))).toBe(false)
    expect(doc.catalog.has(PDFName.of('Names'))).toBe(false)

    const after = await detectScrubFindings(buf(result.data))
    expect(after.metadata).toHaveLength(0)
    expect(after.attachments).toHaveLength(0)
    expect(after.javascript).toHaveLength(0)
  })

  it('reports nothing to remove for an already clean file and keeps its pages', async () => {
    // A truly clean fixture: pdf-lib stamps Creator and Producer when a
    // document is created, so strip those stamps and re-save first.
    const created = await PDFDocument.create()
    created.addPage([400, 600])
    const roundTrip = await PDFDocument.load(await created.save(), { updateMetadata: false })
    const info = roundTrip.context.lookup(roundTrip.context.trailerInfo.Info) as import('pdf-lib').PDFDict
    info.delete(PDFName.of('Creator'))
    info.delete(PDFName.of('Producer'))
    const clean = await roundTrip.save()
    const result = await scrubPdf(buf(clean))
    expect(result.removed).toHaveLength(0)
    expect((await PDFDocument.load(result.data.slice())).getPageCount()).toBe(1)
  })
})
