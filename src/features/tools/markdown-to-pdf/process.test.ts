import { describe, expect, it } from 'vitest'
import { extractPdfText } from '../pdf-to-text/process'
import { htmlToBlocks, markdownToPdf } from './process'

// PDF.js uses Uint8Array.prototype.toHex, which this Node runtime does not
// provide (current browsers do). Polyfill it for the test environment only.
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}

const MD = `# Release Notes

Everything in this version, in short:

- Faster imports
- **Bold claim** about exports
- Fewer crashes

> A quote worth keeping.

\`\`\`
const x = 1
\`\`\`
`

describe('htmlToBlocks', () => {
  it('structures headings, list items, quotes and code', async () => {
    const { marked } = await import('marked')
    const blocks = htmlToBlocks(await marked.parse(MD))
    const kinds = blocks.map((b) => b.type)
    expect(kinds).toContain('heading')
    expect(kinds.filter((k) => k === 'listItem')).toHaveLength(3)
    expect(kinds).toContain('quote')
    expect(kinds).toContain('code')
    const heading = blocks.find((b) => b.type === 'heading')
    expect(heading && heading.type === 'heading' && heading.level).toBe(1)
  })
})

describe('markdownToPdf', () => {
  it('produces a PDF whose text holds the heading and the list', async () => {
    const pdf = await markdownToPdf(MD, 'Release Notes')
    const { text } = await extractPdfText(pdf.slice().buffer as ArrayBuffer)
    expect(text).toContain('Release Notes')
    expect(text).toContain('Faster imports')
    expect(text).toContain('Bold claim')
    expect(text).toContain('Fewer crashes')
    expect(text).toContain('A quote worth keeping.')
    expect(text).toContain('const x = 1')
  })

  it('rejects empty Markdown', async () => {
    await expect(markdownToPdf('   \n ', 'Empty')).rejects.toThrow(/no Markdown text/)
  })
})
