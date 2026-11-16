import { describe, expect, it } from 'vitest'
import { resizeImage, targetSize } from './process'
import { createNodeEngine } from '../image/node-engine'
import { makeTestImage } from '../image/test-images'

const engine = createNodeEngine()

describe('targetSize', () => {
  it('scales by percentage', () => {
    expect(targetSize(800, 600, { mode: 'percent', percent: 50 })).toEqual({ width: 400, height: 300 })
    expect(targetSize(801, 601, { mode: 'percent', percent: 50 })).toEqual({ width: 401, height: 301 })
  })

  it('derives the missing side in pixel mode, keeping proportions', () => {
    expect(targetSize(800, 600, { mode: 'pixels', width: 200, height: null })).toEqual({ width: 200, height: 150 })
    expect(targetSize(800, 600, { mode: 'pixels', width: null, height: 75 })).toEqual({ width: 100, height: 75 })
  })

  it('uses exact dimensions when both sides are given', () => {
    expect(targetSize(800, 600, { mode: 'pixels', width: 100, height: 100 })).toEqual({ width: 100, height: 100 })
  })

  it('rejects empty and invalid specs', () => {
    expect(() => targetSize(800, 600, { mode: 'pixels', width: null, height: null })).toThrow('Enter a width, a height, or both.')
    expect(() => targetSize(800, 600, { mode: 'percent', percent: 0 })).toThrow('Enter a percentage above zero.')
    expect(() => targetSize(800, 600, { mode: 'pixels', width: -5, height: null })).toThrow('Enter a width above zero.')
  })
})

describe('resizeImage', () => {
  it('resizes a PNG to half size and keeps the format', async () => {
    const png = makeTestImage(480, 320, 'png')
    const result = await resizeImage(png, engine, 'image/png', 'png', { mode: 'percent', percent: 50 })
    expect(result.outWidth).toBe(240)
    expect(result.outHeight).toBe(160)
    expect(Array.from(result.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    const decoded = await engine.decode(result.data, 'image/png')
    expect(decoded.width).toBe(240)
    expect(decoded.height).toBe(160)
  })

  it('resizes a JPEG to a target width, deriving the height', async () => {
    const jpeg = makeTestImage(640, 480, 'jpeg')
    const result = await resizeImage(jpeg, engine, 'image/jpeg', 'jpeg', { mode: 'pixels', width: 320, height: null })
    expect(result.outWidth).toBe(320)
    expect(result.outHeight).toBe(240)
    expect(result.data[0]).toBe(0xff)
    expect(result.data[1]).toBe(0xd8)
  })
})
