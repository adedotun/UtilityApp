import { PDFDocument } from 'pdf-lib'
import { SHEET_SIZES, type SheetName } from '../n-up/process'

export type { SheetName }

/** Margin around the sheet edge and between the two pages, in points. */
export const BOOKLET_MARGIN_PT = 36
export const BOOKLET_GAP_PT = 36

/** Booklets fold from sheets of four pages, so the count pads up to a multiple of four. */
export function paddedCount(pageCount: number): number {
  return Math.ceil(pageCount / 4) * 4
}

export interface BookletSide { left: number; right: number }

/**
 * The imposition order for booklet printing. Pages are numbered 1-based
 * across the padded count; a number past the real page count is a padding
 * blank. Each sheet contributes two sides: the front pairs the last
 * remaining page (left) with the first (right), the back pairs the second
 * page (left) with the second-to-last (right) — so that printing the sides
 * double-sided and folding the stack in half reads in order.
 */
export function bookletSides(pageCount: number): BookletSide[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('The document has no pages to impose.')
  const padded = paddedCount(pageCount)
  const sides: BookletSide[] = []
  const sheets = padded / 4
  for (let s = 0; s < sheets; s++) {
    sides.push({ left: padded - 2 * s, right: 2 * s + 1 })
    sides.push({ left: 2 * s + 2, right: padded - 2 * s - 1 })
  }
  return sides
}

export interface BookletResult { data: Uint8Array; sheetCount: number; sideCount: number; pageCount: number; paddedBlanks: number }

/**
 * Imposes the document for booklet printing: landscape sheets, two pages
 * side by side in printer's-pair order, each scaled to fit its half of the
 * sheet and centred. Print the result double-sided (flip on the short
 * edge), fold the stack in half, and the pages read in order.
 */
export async function bookletPdf(buffer: ArrayBuffer, sheetName: SheetName): Promise<BookletResult> {
  let src: PDFDocument
  try {
    src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const base = SHEET_SIZES[sheetName]
  const sheetW = base.heightPt // landscape: the long side runs horizontally
  const sheetH = base.widthPt
  const pages = src.getPages()
  const sides = bookletSides(pages.length)
  const out = await PDFDocument.create()
  const embedded = new Map<number, Awaited<ReturnType<typeof out.embedPage>>>()
  const embed = async (pageNum: number) => {
    let found = embedded.get(pageNum)
    if (!found) {
      found = await out.embedPage(pages[pageNum - 1])
      embedded.set(pageNum, found)
    }
    return found
  }
  const cellW = (sheetW - BOOKLET_MARGIN_PT * 2 - BOOKLET_GAP_PT) / 2
  const cellH = sheetH - BOOKLET_MARGIN_PT * 2
  const cellX = [BOOKLET_MARGIN_PT, BOOKLET_MARGIN_PT + cellW + BOOKLET_GAP_PT]

  for (const side of sides) {
    const sheetPage = out.addPage([sheetW, sheetH])
    const slots: [number, number][] = [[side.left, 0], [side.right, 1]]
    for (const [pageNum, slot] of slots) {
      if (pageNum < 1 || pageNum > pages.length) continue // padding blank: leave the half empty
      const page = pages[pageNum - 1]
      const { width, height } = page.getSize()
      const scale = Math.min(cellW / width, cellH / height)
      const drawnW = width * scale
      const drawnH = height * scale
      sheetPage.drawPage(await embed(pageNum), {
        x: cellX[slot] + (cellW - drawnW) / 2,
        y: BOOKLET_MARGIN_PT + (cellH - drawnH) / 2,
        width: drawnW,
        height: drawnH,
      })
    }
  }
  return {
    data: await out.save(),
    sheetCount: sides.length / 2,
    sideCount: sides.length,
    pageCount: pages.length,
    paddedBlanks: paddedCount(pages.length) - pages.length,
  }
}
