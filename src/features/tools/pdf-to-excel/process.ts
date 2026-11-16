import { pdfjsLib } from '../../../lib/pdfjs'

/**
 * Under Vitest/Node the bundled worker URL is a root relative /node_modules
 * path; resolve it as a file URL against the cwd, the same fix pdf-to-text
 * uses. In the browser the URL Vite emits is used untouched.
 */
function resolveWorkerForNode(): void {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (!proc?.versions?.node || !proc.cwd) return
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${proc.cwd()}${src}`
  }
}

interface ItemLike {
  str?: unknown
  transform?: unknown
  width?: unknown
}

export interface PlacedItem { str: string; x: number; y: number; size: number; width: number }

/** Keeps the usable text items of one page, with their positions. */
export function placedItems(items: unknown[]): PlacedItem[] {
  const placed: PlacedItem[] = []
  for (const item of items) {
    const it = item as ItemLike
    if (typeof it.str !== 'string' || !it.str.trim()) continue
    const t = it.transform as number[] | undefined
    if (!Array.isArray(t) || t.length < 6) continue
    const size = Math.abs(t[3]) || Math.abs(t[0]) || 12
    placed.push({ str: it.str, x: t[4], y: t[5], size, width: typeof it.width === 'number' ? it.width : 0 })
  }
  return placed
}

/**
 * How close two cell intervals may be (in points) before they count as one
 * column. Real table columns are separated by more than this; text inside
 * one column stays within it.
 */
export const COLUMN_MERGE_GAP = 8

interface ColumnBand { start: number; end: number }

/**
 * Finds the page's columns from every cell's horizontal interval. Intervals
 * that overlap, or nearly touch, merge into one column band — so a
 * right-aligned number still lands in its header's column.
 */
export function columnBands(items: PlacedItem[]): ColumnBand[] {
  const intervals = items
    .map((i) => ({ start: i.x, end: i.x + Math.max(i.width, 1) }))
    .sort((a, b) => a.start - b.start)
  const bands: ColumnBand[] = []
  for (const iv of intervals) {
    const last = bands[bands.length - 1]
    if (last && iv.start - last.end <= COLUMN_MERGE_GAP) {
      last.end = Math.max(last.end, iv.end)
    } else {
      bands.push({ start: iv.start, end: iv.end })
    }
  }
  return bands
}

function bandIndexFor(item: PlacedItem, bands: ColumnBand[]): number {
  let best = 0
  let bestOverlap = -Infinity
  for (let i = 0; i < bands.length; i++) {
    const overlap = Math.min(item.x + Math.max(item.width, 1), bands[i].end) - Math.max(item.x, bands[i].start)
    // Prefer the band the item overlaps most; break ties towards the band
    // whose start is closest to (but not after) the item's start.
    const score = overlap > 0 ? overlap : -Math.abs(bands[i].start - item.x)
    if (score > bestOverlap) { bestOverlap = score; best = i }
  }
  return best
}

/**
 * Clusters one page of text items into a table. Rows group by baseline
 * (the pdf-to-word rule); columns come from the horizontal bands above.
 * Detection is positional: a cell spanning two columns, or columns set
 * very close together, can merge — the tool says so before it runs.
 */
export function rowsFromItems(items: unknown[]): string[][] {
  const placed = placedItems(items)
  if (!placed.length) return []
  const bands = columnBands(placed)
  placed.sort((a, b) => b.y - a.y || a.x - b.x)
  const rowGroups: PlacedItem[][] = []
  let current: PlacedItem[] = []
  for (const p of placed) {
    if (current.length && Math.abs(p.y - current[0].y) > Math.max(2, current[0].size * 0.35)) {
      rowGroups.push(current)
      current = []
    }
    current.push(p)
  }
  if (current.length) rowGroups.push(current)

  const rows: string[][] = []
  for (const group of rowGroups) {
    const cells = new Array<string>(bands.length).fill('')
    const ordered = [...group].sort((a, b) => a.x - b.x)
    for (const item of ordered) {
      const idx = bandIndexFor(item, bands)
      const text = item.str.replace(/\s+/g, ' ').trim()
      cells[idx] = cells[idx] ? `${cells[idx]} ${text}` : text
    }
    while (cells.length && cells[cells.length - 1] === '') cells.pop()
    if (cells.some((c) => c !== '')) rows.push(cells)
  }
  return rows
}

export interface ExtractedTables {
  /** One entry per page; pages without text hold an empty array. */
  pages: string[][][]
  pageCount: number
  /** Pages that produced at least one row. */
  tablePages: number
  rowCount: number
}

export async function extractTables(buffer: ArrayBuffer): Promise<ExtractedTables> {
  resolveWorkerForNode()
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const pages: string[][][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(rowsFromItems(content.items as unknown[]))
  }
  const tablePages = pages.filter((p) => p.length > 0).length
  const rowCount = pages.reduce((n, p) => n + p.length, 0)
  if (!rowCount) {
    throw new Error('No table rows could be found. This PDF may have no text layer — if it is made of scanned images, the OCR tool can read it first.')
  }
  return { pages, pageCount: doc.numPages, tablePages, rowCount }
}

/** RFC 4180 cell escaping: quote when the value holds a comma, quote or newline. */
export function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** CSV is one flat table, so every page's rows stack in page order. */
export function tablesToCsv(pages: string[][][]): string {
  return pages.filter((p) => p.length).map(rowsToCsv).join('\r\n')
}

/** Builds the .xlsx: one sheet per page that produced rows. SheetJS loads on demand, only for this tool. */
export async function buildXlsx(pages: string[][][]): Promise<Uint8Array> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  pages.forEach((rows, i) => {
    if (!rows.length) return
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, `Page ${i + 1}`)
  })
  if (!wb.SheetNames.length) throw new Error('No table rows could be found to put in a spreadsheet.')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Uint8Array(out)
}

export interface ExcelResult { data: Uint8Array; pageCount: number; tablePages: number; rowCount: number }

export async function pdfToExcel(buffer: ArrayBuffer, format: 'csv' | 'xlsx'): Promise<ExcelResult> {
  const { pages, pageCount, tablePages, rowCount } = await extractTables(buffer)
  const data = format === 'xlsx'
    ? await buildXlsx(pages)
    : new TextEncoder().encode(tablesToCsv(pages))
  return { data, pageCount, tablePages, rowCount }
}
