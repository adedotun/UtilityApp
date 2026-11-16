import { describe, expect, it } from 'vitest'
import { extractPages } from './process'
import { buf, makePdf, pageWidths } from '../test-fixtures'

describe('extractPages', () => {
  it('extracts selected pages in document order', async () => {
    const src = await makePdf(4)
    const out = await extractPages(buf(src), [3, 1])
    expect(await pageWidths(out)).toEqual([400, 440])
  })
  it('rejects an empty selection', async () => {
    const src = await makePdf(2)
    await expect(extractPages(buf(src), [])).rejects.toThrow('at least one page')
  })
})
