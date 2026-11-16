import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { csvToXlsx, readCsv } from './process'

const CSV = 'name,note\n"Smith, John","He said ""hello"""\nPlain,Simple'

describe('readCsv', () => {
  it('parses quoted fields with embedded commas and quotes', () => {
    const data = readCsv(CSV)
    expect(data.delimiter).toBe(',')
    expect(data.rows[1]).toEqual(['Smith, John', 'He said "hello"'])
    expect(data.rowCount).toBe(3)
    expect(data.colCount).toBe(2)
  })

  it('honours a manual delimiter override over detection', () => {
    const data = readCsv('a;b\n1;2', ';')
    expect(data.delimiter).toBe(';')
    expect(data.rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('auto-detects semicolons', () => {
    expect(readCsv('a;b\n1;2').delimiter).toBe(';')
  })
})

describe('csvToXlsx', () => {
  it('builds a workbook whose cells hold the CSV values', async () => {
    const { data } = await csvToXlsx(CSV)
    const wb = XLSX.read(data, { type: 'array' })
    expect(wb.SheetNames).toEqual(['Sheet1'])
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, raw: false, defval: '' }) as string[][]
    expect(aoa[1]).toEqual(['Smith, John', 'He said "hello"'])
    expect(aoa[2]).toEqual(['Plain', 'Simple'])
  })
})
