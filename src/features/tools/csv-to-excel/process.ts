import { detectDelimiter, parseCsv, type CsvDelimiter } from '../spreadsheet/csv'

export type DelimiterChoice = 'auto' | CsvDelimiter

export interface CsvData {
  rows: string[][]
  delimiter: CsvDelimiter
  rowCount: number
  colCount: number
}

/** Parses CSV text with the chosen (or detected) delimiter. */
export function readCsv(text: string, choice: DelimiterChoice = 'auto'): CsvData {
  if (!text.trim()) throw new Error('This file appears to be empty.')
  const delimiter = choice === 'auto' ? detectDelimiter(text) : choice
  const rows = parseCsv(text, delimiter)
  const meaningful = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!meaningful.length) throw new Error('No rows of data could be found in this file.')
  return { rows, delimiter, rowCount: rows.length, colCount: Math.max(...rows.map((r) => r.length)) }
}

/** Builds the .xlsx with SheetJS, loaded on demand, only for this tool. */
export async function csvToXlsx(text: string, choice: DelimiterChoice = 'auto'): Promise<CsvData & { data: Uint8Array }> {
  const parsed = readCsv(text, choice)
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(parsed.rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return { ...parsed, data: new Uint8Array(out) }
}
