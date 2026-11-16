import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { addHeaderFooter, expandPlaceholders } from './process'
import { buf, makePdf } from '../test-fixtures'

const values = { page: 2, total: 9, date: '16 Nov 2026', filename: 'report' }

describe('expandPlaceholders', () => {
  it('replaces all four placeholders', () => {
    expect(expandPlaceholders('{filename} — page {page} of {total}, {date}', values)).toBe('report — page 2 of 9, 16 Nov 2026')
  })
  it('replaces repeated placeholders and leaves plain text alone', () => {
    expect(expandPlaceholders('{page}/{page}', values)).toBe('2/2')
    expect(expandPlaceholders('Confidential', values)).toBe('Confidential')
  })
})

describe('addHeaderFooter', () => {
  it('stamps every page and keeps the page count', async () => {
    const src = await makePdf(3)
    const out = await addHeaderFooter(buf(src), { text: 'Page {page} of {total}', placement: 'footer', align: 'center', fontSize: 10, opacity: 1, filename: 'doc', date: '16 Nov 2026' })
    const doc = await PDFDocument.load(out.slice())
    expect(doc.getPageCount()).toBe(3)
    expect(out.length).toBeGreaterThan(src.length)
  })
  it('supports header placement, right alignment and partial opacity', async () => {
    const src = await makePdf(2)
    const out = await addHeaderFooter(buf(src), { text: '{filename}', placement: 'header', align: 'right', fontSize: 12, opacity: 0.5, filename: 'doc', date: '16 Nov 2026' })
    expect((await PDFDocument.load(out.slice())).getPageCount()).toBe(2)
  })
  it('rejects empty stamp text', async () => {
    const src = await makePdf(1)
    await expect(addHeaderFooter(buf(src), { text: '  ', placement: 'footer', align: 'left', fontSize: 10, opacity: 1, filename: 'doc', date: 'today' })).rejects.toThrow('Enter the text to stamp')
  })
  it('rejects an out-of-range font size', async () => {
    const src = await makePdf(1)
    await expect(addHeaderFooter(buf(src), { text: 'Hi', placement: 'footer', align: 'left', fontSize: 100, opacity: 1, filename: 'doc', date: 'today' })).rejects.toThrow('font size between 6 and 48')
  })
})
