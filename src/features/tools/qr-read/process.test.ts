import { describe, expect, it } from 'vitest'
import { readQrCode } from './process'
import { generateQrPng } from '../qr-generate/process'
import { createNodeEngine } from '../image/node-engine'
import { makeTestImage } from '../image/test-images'

const engine = createNodeEngine()

describe('readQrCode', () => {
  it('decodes a generated QR image back to its payload', async () => {
    const png = await generateQrPng(engine, 'https://example.com/hello', 512)
    const result = await readQrCode(engine, png, 'image/png')
    expect(result).not.toBeNull()
    expect(result!.text).toBe('https://example.com/hello')
    expect(result!.isUrl).toBe(true)
  })

  it('flags plain text as not a URL', async () => {
    const png = await generateQrPng(engine, 'Meet at the library at 6', 256)
    const result = await readQrCode(engine, png, 'image/png')
    expect(result!.text).toBe('Meet at the library at 6')
    expect(result!.isUrl).toBe(false)
  })

  it('returns null for an ordinary image with no code in it', async () => {
    const photo = makeTestImage(320, 200, 'png')
    expect(await readQrCode(engine, photo, 'image/png')).toBeNull()
  })
})
