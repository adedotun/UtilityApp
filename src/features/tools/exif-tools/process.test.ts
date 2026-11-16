import { describe, expect, it } from 'vitest'
import piexif from 'piexifjs'
import { parsePhotoData, pngTextChunks, scrubPhoto } from './process'
import { createNodeEngine } from '../image/node-engine'
import { makeTestImage } from '../image/test-images'

const engine = createNodeEngine()

/** A JPEG with known EXIF planted by piexifjs: camera, software, date, and GPS at 51.5, -0.125. */
function jpegWithExif(): Uint8Array {
  const base = makeTestImage(320, 240, 'jpeg')
  const exifStr = piexif.dump({
    '0th': {
      [piexif.ImageIFD.Make]: 'TestCam',
      [piexif.ImageIFD.Model]: 'Spike 3000',
      [piexif.ImageIFD.Software]: 'Unit Test Editor',
    },
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: '2024:03:15 10:30:00' },
    GPS: {
      [piexif.GPSIFD.GPSLatitudeRef]: 'N',
      [piexif.GPSIFD.GPSLatitude]: [[51, 1], [30, 1], [0, 1]],
      [piexif.GPSIFD.GPSLongitudeRef]: 'W',
      [piexif.GPSIFD.GPSLongitude]: [[0, 1], [7, 1], [30, 1]],
    },
  })
  const inserted = piexif.insert(exifStr, Buffer.from(base).toString('binary'))
  return new Uint8Array(Buffer.from(inserted, 'binary'))
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A PNG with one tEXt chunk planted before the IEND chunk. */
function pngWithTextChunk(): Uint8Array {
  const base = makeTestImage(200, 120, 'png')
  const keyword = new TextEncoder().encode('Comment')
  const value = new TextEncoder().encode('Planted in a unit test')
  const body = new Uint8Array(keyword.length + 1 + value.length)
  body.set(keyword, 0)
  body.set(value, keyword.length + 1)
  const type = new TextEncoder().encode('tEXt')
  const chunk = new Uint8Array(12 + body.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, body.length)
  chunk.set(type, 4)
  chunk.set(body, 8)
  const crcInput = new Uint8Array(4 + body.length)
  crcInput.set(type, 0)
  crcInput.set(body, 4)
  view.setUint32(8 + body.length, crc32(crcInput))
  const out = new Uint8Array(base.length + chunk.length)
  out.set(base.slice(0, base.length - 12), 0)
  out.set(chunk, base.length - 12)
  out.set(base.slice(base.length - 12), base.length - 12 + chunk.length)
  return out
}

describe('parsePhotoData', () => {
  it('reports the planted camera, software, date and GPS values', async () => {
    const report = await parsePhotoData(jpegWithExif())
    expect(report.hasMetadata).toBe(true)
    const byLabel = new Map(report.entries.map((e) => [e.label, e.value]))
    expect(byLabel.get('Camera make')).toBe('TestCam')
    expect(byLabel.get('Camera model')).toBe('Spike 3000')
    expect(byLabel.get('Software')).toBe('Unit Test Editor')
    expect(byLabel.get('Date taken')).toContain('2024-03-15 10:30:00')
    expect(report.gps).not.toBeNull()
    expect(report.gps!.latitude).toBeCloseTo(51.5, 6)
    expect(report.gps!.longitude).toBeCloseTo(-0.125, 6)
    expect(report.found).toContain('GPS location')
    expect(report.found).toContain('camera and lens details')
  })

  it('says plainly when a photo has no metadata', async () => {
    const plain = makeTestImage(200, 120, 'jpeg')
    const report = await parsePhotoData(plain)
    expect(report.hasMetadata).toBe(false)
    expect(report.entries).toEqual([])
    expect(report.gps).toBeNull()
  })

  it('rejects a file that is not a JPEG or PNG', async () => {
    await expect(parsePhotoData(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow('does not look like a JPEG or PNG')
  })

  it('finds text chunks stored in a PNG', async () => {
    const png = pngWithTextChunk()
    const chunks = await pngTextChunks(png)
    expect(chunks).toEqual([{ keyword: 'Comment', value: 'Planted in a unit test' }])
    const report = await parsePhotoData(png)
    expect(report.hasMetadata).toBe(true)
    expect(report.entries.some((e) => e.value === 'Planted in a unit test')).toBe(true)
    expect(report.found.some((f) => f.includes('text chunk'))).toBe(true)
  })
})

describe('scrubPhoto', () => {
  it('removes every planted EXIF value; the scrubbed file parses back clean', async () => {
    const scrubbed = await scrubPhoto(jpegWithExif(), engine, 'image/jpeg', 'jpeg')
    const report = await parsePhotoData(scrubbed)
    expect(report.hasMetadata).toBe(false)
    expect(report.entries).toEqual([])
    expect(report.gps).toBeNull()
    const decoded = await engine.decode(scrubbed, 'image/jpeg')
    expect(decoded.width).toBe(320)
    expect(decoded.height).toBe(240)
  })

  it('removes PNG text chunks; the scrubbed PNG parses back clean', async () => {
    const scrubbed = await scrubPhoto(pngWithTextChunk(), engine, 'image/png', 'png')
    expect(await pngTextChunks(scrubbed)).toEqual([])
    const report = await parsePhotoData(scrubbed)
    expect(report.hasMetadata).toBe(false)
  })
})
