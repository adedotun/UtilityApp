import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { textToPdf, wrapText } from './process'

describe('wrapText', () => {
  it('wraps long lines and keeps paragraphs', () => {
    const lines = wrapText('one two three four five\n\nshort', 12)
    expect(lines.length).toBeGreaterThan(2)
    expect(lines).toContain('')
  })
})
describe('textToPdf', () => {
  it('creates a PDF from text, paginating long input', async () => {
    const text = Array.from({ length: 300 }, (_, i) => `Line ${i} with some words to wrap around the page width nicely`).join('\n')
    const out = await textToPdf(text, 'My document')
    const doc = await PDFDocument.load(out.slice())
    expect(doc.getPageCount()).toBeGreaterThan(1)
    expect(doc.getTitle()).toBe('My document')
  })
})
