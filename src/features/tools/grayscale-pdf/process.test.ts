import { describe, expect, it } from 'vitest'
import { PDFDocument, rgb } from 'pdf-lib'
import { createCanvas, Path2D } from '@napi-rs/canvas'
import { buildGrayscalePdf, grayscalePixels, luminance, type PixelImage } from './process'
import { pdfjsLib } from '../../../lib/pdfjs'
import { buf } from '../test-fixtures'

// Test-environment polyfills (same set as the remove-blank-pages tests).
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
const g = globalThis as { Path2D?: unknown }
if (!g.Path2D) g.Path2D = Path2D

function resolveWorkerForNode(): void {
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${process.cwd()}${src}`
  }
}

describe('grayscalePixels', () => {
  it('turns every pixel into R = G = B at its luminance, keeping alpha', () => {
    const img: PixelImage = {
      width: 4,
      height: 1,
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        0, 255, 0, 128,
        0, 0, 255, 255,
        255, 255, 255, 255,
      ]),
    }
    grayscalePixels(img)
    expect([img.data[0], img.data[1], img.data[2]]).toEqual([54, 54, 54])
    expect([img.data[4], img.data[5], img.data[6]]).toEqual([182, 182, 182])
    expect([img.data[8], img.data[9], img.data[10]]).toEqual([18, 18, 18])
    expect([img.data[12], img.data[13], img.data[14]]).toEqual([255, 255, 255])
    expect(img.data[7]).toBe(128)
    expect(luminance(255, 0, 0)).toBe(54)
  })
})

async function makeColourPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const p1 = doc.addPage([612, 792])
  p1.drawRectangle({ x: 100, y: 400, width: 300, height: 200, color: rgb(0.85, 0.2, 0.2) })
  const p2 = doc.addPage([612, 792])
  p2.drawRectangle({ x: 100, y: 400, width: 300, height: 200, color: rgb(0.15, 0.35, 0.9) })
  return doc.save()
}

interface RenderedPixels { pixels: PixelImage; widthPt: number; heightPt: number }

async function renderPagePixels(doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>, pageNum: number, scale: number): Promise<RenderedPixels> {
  const page = await doc.getPage(pageNum)
  const pt = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport } as never).promise
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { pixels: { data: image.data, width: image.width, height: image.height }, widthPt: pt.width, heightPt: pt.height }
}

function sampleAt(img: PixelImage, fx: number, fy: number): [number, number, number] {
  const x = Math.floor(img.width * fx)
  const y = Math.floor(img.height * fy)
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}

describe('grayscale conversion end to end', () => {
  it('produces a same-length PDF whose rendered pages are truly gray', async () => {
    resolveWorkerForNode()
    const src = await makeColourPdf()
    const srcDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf(src).slice(0)) }).promise
    const pages = []
    for (let p = 1; p <= srcDoc.numPages; p++) {
      const rendered = await renderPagePixels(srcDoc, p, 2)
      const before = sampleAt(rendered.pixels, 0.4, 0.35)
      expect(Math.abs(before[0] - before[2])).toBeGreaterThan(50) // the fixture really is coloured
      grayscalePixels(rendered.pixels)
      const canvas = createCanvas(rendered.pixels.width, rendered.pixels.height)
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(rendered.pixels.width, rendered.pixels.height)
      imageData.data.set(rendered.pixels.data)
      ctx.putImageData(imageData, 0, 0)
      pages.push({
        jpeg: new Uint8Array(canvas.toBuffer('image/jpeg')),
        widthPt: rendered.widthPt,
        heightPt: rendered.heightPt,
      })
    }
    const out = await buildGrayscalePdf(pages)
    expect((await PDFDocument.load(out.slice())).getPageCount()).toBe(2)

    const outDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf(out).slice(0)) }).promise
    const expected = [luminance(217, 51, 51), luminance(38, 89, 230)]
    for (let p = 1; p <= 2; p++) {
      const rendered = await renderPagePixels(outDoc, p, 2)
      const [r, gg, b] = sampleAt(rendered.pixels, 0.4, 0.35)
      // JPEG encoding shifts values slightly, but the channels must agree.
      expect(Math.max(r, gg, b) - Math.min(r, gg, b)).toBeLessThanOrEqual(6)
      expect(Math.abs(r - expected[p - 1])).toBeLessThanOrEqual(14)
    }
  })

  it('refuses to build from zero rendered pages', async () => {
    await expect(buildGrayscalePdf([])).rejects.toThrow('nothing to convert')
  })
})
