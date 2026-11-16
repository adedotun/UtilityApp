import JSZip from 'jszip'

export interface ZipSourceFile {
  name: string
  data: Uint8Array
}

/** Keeps only the final part of a name, so archive entries stay flat (no folders). */
export function flatName(name: string): string {
  const parts = name.split(/[\\/]/).filter((p) => p.length > 0)
  return parts[parts.length - 1] ?? 'file'
}

/**
 * Returns a name not yet used in this set, applying the batch engine's
 * suffix convention: "notes.txt" becomes "notes-2.txt", then "notes-3.txt".
 * Comparison is case-insensitive, matching deriveOutputName in shared/batch.
 */
export function uniqueEntryName(name: string, used: Set<string>): string {
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase())
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let n = 2
  while (used.has(`${base}-${n}${ext}`.toLowerCase())) n++
  const candidate = `${base}-${n}${ext}`
  used.add(candidate.toLowerCase())
  return candidate
}

/** Packs the files into one ZIP archive, flat, with duplicate names suffixed. */
export async function createZipArchive(files: ZipSourceFile[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('Add at least one file to pack into a ZIP.')
  const zip = new JSZip()
  const used = new Set<string>()
  for (const file of files) {
    zip.file(uniqueEntryName(flatName(file.name), used), file.data)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
