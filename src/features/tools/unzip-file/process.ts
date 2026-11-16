import JSZip from 'jszip'
import { flatName, uniqueEntryName } from '../zip-files/process'

export interface ZipEntryInfo {
  /** The path inside the archive, folders included. */
  path: string
  /** The uncompressed size in bytes. */
  size: number
}

export interface ExtractedFile {
  /** Flat, unique download name (folders removed, duplicates suffixed). */
  name: string
  data: Uint8Array
}

async function loadZip(data: Uint8Array): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(data.slice())
  } catch {
    throw new Error('This file could not be read as a ZIP archive. It may be damaged, or not a ZIP file at all.')
  }
}

/**
 * JSZip does not publish entry sizes in its types; they sit in the entry's
 * internal data record after a load. Read defensively and fall back to 0 —
 * the pinned JSZip 3.10 populates uncompressedSize for every file entry.
 */
function entrySize(entry: JSZip.JSZipObject): number {
  const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
  return typeof data?.uncompressedSize === 'number' ? data.uncompressedSize : 0
}

/** Lists the files in the archive from its directory, without extracting any of them. */
export async function listZipEntries(data: Uint8Array): Promise<ZipEntryInfo[]> {
  const zip = await loadZip(data)
  return Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({ path: entry.name, size: entrySize(entry) }))
}

/**
 * Extracts every file in the archive. Downloads are flat: folder paths are
 * shown in the step 2 listing, but each saved file keeps just its own name,
 * with the -2 / -3 suffix when two entries share one.
 */
export async function extractZipFiles(data: Uint8Array): Promise<ExtractedFile[]> {
  const zip = await loadZip(data)
  const used = new Set<string>()
  const out: ExtractedFile[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const bytes = await entry.async('uint8array')
    out.push({ name: uniqueEntryName(flatName(entry.name), used), data: bytes })
  }
  return out
}
