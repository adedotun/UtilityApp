import { describe, expect, it } from 'vitest'
import { readMetadata, setMetadata } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('metadata', () => {
  it('reads existing metadata', async () => {
    const src = await makePdf(2, { title: 'Original title', author: 'Ada' })
    const meta = await readMetadata(buf(src))
    expect(meta.title).toBe('Original title')
    expect(meta.author).toBe('Ada')
    expect(meta.pageCount).toBe(2)
  })
  it('round trips edits', async () => {
    const src = await makePdf(1)
    const out = await setMetadata(buf(src), { title: 'New title', author: 'Grace', subject: 'Testing', keywords: 'pdf, qa' })
    const meta = await readMetadata(out.slice())
    expect(meta.title).toBe('New title')
    expect(meta.author).toBe('Grace')
    expect(meta.subject).toBe('Testing')
    expect(meta.keywords).toContain('pdf')
  })
})
