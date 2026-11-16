import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as XLSX from 'xlsx'
import { buildXlsx, columnBands, csvCell, extractTables, pdfToExcel, placedItems, rowsFromItems, tablesToCsv } from './process'
import { buf } from '../test-fixtures'

// PDF.js uses Uint8Array.prototype.toHex, which this Node runtime does not
// provide (current browsers do). Polyfill it for the test environment only.
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}

function item(str: string, x: number, y: number, width = 40, size = 12) {
  return { str, transform: [size, 0, 0, size, x, y], width, hasEOL: false }
}

describe('rowsFromItems', () => {
  it('clusters items into rows by baseline and columns by horizontal gaps', () => {
    const rows = rowsFromItems([
      item('Name', 56, 720, 28), item('Qty', 220, 720, 20), item('Price', 340, 720, 28),
      item('Apples', 56, 696, 34), item('4', 220, 696, 7), item('1.20', 340, 696, 22),
      item('Pears', 56, 672, 30), item('7', 220, 672, 7), item('0.80', 340, 672, 22),
    ])
    expect(rows).toEqual([
      ['Name', 'Qty', 'Price'],
      ['Apples', '4', '1.20'],
      ['Pears', '7', '0.80'],
    ])
  })

  it('keeps a right-aligned value in the column of its wider header', () => {
    const bands = columnBands(placedItems([
      item('Price', 340, 720, 28),
      item('1.20', 346, 696, 22), // right aligned: starts later, ends at the same edge
    ]))
    expect(bands).toHaveLength(1)
  })

  it('joins two items that fall in one cell with a space', () => {
    const rows = rowsFromItems([
      item('New', 56, 720, 22), item('York', 82, 720, 24), item('5', 220, 720, 7),
    ])
    expect(rows).toEqual([['New York', '5']])
  })

  it('returns no rows for a page without text items', () => {
    expect(rowsFromItems([{ transform: [1, 0, 0, 1, 0, 0] }])).toEqual([])
  })
})

describe('csv output', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('one\ntwo')).toBe('"one\ntwo"')
  })

  it('stacks pages in order', () => {
    expect(tablesToCsv([[['a', 'b']], [], [['c']]])).toBe('a,b\r\nc')
  })
})

async function makeTablePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  const cols = [56, 220, 340]
  const grid: [string, string, string][] = [
    ['Name', 'Qty', 'Price'],
    ['Apples', '4', '1.20'],
    ['Pears', '7', '0.80'],
  ]
  grid.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      page.drawText(cell, { x: cols[ci], y: 720 - ri * 24, size: 12, font })
    })
  })
  return doc.save()
}

describe('pdfToExcel', () => {
  it('extracts the drawn grid into the right rows and columns', async () => {
    const src = await makeTablePdf()
    const { pages, pageCount, rowCount, tablePages } = await extractTables(buf(src))
    expect(pageCount).toBe(1)
    expect(tablePages).toBe(1)
    expect(rowCount).toBe(3)
    expect(pages[0]).toEqual([
      ['Name', 'Qty', 'Price'],
      ['Apples', '4', '1.20'],
      ['Pears', '7', '0.80'],
    ])
  })

  it('writes CSV with the grid values', async () => {
    const src = await makeTablePdf()
    const { data } = await pdfToExcel(buf(src), 'csv')
    const csv = new TextDecoder().decode(data)
    expect(csv).toBe('Name,Qty,Price\r\nApples,4,1.20\r\nPears,7,0.80')
  })

  it('writes an xlsx whose cells hold the grid values', async () => {
    const src = await makeTablePdf()
    const { pages } = await extractTables(buf(src))
    const data = await buildXlsx(pages)
    const wb = XLSX.read(data, { type: 'array' })
    expect(wb.SheetNames).toEqual(['Page 1'])
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Page 1'], { header: 1 }) as string[][]
    expect(aoa).toEqual([
      ['Name', 'Qty', 'Price'],
      ['Apples', '4', '1.20'],
      ['Pears', '7', '0.80'],
    ])
  })

  it('rejects a PDF with no text layer', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([400, 600])
    const blank = await doc.save()
    await expect(pdfToExcel(buf(blank), 'csv')).rejects.toThrow('No table rows could be found')
  })
})
