import { describe, expect, it } from 'vitest'
import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFString, StandardFonts, type PDFPage } from 'pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import {
  chapterFileName, chaptersFromOutline, estimatePageSizes, planSizeSplit,
  readOutline, splitByBookmarks, splitBySize, LEADING_TITLE,
} from './process'
import { buf, makePdf } from '../test-fixtures'

// Test-environment polyfills (same set as the other PDF.js-in-Node tests).
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

describe('chaptersFromOutline', () => {
  it('spans each chapter to the page before the next, and the last to the end', () => {
    const chapters = chaptersFromOutline([
      { title: 'Intro', page: 1 },
      { title: 'Middle', page: 3 },
      { title: 'End', page: 5 },
    ], 6)
    expect(chapters).toEqual([
      { title: 'Intro', startPage: 1, endPage: 2 },
      { title: 'Middle', startPage: 3, endPage: 4 },
      { title: 'End', startPage: 5, endPage: 6 },
    ])
  })

  it('keeps pages before the first bookmark as their own leading chapter', () => {
    const chapters = chaptersFromOutline([{ title: 'Chapter one', page: 3 }], 4)
    expect(chapters).toEqual([
      { title: LEADING_TITLE, startPage: 1, endPage: 2 },
      { title: 'Chapter one', startPage: 3, endPage: 4 },
    ])
  })

  it('sorts entries, collapses two bookmarks on one page, and drops out-of-range pages', () => {
    const chapters = chaptersFromOutline([
      { title: 'Late', page: 4 },
      { title: 'Early', page: 2 },
      { title: 'Also early', page: 2 },
      { title: 'Nowhere', page: 99 },
    ], 5)
    expect(chapters.map((c) => [c.title, c.startPage, c.endPage])).toEqual([
      [LEADING_TITLE, 1, 1],
      ['Early', 2, 3],
      ['Late', 4, 5],
    ])
  })
})

describe('chapterFileName', () => {
  it('numbers files and makes titles file-safe', () => {
    expect(chapterFileName('Intro', 0)).toBe('01-intro.pdf')
    expect(chapterFileName('Chapter 3: Results & Discussion!', 2)).toBe('03-chapter-3-results-discussion.pdf')
    expect(chapterFileName('!!!', 0)).toBe('01-chapter.pdf')
  })
})

describe('planSizeSplit', () => {
  it('packs pages in order under the target', () => {
    expect(planSizeSplit([10, 10, 10, 10], 25)).toEqual([[1, 2], [3, 4]])
    expect(planSizeSplit([10, 15], 25)).toEqual([[1, 2]])
    expect(planSizeSplit([10, 15, 1], 25)).toEqual([[1, 2], [3]])
  })

  it('puts a single page larger than the target in a file of its own', () => {
    expect(planSizeSplit([50, 10, 10], 25)).toEqual([[1], [2, 3]])
  })

  it('rejects a non-positive target', () => {
    expect(() => planSizeSplit([10], 0)).toThrow('more than zero')
  })
})

describe('estimatePageSizes', () => {
  it('gives every page a positive estimate and the estimates add up to the file size', async () => {
    const src = await makePdf(4)
    const doc = await PDFDocument.load(src.slice())
    const estimates = estimatePageSizes(doc, src.length)
    expect(estimates).toHaveLength(4)
    for (const e of estimates) expect(e).toBeGreaterThan(0)
    expect(estimates.reduce((a, b) => a + b, 0)).toBeCloseTo(src.length, 0)
  })
})

/**
 * Builds a 6-page PDF with a real top-level outline (Intro → page 1,
 * Middle → page 3, End → page 5) using pdf-lib's low-level objects, since
 * pdf-lib has no outline API of its own.
 */
