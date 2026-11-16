import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { pageImageName, zipImages } from './process'

describe('pdf to images helpers', () => {
  it('names pages with padding', () => {
    expect(pageImageName(0, 12, 'png')).toBe('page-01.png')
    expect(pageImageName(11, 12, 'jpeg')).toBe('page-12.jpg')
  })
  it('zips page images', async () => {
    const zipBlob = await zipImages([
      { name: 'page-1.png', data: new Blob(['a'], { type: 'image/png' }) },
      { name: 'page-2.png', data: new Blob(['b'], { type: 'image/png' }) },
    ])
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
    expect(Object.keys(zip.files)).toEqual(['page-1.png', 'page-2.png'])
  })
})
