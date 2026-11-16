import { rowsToCsv } from '../spreadsheet/csv'

type XlsxModule = typeof import('xlsx')

async function readWorkbook(XLSX: XlsxModule, buffer: ArrayBuffer) {
  try {
    return XLSX.read(new Uint8Array(buffer.slice(0)), { type: 'array' })
  } catch {
    throw new Error('This file could not be read as a spreadsheet. It may be damaged, or not an Excel or CSV file at all.')
  }
}

export async function listSheets(buffer: ArrayBuffer): Promise<string[]> {
  const XLSX = await import('xlsx')
  const wb = await readWorkbook(XLSX, buffer)
  if (!wb.SheetNames.length) throw new Error('This workbook has no sheets to convert.')
  return wb.SheetNames
}

export interface SheetData { rows: string[][]; sheetName: string; sheetNames: string[] }

/** Reads one sheet (the first, unless named) as rows of display strings. */
export async function sheetRows(buffer: ArrayBuffer, sheetName?: string): Promise<SheetData> {
  const XLSX = await import('xlsx')
  const wb = await readWorkbook(XLSX, buffer)
  if (!wb.SheetNames.length) throw new Error('This workbook has no sheets to convert.')
  const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0]
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' }) as unknown[][]
  const rows = aoa.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))))
  return { rows, sheetName: name, sheetNames: wb.SheetNames }
}

/**
 * One sheet out as CSV text, escaped to RFC 4180 by the shared writer —
 * the same escaping pdf-to-excel uses.
 */
export async function excelToCsv(buffer: ArrayBuffer, sheetName?: string): Promise<SheetData & { csv: string; rowCount: number }> {
  const { rows, sheetName: name, sheetNames } = await sheetRows(buffer, sheetName)
  const meaningful = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!meaningful.length) throw new Error(`The sheet "${name}" appears to be empty.`)
  return { rows, sheetName: name, sheetNames, csv: rowsToCsv(rows), rowCount: rows.length }
}
