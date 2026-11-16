import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildPptx, fitRect, imageDataUrl, type SlideImage } from './process'
import { PNG_1X1 } from '../test-fixtures'

function slide(widthPt = 612, heightPt = 792): SlideImage {
  return { dataUrl: imageDataUrl(PNG_1X1, 'image/png'), widthPt, heightPt }
}

describe('imageDataUrl', () => {
  it('encodes bytes as a base64 data URL', () => {
    const url = imageDataUrl(new Uint8Array([104, 105]), 'image/png')
    expect(url).toBe('data:image/png;base64,aGk=')
  })
})

describe('fitRect', () => {
  it('fills the slide exactly when the page matches it', () => {
    expect(fitRect(612, 792, 8.5, 11)).toEqual({ x: 0, y: 0, w: 8.5, h: 11 })
  })
  it('centres a wider page with space above and below', () => {
    const rect = fitRect(792, 612, 8.5, 11)
    expect(rect.w).toBeCloseTo(8.5)
    expect(rect.x).toBeCloseTo(0)
    expect(rect.y).toBeGreaterThan(0)
    expect(rect.y + rect.h).toBeLessThan(11)
  })
})

describe('buildPptx', () => {
  it('produces a pptx with one slide XML per page image', async () => {
    const data = await buildPptx([slide(), slide(), slide()])
    const zip = await JSZip.loadAsync(data)
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    expect(slides.sort()).toEqual(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide3.xml'])
    const media = Object.keys(zip.files).filter((f) => f.startsWith('ppt/media/'))
    expect(media.length).toBeGreaterThanOrEqual(1)
    const first = await zip.file('ppt/slides/slide1.xml')!.async('string')
    expect(first).toContain('<p:pic>')
  })

  it('sizes the deck from the first page', async () => {
    const data = await buildPptx([slide(595, 842)])
    const zip = await JSZip.loadAsync(data)
    const presXml = await zip.file('ppt/presentation.xml')!.async('string')
    // A4 in EMU: 595pt = 8.26in, 842pt = 11.69in (914400 EMU per inch)
    expect(presXml).toContain(`cx="${Math.round((595 / 72) * 914400)}"`)
    expect(presXml).toContain(`cy="${Math.round((842 / 72) * 914400)}"`)
  })

  it('rejects an empty page list', async () => {
    await expect(buildPptx([])).rejects.toThrow('no pages')
  })
})
