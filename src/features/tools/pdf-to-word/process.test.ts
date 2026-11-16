import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import { buildDocx, extractParagraphs, linesFromItems, paragraphsFromLines, pdfToWord } from './process'
import { buf } from '../test-fixtures'

// PDF.js uses Uint8Array.prototype.toHex, which this Node runtime does not
// provide (current browsers do). Polyfill it for the test environment only.
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}

function item(str: string, x: number, y: number, size: number, width = 40) {
  return { str, transform: [size, 0, 0, size, x, y], width, hasEOL: false }
}

describe('linesFromItems', () => {
  it('groups items on one baseline into a line and keeps reading order', () => {
    const lines = linesFromItems([item('world', 60, 700, 12), item('Hello', 10, 700, 12), item('Next line', 10, 680, 12)])
    expect(lines.map((l) => l.text)).toEqual(['Hello world', 'Next line'])
  })
  it('ignores items without text or a transform', () => {
    expect(linesFromItems([{ str: 'Kept', transform: [12, 0, 0, 12, 0, 100], width: 30 }, { transform: [1, 0, 0, 1, 0, 0] }])).toHaveLength(1)
  })
})

describe('paragraphsFromLines', () => {
  it('detects a heading from a much larger font size', () => {
    const paragraphs = paragraphsFromLines([
      { text: 'Big title', size: 24, y: 700 },
      { text: 'Body line one', size: 12, y: 660 },
      { text: 'Body line two', size: 12, y: 644 },
    ])
    expect(paragraphs[0]).toEqual({ text: 'Big title', level: 1 })
    expect(paragraphs[1]).toEqual({ text: 'Body line one Body line two', level: 0 })
  })
  it('splits paragraphs on a large vertical gap', () => {
    const paragraphs = paragraphsFromLines([
      { text: 'First block', size: 12, y: 700 },
      { text: 'Second block', size: 12, y: 600 },
    ])
    expect(paragraphs.map((p) => p.text)).toEqual(['First block', 'Second block'])
  })
})

async function makeTextPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([612, 792])
  page.drawText('Quarterly Report', { x: 56, y: 720, size: 24, font: bold })
  page.drawText('Revenue grew in every region this quarter.', { x: 56, y: 680, size: 12, font })
  page.drawText('Costs stayed flat while hiring paused.', { x: 56, y: 664, size: 12, font })
  return doc.save()
}

describe('pdfToWord', () => {
  it('extracts paragraphs with the heading marked', async () => {
    const src = await makeTextPdf()
    const { paragraphs, pageCount } = await extractParagraphs(buf(src))
    expect(pageCount).toBe(1)
    expect(paragraphs[0]).toEqual({ text: 'Quarterly Report', level: 1 })
    expect(paragraphs.map((p) => p.text).join(' ')).toContain('Revenue grew in every region this quarter.')
  })

  it('produces a docx whose document.xml holds the text in order, heading styled', async () => {
    const src = await makeTextPdf()
    const { data } = await pdfToWord(buf(src))
    const zip = await JSZip.loadAsync(data)
    const xml = await zip.file('word/document.xml')!.async('string')
    const titleAt = xml.indexOf('Quarterly Report')
    const bodyAt = xml.indexOf('Revenue grew in every region this quarter.')
    expect(titleAt).toBeGreaterThan(-1)
    expect(bodyAt).toBeGreaterThan(titleAt)
    expect(xml).toContain('Heading1')
    expect(xml).toContain('Costs stayed flat while hiring paused.')
  })

  it('buildDocx alone round-trips plain paragraphs', async () => {
    const data = await buildDocx([{ text: 'Only body text', level: 0 }])
    const zip = await JSZip.loadAsync(data)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('Only body text')
  })

  it('rejects a PDF with no text layer', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([400, 600])
    const blank = await doc.save()
    await expect(pdfToWord(buf(blank))).rejects.toThrow('no readable text')
  })
})
