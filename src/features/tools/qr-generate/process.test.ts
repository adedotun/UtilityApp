import { describe, expect, it } from 'vitest'
import jsQR from 'jsqr'
import { generateQrPng, qrModules } from './process'
import { createNodeEngine } from '../image/node-engine'

const engine = createNodeEngine()
const PAYLOAD = 'https://example.com/hello'

/** Decodes a PNG through the Node canvas engine and jsQR, as a reader would. */
async function decodePng(png: Uint8Array): Promise<string | null> {
  const decoded = await engine.decode(png, 'image/png')
  const canvas = engine.createCanvas(decoded.width, decoded.height)
  canvas.context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height)
  const pixels = canvas.context.getImageData(0, 0, decoded.width, decoded.height)
  const code = jsQR(new Uint8ClampedArray(pixels.data), decoded.width, decoded.height)
  return code ? code.data : null
}

describe('qrModules', () => {
  it('builds a square grid for a short string', () => {
    const matrix = qrModules(PAYLOAD)
    expect(matrix.data.length).toBe(matrix.size * matrix.size)
    // The finder pattern's corner module is always dark.
    expect(matrix.data[0]).toBe(1)
  })

  it('rejects empty text and text too long for one code', () => {
    expect(() => qrModules('   ')).toThrow('Enter some text')
    expect(() => qrModules('a'.repeat(5000))).toThrow('too long')
  })
})

describe('generateQrPng', () => {
  it('produces a PNG that jsQR decodes back to the payload', async () => {
    const png = await generateQrPng(engine, PAYLOAD, 512)
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(await decodePng(png)).toBe(PAYLOAD)
  })

  it('round-trips plain text as well as URLs', async () => {
    const png = await generateQrPng(engine, 'Meet at the library at 6', 256)
    expect(await decodePng(png)).toBe('Meet at the library at 6')
  })
})
