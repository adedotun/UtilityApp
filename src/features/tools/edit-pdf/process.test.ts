import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { applyEdits, hexToRgb } from './process'
import { PNG_1X1, buf, makePdf } from '../test-fixtures'

describe('hexToRgb', () => {
  it('parses colours', () => {
    const red = hexToRgb('#ff0000')
    expect(red.red).toBe(1); expect(red.green).toBe(0)
  })
})
describe('applyEdits', () => {
  it('applies one of each edit kind', async () => {
    const src = await makePdf(1)
    const base = { page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.1, color: '#ff0000', opacity: 0.5 }
    const out = await applyEdits(buf(src), [
      { ...base, kind: 'highlight' },
      { ...base, kind: 'redact', color: '#000000', opacity: 1 },
      { ...base, kind: 'rect' },
      { ...base, kind: 'ellipse' },
      { ...base, kind: 'line', points: [{ x: 0.1, y: 0.5 }, { x: 0.4, y: 0.6 }] },
      { ...base, kind: 'draw', points: [{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.25 }, { x: 0.3, y: 0.2 }] },
      { ...base, kind: 'text', text: 'Note', size: 12 },
      { ...base, kind: 'image', png: PNG_1X1 },
    ])
    expect((await PDFDocument.load(out.slice())).getPageCount()).toBe(1)
    expect(out.length).toBeGreaterThan(src.length)
  })
  it('rejects no edits', async () => {
    const src = await makePdf(1)
    await expect(applyEdits(buf(src), [])).rejects.toThrow('at least one edit')
  })
})
