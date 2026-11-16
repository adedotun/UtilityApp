/**
 * Shared CSV reading, writing and cleaning for the spreadsheet tools.
 * The parser is a real RFC 4180 state machine: quoted fields may hold the
 * delimiter, double quotes and newlines. Writing follows the same rules,
 * matching the escaping pdf-to-excel already uses.
 */

export type CsvDelimiter = ',' | ';' | '\t'

export const DELIMITER_LABELS: Record<CsvDelimiter, string> = {
  ',': 'Comma',
  ';': 'Semicolon',
  '\t': 'Tab',
}

/** RFC 4180 cell escaping: quote when the value holds the delimiter, a quote or a newline. */
export function csvCell(value: string, delimiter: string = ','): string {
  const needsQuotes = value.includes('"') || value.includes('\n') || value.includes('\r') || (delimiter !== '' && value.includes(delimiter))
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

export function rowsToCsv(rows: string[][], delimiter: string = ','): string {
  return rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join('\r\n')
}

/**
 * Parses CSV text into rows of string cells. A trailing line break does not
 * produce a phantom empty row; an empty line in the middle parses as a row
 * with a single empty cell, so callers can decide what empty means to them.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let fieldStarted = false

  const endField = () => { row.push(field); field = ''; fieldStarted = false }
  const endRow = () => { endField(); rows.push(row); row = [] }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"' && !fieldStarted && field === '') { inQuotes = true; fieldStarted = true; continue }
    if (ch === delimiter) { endField(); continue }
    if (ch === '\r') { if (src[i + 1] === '\n') i++; endRow(); continue }
    if (ch === '\n') { endRow(); continue }
    field += ch
    fieldStarted = true
  }
  if (inQuotes) throw new Error('The CSV has an opening quote that is never closed. Check the file and try again.')
  if (fieldStarted || field !== '' || row.length > 0) endRow()
  return rows
}

const DELIMITER_CANDIDATES: CsvDelimiter[] = [',', ';', '\t']

/**
 * Guesses the delimiter by parsing the head of the file with each candidate
 * and scoring how many rows share a consistent column count above one.
 * Falls back to comma when nothing separates the text.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const sample = text.slice(0, 8000)
  let best: CsvDelimiter = ','
  let bestScore = 0
  for (const candidate of DELIMITER_CANDIDATES) {
    let rows: string[][]
    try { rows = parseCsv(sample, candidate) } catch { continue }
    const usable = rows.filter((r) => r.some((c) => c.trim() !== '')).slice(0, 25)
    if (usable.length < 1) continue
    const counts = new Map<number, number>()
    for (const r of usable) counts.set(r.length, (counts.get(r.length) ?? 0) + 1)
    const [modalCount, modalRows] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (modalCount <= 1) continue
    const score = modalRows * modalCount
    if (score > bestScore) { bestScore = score; best = candidate }
  }
  return best
}

export interface CleanStats {
  rowsIn: number
  rowsOut: number
  duplicatesRemoved: number
  emptyDropped: number
}

/**
 * The Clean CSV rules, in order: trim every cell, drop rows that are then
 * fully empty, then drop exact duplicate rows (compared after trimming),
 * keeping the first occurrence.
 */
export function cleanRows(rows: string[][]): { rows: string[][]; stats: CleanStats } {
  const seen = new Set<string>()
  const kept: string[][] = []
  let duplicatesRemoved = 0
  let emptyDropped = 0
  for (const raw of rows) {
    const row = raw.map((c) => c.trim())
    if (row.every((c) => c === '')) { emptyDropped++; continue }
    const key = JSON.stringify(row)
    if (seen.has(key)) { duplicatesRemoved++; continue }
    seen.add(key)
    kept.push(row)
  }
  return {
    rows: kept,
    stats: { rowsIn: rows.length, rowsOut: kept.length, duplicatesRemoved, emptyDropped },
  }
}
