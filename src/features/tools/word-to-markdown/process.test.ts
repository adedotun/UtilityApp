import { describe, expect, it } from 'vitest'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { wordToMarkdown } from './process'

async function fixtureDocx(): Promise<ArrayBuffer> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Quarterly Report')] }),
        new Paragraph({ children: [new TextRun('Revenue grew '), new TextRun({ text: 'twelve percent', bold: true }), new TextRun(' this quarter.')] }),
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun('First finding')] }),
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun('Second finding')] }),
      ],
    }],
  })
  const blob = await Packer.toBlob(doc)
  return blob.arrayBuffer()
}

describe('wordToMarkdown', () => {
  it('converts headings, bold runs and bullet lists to Markdown, in order', async () => {
    const { markdown, html } = await wordToMarkdown(await fixtureDocx())
    expect(html).toContain('<h1>Quarterly Report</h1>')
    expect(markdown).toContain('# Quarterly Report')
    expect(markdown).toContain('**twelve percent**')
    expect(markdown).toMatch(/^-\s+First finding/m)
    expect(markdown).toMatch(/^-\s+Second finding/m)
    const order = ['# Quarterly Report', '**twelve percent**', 'First finding', 'Second finding'].map((s) => markdown.indexOf(s))
    expect(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]))).toBe(true)
  })

  it('rejects a file that is not a Word document', async () => {
    const junk = new TextEncoder().encode('this is not a docx').buffer as ArrayBuffer
    await expect(wordToMarkdown(junk)).rejects.toThrow(/could not be read as a Word document/)
  })
})
