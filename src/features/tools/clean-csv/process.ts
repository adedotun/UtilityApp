import { cleanRows, detectDelimiter, parseCsv, rowsToCsv, type CleanStats, type CsvDelimiter } from '../spreadsheet/csv'

export interface CleanCsvAnalysis {
  stats: CleanStats
  /** The delimiter detected in the source; the cleaned file keeps it. */
  delimiter: CsvDelimiter
  previewRows: string[][]
  csv: string
}

/**
 * Parses and cleans in one pass, so step 2 can show the counts before the
 * user commits, and step 3 downloads exactly what was previewed.
 */
export function analyseCsv(text: string): CleanCsvAnalysis {
  if (!text.trim()) throw new Error('This file appears to be empty.')
  const delimiter = detectDelimiter(text)
  const parsed = parseCsv(text, delimiter)
  const { rows, stats } = cleanRows(parsed)
  return { stats, delimiter, previewRows: rows.slice(0, 15), csv: rowsToCsv(rows, delimiter) }
}
