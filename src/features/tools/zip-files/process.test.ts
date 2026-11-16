import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createZipArchive, flatName, uniqueEntryName } from './process'

const enc = new TextEncoder()

describe('createZipArchive', () => {
  it('packs two files and re-opens with byte-equal contents', async () => {
    const a = enc.encode('first file contents')
    const b = new Uint8Array([0, 1, 2, 3, 250, 251, 252])
    const archive = await createZipArchive([
      { name: 'notes.txt', data: a },
      { name: 'data.bin', data: b },
    ])
    const zip = await JSZip.loadAsync(archive)
    const names = Object.keys(zip.files).sort()
    expect(names).toEqual(['data.bin', 'notes.txt'])
    expect(new Uint8Array(await zip.file('notes.txt')!.async('uint8array'))).toEqual(a)
    expect(new Uint8Array(await zip.file('data.bin')!.async('uint8array'))).toEqual(b)
  })

  it('keeps duplicate names with the -2 / -3 suffix convention', async () => {
    const archive = await createZipArchive([
      { name: 'report.txt', data: enc.encode('one') },
      { name: 'report.txt', data: enc.encode('two') },
      { name: 'REPORT.txt', data: enc.encode('three') },
    ])
    const zip = await JSZip.loadAsync(archive)
    expect(Object.keys(zip.files).sort()).toEqual(['REPORT-3.txt', 'report-2.txt', 'report.txt'])
    expect(await zip.file('report-2.txt')!.async('string')).toBe('two')
  })

  it('flattens names that carry folders', async () => {
    const archive = await createZipArchive([{ name: 'folder/sub/photo.jpg', data: enc.encode('x') }])
    const zip = await JSZip.loadAsync(archive)
    expect(Object.keys(zip.files)).toEqual(['photo.jpg'])
  })

  it('rejects an empty file list', async () => {
    await expect(createZipArchive([])).rejects.toThrow('at least one file')
  })
})

describe('flatName and uniqueEntryName', () => {
  it('strips windows and posix paths', () => {
    expect(flatName('a/b/c.txt')).toBe('c.txt')
    expect(flatName('a\\b\\c.txt')).toBe('c.txt')
    expect(flatName('c.txt')).toBe('c.txt')
  })

  it('suffixes from -2 upwards', () => {
    const used = new Set<string>()
    expect(uniqueEntryName('a.txt', used)).toBe('a.txt')
    expect(uniqueEntryName('a.txt', used)).toBe('a-2.txt')
    expect(uniqueEntryName('a.txt', used)).toBe('a-3.txt')
    expect(uniqueEntryName('noext', used)).toBe('noext')
    expect(uniqueEntryName('noext', used)).toBe('noext-2')
  })
})
