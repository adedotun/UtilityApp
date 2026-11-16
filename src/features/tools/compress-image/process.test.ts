import { describe, expect, it } from 'vitest'
import { compressImage } from './process'
import { createNodeEngine } from '../image/node-engine'
import { makeTestImage } from '../image/test-images'
import { PNG_1X1 } from '../test-fixtures'

const engine = createNodeEngine()

describe('compressImage', () => {
  it('shrinks a textured PNG by re-encoding as JPEG', async () => {
    const png = makeTestImage(600, 400, 'png')
    const result = await compressImage(png, engine, 'image/png', 'png', { quality: 0.5, maxDimension: null, format: 'jpeg' })
    expect(result.returnedOriginal).toBe(false)
    expect(result.format).toBe('jpeg')
    expect(result.outputSize).toBeLessThan(result.originalSize)
    expect(result.data[0]).toBe(0xff)
    expect(result.data[1]).toBe(0xd8)
  })

  it('returns the original when re-encoding is not smaller, and says so', async () => {
    const result = await compressImage(PNG_1X1, engine, 'image/png', 'png', { quality: 0.5, maxDimension: null, format: 'jpeg' })
    expect(result.returnedOriginal).toBe(true)
    expect(result.format).toBe('png')
    expect(result.data).toEqual(PNG_1X1)
    expect(result.outputSize).toBe(result.originalSize)
  })

  it('caps the longest side at the maximum dimension', async () => {
    const jpeg = makeTestImage(800, 600, 'jpeg')
    const result = await compressImage(jpeg, engine, 'image/jpeg', 'jpeg', { quality: 0.8, maxDimension: 400, format: 'keep' })
    expect(result.outWidth).toBe(400)
    expect(result.outHeight).toBe(300)
    const decoded = await engine.decode(result.data, 'image/jpeg')
    expect(decoded.width).toBe(400)
    expect(decoded.height).toBe(300)
  })

  it('keeps the format when asked, and honours a WebP request', async () => {
    const png = makeTestImage(240, 160, 'png')
    const kept = await compressImage(png, engine, 'image/png', 'png', { quality: 0.9, maxDimension: null, format: 'keep' })
    expect(kept.format).toBe('png')
    expect(Array.from(kept.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    const webp = await compressImage(png, engine, 'image/png', 'png', { quality: 0.6, maxDimension: null, format: 'webp' })
    if (!webp.returnedOriginal) {
      expect(new TextDecoder().decode(webp.data.slice(8, 12))).toBe('WEBP')
    }
  })
})
