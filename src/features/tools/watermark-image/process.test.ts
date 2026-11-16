import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { watermarkImage } from './process'
import { createNodeEngine } from '../image/node-engine'
import { makeTestImage } from '../image/test-images'

const engine = createNodeEngine()

/** The centre pixel of an image, as [r, g, b, a]. */
async function centrePixel(data: Uint8Array): Promise<number[]> {
  const img = await loadImage(Buffer.from(data))
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1)
  return Array.from(px.data)
}

describe('watermarkImage', () => {
  it('rejects empty watermark text', async () => {
    const png = makeTestImage(200, 120, 'png')
    await expect(watermarkImage(png, engine, 'image/png', 'png', { text: '  ', opacity: 0.5, position: 'center' })).rejects.toThrow('Enter the watermark text.')
  })

  it('changes the image where the watermark lands, keeping size and format', async () => {
    const png = makeTestImage(600, 400, 'png')
    const before = await centrePixel(png)
    const out = await watermarkImage(png, engine, 'image/png', 'png', { text: 'DRAFT', opacity: 0.9, position: 'center' })
    expect(out).not.toEqual(png)
    expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    const decoded = await engine.decode(out, 'image/png')
    expect(decoded.width).toBe(600)
    expect(decoded.height).toBe(400)
    const after = await centrePixel(out)
    expect(after).not.toEqual(before)
  })

  it('supports the diagonal, top and bottom positions on a JPEG', async () => {
    const jpeg = makeTestImage(480, 300, 'jpeg')
    for (const position of ['diagonal', 'top', 'bottom'] as const) {
      const out = await watermarkImage(jpeg, engine, 'image/jpeg', 'jpeg', { text: 'SAMPLE', opacity: 0.5, position })
      expect(out[0]).toBe(0xff)
      expect(out[1]).toBe(0xd8)
      expect(out).not.toEqual(jpeg)
    }
  })
})