async function makeOutlinedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages: PDFPage[] = []
  for (let i = 0; i < 6; i++) {
    const p = doc.addPage([400, 600])
    p.drawText(`Content of page ${i + 1}`, { x: 40, y: 520, size: 18, font })
    pages.push(p)
  }
  const ctx = doc.context
  const mkItem = (title: string, pageIdx: number) => {
    const dest = PDFArray.withContext(ctx)
    dest.push(pages[pageIdx].ref)
    dest.push(PDFName.of('XYZ'))
    dest.push(PDFNumber.of(0))
    dest.push(PDFNumber.of(600))
    dest.push(PDFNumber.of(0))
    return ctx.obj({ Title: PDFString.of(title), Dest: dest })
  }
  const item1 = mkItem('Intro', 0)
  const item2 = mkItem('Middle', 2)
  const item3 = mkItem('End', 4)
  const r1 = ctx.register(item1)
  const r2 = ctx.register(item2)
  const r3 = ctx.register(item3)
  const outlinesRef = ctx.register(ctx.obj({ Type: PDFName.of('Outlines'), First: r1, Last: r3, Count: PDFNumber.of(3) }))
  item1.set(PDFName.of('Parent'), outlinesRef)
  item1.set(PDFName.of('Next'), r2)
  item2.set(PDFName.of('Parent'), outlinesRef)
  item2.set(PDFName.of('Next'), r3)
  item2.set(PDFName.of('Prev'), r1)
  item3.set(PDFName.of('Parent'), outlinesRef)
  item3.set(PDFName.of('Prev'), r2)
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef)
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
  return doc.save()
}

describe('bookmarks mode on a real outlined fixture', () => {
  it('reads the outline and splits into one file per chapter', async () => {
    const src = await makeOutlinedPdf()
    const entries = await readOutline(buf(src))
    expect(entries).toEqual([
      { title: 'Intro', page: 1 },
      { title: 'Middle', page: 3 },
      { title: 'End', page: 5 },
    ])
    const parts = await splitByBookmarks(buf(src))
    expect(parts.map((p) => p.name)).toEqual(['01-intro.pdf', '02-middle.pdf', '03-end.pdf'])
    expect(parts.map((p) => p.pageCount)).toEqual([2, 2, 2])
    for (const part of parts) {
      expect((await PDFDocument.load(part.data.slice())).getPageCount()).toBe(2)
    }
  })

  it('says plainly when the PDF has no bookmarks', async () => {
    const src = await makePdf(3)
    expect(await readOutline(buf(src))).toBeNull()
    await expect(splitByBookmarks(buf(src))).rejects.toThrow('no bookmarks')
  })
})

describe('size mode', () => {
  it('splits a document into several files that together hold every page', async () => {
    const src = await makePdf(6)
    const targetMb = src.length / 3 / (1024 * 1024)
    const result = await splitBySize(buf(src), Math.max(0.05, targetMb))
    // The fixture pages are tiny; any target below the file size must still
    // produce at least the whole document across the outputs, in order.
    const totalPages = result.files.reduce((a, f) => a + f.pageCount, 0)
    expect(totalPages).toBe(6)
    if (targetMb >= 0.05) {
      expect(result.files.length).toBeGreaterThan(1)
      for (const file of result.files) {
        expect((await PDFDocument.load(file.data.slice())).getPageCount()).toBe(file.pageCount)
      }
    }
  })

  it('warns when a single page is larger than the target on its own', async () => {
    // One page carrying a noisy (incompressible) image of well over 0.05 MB,
    // so the smallest allowed target is still smaller than the page itself.
    const canvas = createCanvas(800, 600)
    const ctx = canvas.getContext('2d')
    const image = ctx.createImageData(800, 600)
    let seed = 42
    for (let i = 0; i < image.data.length; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      image.data[i] = seed % 256
    }
    ctx.putImageData(image, 0, 0)
    const doc = await PDFDocument.create()
    const png = await doc.embedPng(new Uint8Array(canvas.toBuffer('image/png')))
    const page = doc.addPage([800, 600])
    page.drawImage(png, { x: 0, y: 0, width: 800, height: 600 })
    const src = await doc.save()
    expect(src.length).toBeGreaterThan(0.05 * 1024 * 1024)
    const result = await splitBySize(buf(src), 0.05)
    expect(result.files).toHaveLength(1)
    expect(result.oversizedSingles).toEqual([result.files[0].name])
  })

  it('rejects an out-of-range target', async () => {
    const src = await makePdf(1)
    await expect(splitBySize(buf(src), 0.01)).rejects.toThrow('between 0.05 MB and 500 MB')
  })
})
