import { PDFDocument } from 'pdf-lib'

export type NUpCount = 2 | 4 | 6 | 9
export type SheetName = 'a4' | 'letter'
export type Orientation = 'portrait' | 'landscape'

export const SHEET_SIZES: Record<SheetName, { label: string; widthPt: number; heightPt: number }> = {
  a4: { label: 'A4', widthPt: 595.28, heightPt: 841.89 },
  letter: { label: 'Letter', widthPt: 612, heightPt: 792 },
}

/** Fixed margin around the sheet edge, in points (half an inch). */
export const SHEET_MARGIN_PT = 36

export interface Grid { cols: number; rows: number }

/**
 * The grid for a count on a sheet of the given orientation. Portrait
 * sheets stack 2 and 6 vertically; landscape sheets run them across.
 */
export function gridFor(count: NUpCount, orientation: Orientation): Grid {
  switch (count) {
    case 2: return orientation === 'portrait' ? { cols: 1, rows: 2 } : { cols: 2, rows: 1 }
    case 4: return { cols: 2, rows: 2 }
    case 6: return orientation === 'portrait' ? { cols: 2, rows: 3 } : { cols: 3, rows: 2 }
    case 9: return { cols: 3, rows: 3 }
  }
}

export function sheetDimensions(sheet: SheetName, orientation: Orientation): { widthPt: number; heightPt: number } {
  const base = SHEET_SIZES[sheet]
  return orientation === 'portrait'
    ? { widthPt: base.widthPt, heightPt: base.heightPt }
    : { widthPt: base.heightPt, heightPt: base.widthPt }
}

export interface CellRect { x: number; y: number; width: number; height: number }

/**
 * The rectangle of cell `index` (reading order: left to right, top to
 * bottom) on a sheet. PDF coordinates start at the bottom left, so row 0
 * is measured down from the top edge.
 */
export function cellRect(index: number, grid: Grid, sheetW: number, sheetH: number, gapPt: number): CellRect {
  const col = index % grid.cols
  const row = Math.floor(index / grid.cols)
  const usableW = sheetW - SHEET_MARGIN_PT * 2 - gapPt * (grid.cols - 1)
  const usableH = sheetH - SHEET_MARGIN_PT * 2 - gapPt * (grid.rows - 1)
  const width = usableW / grid.cols
  const height = usableH / grid.rows
  const x = SHEET_MARGIN_PT + col * (width + gapPt)
  const y = sheetH - SHEET_MARGIN_PT - (row + 1) * height - row * gapPt
  return { x, y, width, height }
}

export interface NUpOptions {
  perSheet: NUpCount
  sheet: SheetName
  orientation: Orientation
  /** Space between neighbouring pages on a sheet, in points. */
  gapPt: number
}

export interface NUpResult { data: Uint8Array; sheetCount: number; pageCount: number }

/**
 * Places several pages on each sheet for printing. Pages keep their order
 * and aspect ratio, scaled to fit their cell and centred in it. This is
 * plain n-up only: booklet imposition (which reorders pages for folding)
 * is a different tool and is not claimed here.
 */
export async function nUpPdf(buffer: ArrayBuffer, options: NUpOptions): Promise<NUpResult> {
  if (!([2, 4, 6, 9] as number[]).includes(options.perSheet)) {
    throw new Error('Pages per sheet must be 2, 4, 6 or 9.')
  }
  if (!Number.isFinite(options.gapPt) || options.gapPt < 0 || options.gapPt > 72) {
    throw new Error('The gap between pages must be between 0 and 72 points.')
  }
  let src: PDFDocument
  try {
    src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const { widthPt: sheetW, heightPt: sheetH } = sheetDimensions(options.sheet, options.orientation)
  const grid = gridFor(options.perSheet, options.orientation)
  const pages = src.getPages()
  const out = await PDFDocument.create()
  const sheetCount = Math.ceil(pages.length / options.perSheet)

  for (let s = 0; s < sheetCount; s++) {
    const sheet = out.addPage([sheetW, sheetH])
    const slice = pages.slice(s * options.perSheet, (s + 1) * options.perSheet)
    for (let i = 0; i < slice.length; i++) {
      const cell = cellRect(i, grid, sheetW, sheetH, options.gapPt)
      const embedded = await out.embedPage(slice[i])
      const { width, height } = slice[i].getSize()
      const scale = Math.min(cell.width / width, cell.height / height)
      const drawnW = width * scale
      const drawnH = height * scale
      sheet.drawPage(embedded, {
        x: cell.x + (cell.width - drawnW) / 2,
        y: cell.y + (cell.height - drawnH) / 2,
        width: drawnW,
        height: drawnH,
      })
    }
  }
  return { data: await out.save(), sheetCount, pageCount: pages.length }
}
