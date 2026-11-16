import { PDFDocument } from 'pdf-lib'

/** Where the new pages go: at the very start, at the very end, or after a given 1-based page. */
export type InsertPosition = { at: 'start' } | { at: 'end' } | { at: 'after'; page: number }

export function describePosition(position: InsertPosition): string {
  if (position.at === 'start') return 'at the start'
  if (position.at === 'end') return 'at the end'
  return `after page ${position.page}`
}

/** The 0-based index in the output at which inserted pages begin. */
export function insertIndex(position: InsertPosition, pageCount: number): number {
  if (position.at === 'start') return 0
  if (position.at === 'end') return pageCount
  if (!Number.isInteger(position.page) || position.page < 1 || position.page > pageCount) {
    throw new Error(`Pages can only be inserted after a page between 1 and ${pageCount}.`)
  }
  return position.page
}

async function loadMain(buffer: ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
}

/**
 * Inserts blank pages. Each blank takes the size of the page it follows
 * (or of the first page, when inserting at the start), so the document
 * keeps one consistent page size.
 */
export async function insertBlankPages(buffer: ArrayBuffer, position: InsertPosition, count: number): Promise<Uint8Array> {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('Insert between 1 and 100 blank pages at a time.')
  }
  const src = await loadMain(buffer)
  const total = src.getPageCount()
  const at = insertIndex(position, total)
  const neighbour = src.getPage(at === 0 ? 0 : at - 1)
  const { width, height } = neighbour.getSize()

  const out = await PDFDocument.create()
  const before = await out.copyPages(src, Array.from({ length: at }, (_, i) => i))
  before.forEach((p) => out.addPage(p))
  for (let i = 0; i < count; i++) out.addPage([width, height])
  const after = await out.copyPages(src, Array.from({ length: total - at }, (_, i) => at + i))
  after.forEach((p) => out.addPage(p))
  return out.save()
}

/**
 * Parses a page list like "1-3, 5" into sorted unique 1-based page numbers.
 * An empty string means every page.
 */
export function parsePageList(input: string, pageCount: number): number[] {
  const trimmed = input.trim()
  if (!trimmed) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages = new Set<number>()
  for (const part of trimmed.split(',')) {
    const piece = part.trim()
    const range = piece.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (from < 1 || to > pageCount || from > to) throw new Error(`"${piece}" is not a valid page range for a ${pageCount}-page document.`)
      for (let p = from; p <= to; p++) pages.add(p)
    } else if (/^\d+$/.test(piece)) {
      const p = Number(piece)
      if (p < 1 || p > pageCount) throw new Error(`Page ${p} is outside this document, which has ${pageCount} pages.`)
      pages.add(p)
    } else {
      throw new Error(`"${piece}" is not a page number or range. Use a list like 1-3, 5.`)
    }
  }
  return [...pages].sort((a, b) => a - b)
}

/**
 * Inserts pages copied from a second PDF into the main document. With no
 * page list, every page of the second PDF is inserted, in its own order.
 */
export async function insertPdfPages(
  buffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  position: InsertPosition,
  pageList = '',
): Promise<{ data: Uint8Array; inserted: number }> {
  const src = await loadMain(buffer)
  let source: PDFDocument
  try {
    source = await PDFDocument.load(new Uint8Array(sourceBuffer.slice(0)), { ignoreEncryption: true })
  } catch {
    throw new Error('The second file could not be read as a PDF. It may be damaged or password protected.')
  }
  const total = src.getPageCount()
  const at = insertIndex(position, total)
  const chosen = parsePageList(pageList, source.getPageCount())

  const out = await PDFDocument.create()
  const before = await out.copyPages(src, Array.from({ length: at }, (_, i) => i))
  before.forEach((p) => out.addPage(p))
  const insertedPages = await out.copyPages(source, chosen.map((p) => p - 1))
  insertedPages.forEach((p) => out.addPage(p))
  const after = await out.copyPages(src, Array.from({ length: total - at }, (_, i) => at + i))
  after.forEach((p) => out.addPage(p))
  return { data: await out.save(), inserted: chosen.length }
}
