import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { addPageNumbers, formatPageNumber } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('formatPageNumber', () => {
  it('formats all variants', () => {
    expect(formatPageNumber('plain', 2, 9)).toBe('2')
    expect(formatPageNumber('page', 2, 9)).toBe('Page 2')
    expect(formatPageNumber('of-total', 2, 9)).toBe('2 / 9')
    expect(formatPageNumber('page-of-total', 2, 9)).toBe('Page 2 of 9')
  })
})
describe('addPageNumbers', () => {
  it('keeps the page count and adds content to every page', async () => {
    const src = await makePdf(3)
    const out = await addPageNumbers(buf(src), 'page-of-total', 'bottom-center', 1)
    const doc = await PDFDocument.load(out.slice())
    expect(doc.getPageCount()).toBe(3)
    expect(out.length).toBeGreaterThan(src.length)
  })
  it('respects a custom start number without throwing', async () => {
    const src = await makePdf(2)
    const out = await addPageNumbers(buf(src), 'plain', 'top-right', 5)
    expect((await PDFDocument.load(out.slice())).getPageCount()).toBe(2)
  })
})
