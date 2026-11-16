import { describe, expect, it } from 'vitest'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import JSZip from 'jszip'
import { loadMammoth, mammothInput } from '../word/mammoth-input'
import { mergeWordDocs } from './process'

async function fixtureDocx(title: string, body: string, bullet: string): Promise<ArrayBuffer> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] }),
        new Paragraph({ children: [new TextRun(body)] }),
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun(bullet)] }),
      ],
    }],
  })
  const blob = await Packer.toBlob(doc)
  return blob.arrayBuffer()
}

describe('mergeWordDocs', () => {
  it('merges two documents with both texts in order', async () => {
    const first = await fixtureDocx('First Report', 'Apples are great.', 'Alpha item')
    const second = await fixtureDocx('Second Report', 'Bananas are yellow.', 'Beta item')
    const merged = await mergeWordDocs([first, second])

    const zip = await JSZip.loadAsync(merged.slice())
    expect(zip.file('word/document.xml')).toBeTruthy()

    const mammoth = await loadMammoth()
    const { value: text } = await mammoth.extractRawText(mammothInput(merged.slice().buffer as ArrayBuffer))
    const i1 = text.indexOf('First Report')
    const i2 = text.indexOf('Second Report')
    expect(i1).toBeGreaterThanOrEqual(0)
    expect(i2).toBeGreaterThan(i1)
    expect(text).toContain('Apples are great.')
    expect(text).toContain('Bananas are yellow.')
    expect(text).toContain('Alpha item')
    expect(text).toContain('Beta item')
  })

  it('needs at least two documents', async () => {
    const only = await fixtureDocx('Solo', 'Alone.', 'One')
    await expect(mergeWordDocs([only])).rejects.toThrow(/at least two/)
  })

  it('names a bad input instead of failing cryptically', async () => {
    const good = await fixtureDocx('Good', 'Fine.', 'One')
    const junk = new TextEncoder().encode('not a document').buffer as ArrayBuffer
    await expect(mergeWordDocs([good, junk])).rejects.toThrow(/Document 2 could not be read/)
  })
})
