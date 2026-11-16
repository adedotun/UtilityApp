import { describe, expect, it } from 'vitest'
import { deletePages } from './process'
import { buf, makePdf, pageWidths } from '../test-fixtures'

describe('deletePages', () => {
  it('removes the selected pages and keeps the rest in document order', async () => {
    const src = await makePdf(4)
    const out = await deletePages(buf(src), [2, 4])
    expect(await pageWidths(out)).toEqual([400, 440])
  })
  it('keeps a single remaining page', async () => {
    const src = await makePdf(3)
    const out = await deletePages(buf(src), [1, 3])
    expect(await pageWidths(out)).toEqual([420])
  })
  it('rejects an empty selection', async () => {
    const src = await makePdf(2)
    await expect(deletePages(buf(src), [])).rejects.toThrow('at least one page')
  })
  it('rejects deleting every page', async () => {
    const src = await makePdf(3)
    await expect(deletePages(buf(src), [1, 2, 3])).rejects.toThrow('keep at least one page')
  })
  it('rejects a page outside the document', async () => {
    const src = await makePdf(2)
    await expect(deletePages(buf(src), [5])).rejects.toThrow('outside this document')
  })
})
