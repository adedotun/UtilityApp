import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import { extractedImageName, extractImages, pixelsToRgba } from './process'
import { buf, makePdf } from '../test-fixtures'

// Test-environment polyfills: PDF.js uses Uint8Array.prototype.toHex and the
// Map/WeakMap upsert helpers, which this Node runtime lacks (browsers have them).
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}
type UpsertProto = Record<string, unknown>
const upsertImpl = function (this: Map<unknown, unknown>, key: unknown, fn: (k: unknown) => unknown) { if (!this.has(key)) this.set(key, fn(key)); return this.get(key) }
const mapProto = Map.prototype as unknown as UpsertProto
if (typeof mapProto.getOrInsertComputed !== 'function') {
  mapProto.getOrInsertComputed = upsertImpl
  ;(WeakMap.prototype as unknown as UpsertProto).getOrInsertComputed = upsertImpl
}

describe('pixelsToRgba', () => {
  it('expands RGB data with a full alpha channel', () => {
    const rgba = pixelsToRgba({ width: 2, height: 1, kind: 2, data: new Uint8Array([10, 20, 30, 40, 50, 60]) })
    expect(Array.from(rgba!)).toEqual([10, 20, 30, 255, 40, 50, 60, 255])
  })

  it('passes RGBA data through', () => {
    const rgba = pixelsToRgba({ width: 1, height: 1, kind: 3, data: new Uint8Array([1, 2, 3, 4]) })
    expect(Array.from(rgba!)).toEqual([1, 2, 3, 4])
  })

  it('unpacks 1-bit grayscale, most significant bit first', () => {
    const rgba = pixelsToRgba({ width: 8, height: 1, kind: 1, data: new Uint8Array([0b10101010]) })
    const grays = Array.from({ length: 8 }, (_, i) => rgba![i * 4])
    expect(grays).toEqual([255, 0, 255, 0, 255, 0, 255, 0])
  })

  it('infers 8-bit grayscale when no kind is stated', () => {
    const rgba = pixelsToRgba({ width: 2, height: 1, data: new Uint8Array([7, 9]) })
    expect(Array.from(rgba!)).toEqual([7, 7, 7, 255, 9, 9, 9, 255])
  })

  it('returns null when the data does not match the dimensions', () => {
    expect(pixelsToRgba({ width: 4, height: 4, kind: 2, data: new Uint8Array([1, 2, 3]) })).toBeNull()
    expect(pixelsToRgba({ width: 4, height: 4, kind: 3 })).toBeNull()
  })
})

async function makeImagePdf(): Promise<Uint8Array> {
  // A 40x30 PNG: red field with a blue block in the top-left area.
  const canvas = createCanvas(40, 30)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#cc3300'
  ctx.fillRect(0, 0, 40, 30)
  ctx.fillStyle = '#0033cc'
  ctx.fillRect(5, 5, 10, 8)
  const pngBytes = await canvas.encode('png')

  const jpgCanvas = createCanvas(24, 18)
  const jctx = jpgCanvas.getContext('2d')
  jctx.fillStyle = '#228822'
  jctx.fillRect(0, 0, 24, 18)
  const jpgBytes = await jpgCanvas.encode('jpeg', 95)

  const doc = await PDFDocument.create()
  const png = await doc.embedPng(new Uint8Array(pngBytes))
  const page1 = doc.addPage([300, 300])
  page1.drawImage(png, { x: 20, y: 20, width: 200, height: 150 })
  const jpg = await doc.embedJpg(new Uint8Array(jpgBytes))
  const page2 = doc.addPage([300, 300])
  page2.drawImage(jpg, { x: 20, y: 20, width: 120, height: 90 })
  return doc.save()
}

describe('extractImages', () => {
  it('returns the embedded PNG with matching dimensions and pixels', async () => {
    const src = await makeImagePdf()
    const result = await extractImages(buf(src))
    expect(result.pageCount).toBe(2)
    expect(result.found).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.images).toHaveLength(2)

    const first = result.images[0]
    expect(first.page).toBe(1)
    expect(first.width).toBe(40)
    expect(first.height).toBe(30)
    const px = (x: number, y: number) => Array.from(first.rgba!.slice((y * first.width + x) * 4, (y * first.width + x) * 4 + 4))
    expect(px(0, 0)).toEqual([204, 51, 0, 255]) // #cc3300
    expect(px(10, 7)).toEqual([0, 51, 204, 255]) // #0033cc block

    const second = result.images[1]
    expect(second.page).toBe(2)
    expect(second.width).toBe(24)
    expect(second.height).toBe(18)
  })

  it('saves a repeated image only once', async () => {
    const canvas = createCanvas(10, 10)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#123456'
    ctx.fillRect(0, 0, 10, 10)
    const pngBytes = await canvas.encode('png')
    const doc = await PDFDocument.create()
    const png = await doc.embedPng(new Uint8Array(pngBytes))
    const page = doc.addPage([300, 300])
    page.drawImage(png, { x: 10, y: 10, width: 50, height: 50 })
    page.drawImage(png, { x: 100, y: 100, width: 50, height: 50 })
    const src = await doc.save()
    const result = await extractImages(buf(src))
    expect(result.images).toHaveLength(1)
    expect(result.duplicates).toBe(1)
  })

  it('rejects a PDF with no stored images', async () => {
    const src = await makePdf(2)
    await expect(extractImages(buf(src))).rejects.toThrow('No images were found')
  })
})

describe('extractedImageName', () => {
  it('pads numbers to the width of the total', () => {
    expect(extractedImageName(0, 3)).toBe('image-1.png')
    expect(extractedImageName(8, 12)).toBe('image-09.png')
  })
})
