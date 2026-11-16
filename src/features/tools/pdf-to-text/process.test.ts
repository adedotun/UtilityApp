import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { assembleText, extractPdfText, pageTextFromItems } from './process'
import { buf, makePdf } from '../test-fixtures'

// PDF.js uses Uint8Array.prototype.toHex, which this Node runtime does not
// provide (current browsers do). Polyfill it for the test environment only.
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}

describe('pageTextFromItems', () => {
  it('joins items with spaces and honours end-of-line flags', () => {
    const items = [
      { str: 'Hello', hasEOL: false },
      { str: 'world', hasEOL: true },
      { str: 'Second line', hasEOL: false },
    ]
    expect(pageTextFromItems(items)).toBe('Hello world\nSecond line')
  })
  it('ignores non-text items such as image markers', () => {
    expect(pageTextFromItems([{ str: 'Text' }, { transform: [1, 0, 0, 1, 0, 0] }])).toBe('Text')
  })
})

describe('assembleText', () => {
  it('heads each page section and marks pages without text', () => {
    expect(assembleText(['Alpha', ''])).toBe('--- Page 1 ---\nAlpha\n\n--- Page 2 ---\n(no readable text on this page)')
  })
})

describe('extractPdfText', () => {
  it('extracts the text layer, one section per page', async () => {
    const src = await makePdf(3)
    const result = await extractPdfText(buf(src))
    expect(result.pageCount).toBe(3)
    expect(result.pagesWithText).toBe(3)
    expect(result.text).toContain('--- Page 1 ---')
    expect(result.text).toContain('Page 1')
    expect(result.text).toContain('--- Page 3 ---')
    expect(result.text).toContain('Page 3')
  })
  it('rejects a PDF with no text layer instead of returning an empty file', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([400, 600])
    doc.addPage([400, 600])
    const blank = await doc.save()
    await expect(extractPdfText(buf(blank))).rejects.toThrow('no readable text')
  })
})
