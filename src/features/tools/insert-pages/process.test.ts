import { describe, expect, it } from 'vitest'
import { insertBlankPages, insertIndex, insertPdfPages, parsePageList } from './process'
import { buf, makePdf, pageWidths } from '../test-fixtures'

describe('insertIndex', () => {
  it('maps start, end and after to output indexes', () => {
    expect(insertIndex({ at: 'start' }, 3)).toBe(0)
    expect(insertIndex({ at: 'end' }, 3)).toBe(3)
    expect(insertIndex({ at: 'after', page: 2 }, 3)).toBe(2)
  })
  it('rejects an after page outside the document', () => {
    expect(() => insertIndex({ at: 'after', page: 4 }, 3)).toThrow('between 1 and 3')
    expect(() => insertIndex({ at: 'after', page: 0 }, 3)).toThrow('between 1 and 3')
  })
})

describe('parsePageList', () => {
  it('treats blank input as every page', () => {
    expect(parsePageList('', 3)).toEqual([1, 2, 3])
    expect(parsePageList('   ', 2)).toEqual([1, 2])
  })
  it('parses singles, ranges and mixtures, sorted and unique', () => {
    expect(parsePageList('5, 1-3, 3', 6)).toEqual([1, 2, 3, 5])
  })
  it('rejects bad input with a plain message', () => {
    expect(() => parsePageList('7', 3)).toThrow('outside this document')
    expect(() => parsePageList('3-1', 5)).toThrow('not a valid page range')
    expect(() => parsePageList('abc', 5)).toThrow('not a page number or range')
  })
})

describe('insertBlankPages', () => {
  it('inserts after a page, sized to match that page', async () => {
    const src = await makePdf(3) // widths 400, 420, 440
    const out = await insertBlankPages(buf(src), { at: 'after', page: 1 }, 1)
    expect(await pageWidths(out)).toEqual([400, 400, 420, 440])
  })
  it('inserts at the start using the first page size', async () => {
    const src = await makePdf(3)
    const out = await insertBlankPages(buf(src), { at: 'start' }, 2)
    expect(await pageWidths(out)).toEqual([400, 400, 400, 420, 440])
  })
  it('appends at the end', async () => {
    const src = await makePdf(2)
    const out = await insertBlankPages(buf(src), { at: 'end' }, 1)
    expect(await pageWidths(out)).toEqual([400, 420, 420])
  })
  it('rejects a zero count', async () => {
    const src = await makePdf(1)
    await expect(insertBlankPages(buf(src), { at: 'end' }, 0)).rejects.toThrow('between 1 and 100')
  })
})

describe('insertPdfPages', () => {
  it('inserts every page of the second PDF at the chosen point', async () => {
    const main = await makePdf(3) // 400, 420, 440
    const source = await makePdf(2) // 400, 420
    const { data, inserted } = await insertPdfPages(buf(main), buf(source), { at: 'after', page: 2 })
    expect(inserted).toBe(2)
    expect(await pageWidths(data)).toEqual([400, 420, 400, 420, 440])
  })
  it('inserts only the listed pages', async () => {
    const main = await makePdf(1) // 400
    const source = await makePdf(3) // 400, 420, 440
    const { data, inserted } = await insertPdfPages(buf(main), buf(source), { at: 'end' }, '3, 1')
    expect(inserted).toBe(2)
    expect(await pageWidths(data)).toEqual([400, 400, 440])
  })
  it('rejects a second file that is not a PDF', async () => {
    const main = await makePdf(1)
    await expect(insertPdfPages(buf(main), buf(new Uint8Array([1, 2, 3])), { at: 'end' })).rejects.toThrow('second file could not be read')
  })
})
