import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { extractZipFiles, listZipEntries } from './process'

const enc = new TextEncoder()

async function fixtureZip(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('readme.txt', 'read me first')
  zip.folder('docs')!.file('notes.txt', 'nested notes')
  return zip.generateAsync({ type: 'uint8array' })
}

describe('listZipEntries', () => {
  it('lists files with sizes, skipping folder entries', async () => {
    const entries = await listZipEntries(await fixtureZip())
    expect(entries).toEqual([
      { path: 'readme.txt', size: 13 },
      { path: 'docs/notes.txt', size: 12 },
    ])
  })

  it('returns an empty list for an archive with no files', async () => {
    const empty = await new JSZip().generateAsync({ type: 'uint8array' })
    expect(await listZipEntries(empty)).toEqual([])
  })

  it('rejects bytes that are not a ZIP archive', async () => {
    await expect(listZipEntries(enc.encode('definitely not a zip'))).rejects.toThrow('could not be read as a ZIP archive')
  })
})

describe('extractZipFiles', () => {
  it('extracts byte-equal files, flattened to their own names', async () => {
    const out = await extractZipFiles(await fixtureZip())
    expect(out.map((f) => f.name)).toEqual(['readme.txt', 'notes.txt'])
    expect(new TextDecoder().decode(out[0].data)).toBe('read me first')
    expect(new TextDecoder().decode(out[1].data)).toBe('nested notes')
  })

  it('suffixes two entries that share a file name', async () => {
    const zip = new JSZip()
    zip.file('a/same.txt', 'from a')
    zip.file('b/same.txt', 'from b')
    const out = await extractZipFiles(await zip.generateAsync({ type: 'uint8array' }))
    expect(out.map((f) => f.name)).toEqual(['same.txt', 'same-2.txt'])
    expect(new TextDecoder().decode(out[1].data)).toBe('from b')
  })

  it('extracts nothing from an empty archive', async () => {
    const empty = await new JSZip().generateAsync({ type: 'uint8array' })
    expect(await extractZipFiles(empty)).toEqual([])
  })
})
