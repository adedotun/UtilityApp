import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseCsv } from '../spreadsheet/csv'
import { csvToXlsx } from '../csv-to-excel/process'
import { excelToCsv, listSheets } from './process'

function fixtureWorkbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const first = XLSX.utils.aoa_to_sheet([
    ['Name', 'Note'],
    ['Smith, John', 'He said "hello"'],
    ['Plain', 'Simple'],
  ])
  const second = XLSX.utils.aoa_to_sheet([['Only'], ['Second sheet value']])
  XLSX.utils.book_append_sheet(wb, first, 'People')
  XLSX.utils.book_append_sheet(wb, second, 'Extra')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('excelToCsv', () => {
  it('lists the sheets of a workbook', async () => {
    expect(await listSheets(fixtureWorkbook())).toEqual(['People', 'Extra'])
  })

  it('writes RFC 4180 CSV: values with commas and quotes survive', async () => {
    const { csv, sheetName } = await excelToCsv(fixtureWorkbook())
    expect(sheetName).toBe('People')
    expect(csv).toContain('"Smith, John","He said ""hello"""')
    expect(parseCsv(csv, ',')).toEqual([
      ['Name', 'Note'],
      ['Smith, John', 'He said "hello"'],
      ['Plain', 'Simple'],
    ])
  })

  it('converts the sheet named by the picker', async () => {
    const { csv, sheetName } = await excelToCsv(fixtureWorkbook(), 'Extra')
    expect(sheetName).toBe('Extra')
    expect(parseCsv(csv, ',')).toEqual([['Only'], ['Second sheet value']])
  })

  it('rejects a file that is not a spreadsheet', async () => {
    // A truncated file with a spreadsheet (zip) signature: SheetJS cannot open it.
    // (Plain text is not used here — SheetJS legitimately reads it as CSV data.)
    const broken = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0xff, 0xfe, 0x00, 0x99])
    await expect(excelToCsv(broken.buffer as ArrayBuffer)).rejects.toThrow(/could not be read as a spreadsheet/)
  })
})

describe('CSV and Excel round trip', () => {
  it('known cell values survive CSV to Excel and back', async () => {
    const original = 'name,note\n"Smith, John","He said ""hello"""\nPlain,Simple'
    const { data } = await csvToXlsx(original)
    const { csv } = await excelToCsv(data.buffer as ArrayBuffer)
    expect(parseCsv(csv, ',')).toEqual(parseCsv(original, ','))
  })
})
