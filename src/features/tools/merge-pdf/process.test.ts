import { describe, expect, it } from 'vitest'
import { mergePdfs } from './process'
import { buf, makePdf, pageWidths } from '../test-fixtures'

describe('mergePdfs', () => {
  it('combines pages in file order', async () => {
    const a = await makePdf(2); const b = await makePdf(1)
    const out = await mergePdfs([buf(a), buf(b)])
    expect(await pageWidths(out)).toEqual([400, 420, 400])
  })
  it('rejects a single file', async () => {
    const a = await makePdf(1)
    await expect(mergePdfs([buf(a)])).rejects.toThrow('at least two')
  })
})
