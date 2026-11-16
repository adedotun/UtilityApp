import { describe, expect, it } from 'vitest'
import { convertImage, isHeicFile } from './process'
import { createNodeEngine } from '../image/node-engine'
import { makeTestImage } from '../image/test-images'

const engine = createNodeEngine()

describe('isHeicFile', () => {
  it('recognises HEIC and HEIF by extension and type', () => {
    expect(isHeicFile('IMG_4021.HEIC', '')).toBe(true)
    expect(isHeicFile('photo.heif', '')).toBe(true)
    expect(isHeicFile('photo.jpg', 'image/heic')).toBe(true)
    expect(isHeicFile('photo.jpg', 'image/jpeg')).toBe(false)
  })
})

describe('convertImage', () => {
  it('converts PNG to JPEG, keeping the dimensions', async () => {
    const png = makeTestImage(320, 200, 'png')
    const result = await convertImage(png, engine, 'image/png', 'jpeg')
    expect(result.format).toBe('jpeg')
    expect(result.width).toBe(320)
    expect(result.height).toBe(200)
    expect(result.data[0]).toBe(0xff)
    expect(result.data[1]).toBe(0xd8)
    const back = await engine.decode(result.data, 'image/jpeg')
    expect(back.width).toBe(320)
    expect(back.height).toBe(200)
  })

  it('converts JPEG to PNG and WebP', async () => {
    const jpeg = makeTestImage(200, 120, 'jpeg')
    const png = await convertImage(jpeg, engine, 'image/jpeg', 'png')
    expect(Array.from(png.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    const webp = await convertImage(jpeg, engine, 'image/jpeg', 'webp')
    expect(new TextDecoder().decode(webp.data.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(webp.data.slice(8, 12))).toBe('WEBP')
  })

  it('rejects bytes that are not a decodable image', async () => {
    await expect(convertImage(new Uint8Array([1, 2, 3, 4]), engine, 'image/png', 'jpeg')).rejects.toThrow()
  })
})
