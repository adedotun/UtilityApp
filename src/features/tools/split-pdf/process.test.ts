import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { groupFileName, parsePageRanges, planSplit, splitPdf, splitPdfGroups } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('parsePageRanges', () => {
  it('parses singles and ranges', () => { expect(parsePageRanges('1-3, 5', 10)).toEqual([1, 2, 3, 5]) })
  it('rejects out of range pages with a specific message', () => { expect(() => parsePageRanges('9-12', 10)).toThrow('page 10') })
  it('rejects garbage', () => { expect(() => parsePageRanges('abc', 10)).toThrow('not a valid') })
})
describe('planSplit', () => {
  it('plans every page', () => { expect(planSplit('all', 3, '', 2)).toHaveLength(3) })
  it('plans every N', () => { expect(planSplit('every-n', 5, '', 2).map((g) => g.length)).toEqual([2, 2, 1]) })
  it('plans ranges as one file per range', () => { expect(planSplit('ranges', 10, '1-3, 5-7', 2)).toEqual([[1, 2, 3], [5, 6, 7]]) })
})
describe('splitPdf', () => {
  it('splits into per page files', async () => {
    const src = await makePdf(3)
    const parts = await splitPdf(buf(src), 'all', '', 2)
    expect(parts).toHaveLength(3)
    for (const p of parts) { const d = await PDFDocument.load(p.data.slice()); expect(d.getPageCount()).toBe(1) }
  })
  it('splits by ranges', async () => {
    const src = await makePdf(6)
    const parts = await splitPdf(buf(src), 'ranges', '1-2, 4-6', 2)
    expect(parts.map((p) => p.name)).toEqual(['pages-1-2.pdf', 'pages-4-6.pdf'])
  })
})
describe('splitPdfGroups', () => {
  it('splits scattered groups and names them by their pages', async () => {
    const src = await makePdf(4)
    const parts = await splitPdfGroups(buf(src), [[1, 3], [2], [4]])
    expect(parts.map((p) => p.name)).toEqual(['pages-1-3.pdf', 'page-2.pdf', 'page-4.pdf'])
    const counts = await Promise.all(parts.map(async (p) => (await PDFDocument.load(p.data.slice())).getPageCount()))
    expect(counts).toEqual([2, 1, 1])
  })
  it('sorts pages within a group into document order', async () => {
    const src = await makePdf(3)
    const parts = await splitPdfGroups(buf(src), [[3, 1]])
    expect(parts[0].name).toBe('pages-1-3.pdf')
  })
  it('ignores empty groups and rejects an all-empty split', async () => {
    const src = await makePdf(2)
    const parts = await splitPdfGroups(buf(src), [[], [1, 2]])
    expect(parts).toHaveLength(1)
    await expect(splitPdfGroups(buf(src), [[]])).rejects.toThrow('at least one page')
  })
})
describe('groupFileName', () => {
  it('names singles, ranges and scattered groups honestly', () => {
    expect(groupFileName([5], 0)).toBe('page-5.pdf')
    expect(groupFileName([2, 3, 4], 0)).toBe('pages-2-4.pdf')
    expect(groupFileName([1, 3, 5], 0)).toBe('pages-1-3-5.pdf')
    expect(groupFileName([1, 3, 5, 7, 9, 11, 13, 15, 17], 1)).toBe('selected-pages-2.pdf')
  })
})
