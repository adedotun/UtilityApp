import { describe, expect, it } from 'vitest'
import { parseCsv } from '../spreadsheet/csv'
import { analyseCsv } from './process'

describe('analyseCsv', () => {
  it('reports the full picture: in, out, duplicates and empties', () => {
    const text = 'name, city \n Ann , Leeds \n\nAnn,Leeds\nBob,York\n'
    const result = analyseCsv(text)
    expect(result.stats).toEqual({ rowsIn: 5, rowsOut: 3, duplicatesRemoved: 1, emptyDropped: 1 })
    expect(parseCsv(result.csv, result.delimiter)).toEqual([
      ['name', 'city'],
      ['Ann', 'Leeds'],
      ['Bob', 'York'],
    ])
  })

  it('detects and keeps a semicolon delimiter', () => {
    const result = analyseCsv('a;b\n1;2\n1;2')
    expect(result.delimiter).toBe(';')
    expect(result.stats.duplicatesRemoved).toBe(1)
    expect(result.csv).toBe('a;b\r\n1;2')
  })

  it('leaves a tidy file unchanged and says nothing was removed', () => {
    const result = analyseCsv('a,b\n1,2')
    expect(result.stats).toEqual({ rowsIn: 2, rowsOut: 2, duplicatesRemoved: 0, emptyDropped: 0 })
  })

  it('rejects an empty file', () => {
    expect(() => analyseCsv('   ')).toThrow(/appears to be empty/)
  })
})
