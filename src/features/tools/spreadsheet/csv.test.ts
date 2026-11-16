import { describe, expect, it } from 'vitest'
import { cleanRows, detectDelimiter, parseCsv, rowsToCsv } from './csv'

describe('parseCsv', () => {
  it('parses plain rows with LF and CRLF endings', () => {
    expect(parseCsv('a,b\nc,d', ',')).toEqual([['a', 'b'], ['c', 'd']])
    expect(parseCsv('a,b\r\nc,d\r\n', ',')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('keeps commas, quotes and newlines inside quoted fields', () => {
    const rows = parseCsv('name,note\n"Smith, John","He said ""hello""\nthen left"', ',')
    expect(rows).toEqual([['name', 'note'], ['Smith, John', 'He said "hello"\nthen left']])
  })

  it('does not invent a phantom row after a trailing newline', () => {
    expect(parseCsv('a,b\n', ',')).toEqual([['a', 'b']])
    expect(parseCsv('', ',')).toEqual([])
  })

  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"open', ',')).toThrow(/never closed/)
  })
})

describe('rowsToCsv', () => {
  it('escapes values holding the delimiter, quotes or newlines', () => {
    expect(rowsToCsv([['a,b', 'say "hi"', 'two\nlines', 'plain']])).toBe('"a,b","say ""hi""","two\nlines",plain')
  })

  it('round trips through the parser unchanged', () => {
    const rows = [['Name', 'Note'], ['Smith, John', 'He said "hello"'], ['Multi\nline', '']]
    expect(parseCsv(rowsToCsv(rows), ',')).toEqual(rows)
  })
})

describe('detectDelimiter', () => {
  it('detects comma, semicolon and tab', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
  })

  it('ignores delimiters inside quoted fields', () => {
    expect(detectDelimiter('name;note\n"Smith, John";"a,b,c"')).toBe(';')
  })
})

describe('cleanRows', () => {
  it('trims whitespace in every cell', () => {
    const { rows } = cleanRows([['  Ann ', '  Lee  ']])
    expect(rows).toEqual([['Ann', 'Lee']])
  })

  it('drops fully empty rows and counts them', () => {
    const { rows, stats } = cleanRows([['a', 'b'], ['', '  '], [], ['c', 'd']])
    expect(rows).toEqual([['a', 'b'], ['c', 'd']])
    expect(stats.emptyDropped).toBe(2)
    expect(stats.rowsIn).toBe(4)
  })

  it('removes exact duplicates after trimming, keeping the first', () => {
    const { rows, stats } = cleanRows([['a', 'b'], [' a ', 'b'], ['c', 'd'], ['a', 'b']])
    expect(rows).toEqual([['a', 'b'], ['c', 'd']])
    expect(stats.duplicatesRemoved).toBe(2)
    expect(stats.rowsOut).toBe(2)
  })

  it('keeps rows that differ in any cell', () => {
    const { stats } = cleanRows([['a', 'b'], ['a', 'c'], ['a', 'b', '']])
    expect(stats.duplicatesRemoved).toBe(0)
    expect(stats.rowsOut).toBe(3)
  })
})
