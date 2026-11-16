import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { imageKind, imagesToPdf } from './process'
import { PNG_1X1 } from '../test-fixtures'

describe('imageKind', () => {
  it('detects png and jpeg', () => {
    expect(imageKind('a.png', '')).toBe('png')
    expect(imageKind('a.jpg', '')).toBe('jpg')
    expect(imageKind('a.gif', 'image/gif')).toBeNull()
  })
})
describe('imagesToPdf', () => {
  it('creates one A4 page per image', async () => {
    const out = await imagesToPdf([{ data: PNG_1X1, kind: 'png' }, { data: PNG_1X1, kind: 'png' }], 'a4', 'portrait')
    const doc = await PDFDocument.load(out.slice())
    expect(doc.getPageCount()).toBe(2)
    const size = doc.getPage(0).getSize()
    expect(Math.round(size.width)).toBe(595)
    expect(Math.round(size.height)).toBe(842)
  })
  it('fit size uses the image dimensions', async () => {
    const out = await imagesToPdf([{ data: PNG_1X1, kind: 'png' }], 'fit', 'auto')
    const size = (await PDFDocument.load(out.slice())).getPage(0).getSize()
    expect(size.width).toBe(1)
    expect(size.height).toBe(1)
  })
})
