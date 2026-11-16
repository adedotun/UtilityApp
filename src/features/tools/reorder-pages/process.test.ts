import { describe, expect, it } from 'vitest'
import { reorderPages } from './process'
import { buf, makePdf, pageWidths } from '../test-fixtures'

describe('reorderPages', () => {
  it('applies the new order', async () => {
    const src = await makePdf(3)
    const out = await reorderPages(buf(src), [3, 1, 2])
    expect(await pageWidths(out)).toEqual([440, 400, 420])
  })
  it('rejects an order missing a page', async () => {
    const src = await makePdf(3)
    await expect(reorderPages(buf(src), [1, 2])).rejects.toThrow('every page exactly once')
  })
})
