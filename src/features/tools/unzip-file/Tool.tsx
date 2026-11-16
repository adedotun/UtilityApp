import { useEffect, useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName, formatSize } from '../../../lib/files'
import { getTool } from '../registry'
import type { ZipEntryInfo } from './process'
const tool = getTool('unzip-file')!

interface LoadedListing {
  buffer: ArrayBuffer
  entries: ZipEntryInfo[]
}

/** Reads the archive's directory (not its contents) and reports the listing. */
function ListingLoader({ buffer, onListing, onError }: { buffer: ArrayBuffer; onListing: (entries: ZipEntryInfo[]) => void; onError: (message: string) => void }) {
  useEffect(() => {
    let alive = true
    import('./process')
      .then((m) => m.listZipEntries(new Uint8Array(buffer)))
      .then((entries) => { if (alive) onListing(entries) })
      .catch((err: unknown) => { if (alive) onError(err instanceof Error ? err.message : 'This archive could not be read.') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer])
  return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Reading what is inside this archive…</p>
}

export default function UnzipFileTool() {
  const [listing, setListing] = useState<LoadedListing | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  return (
    <ToolWorkspace
      tool={tool}
      notice="The archive is opened on your device and never uploaded. Step 2 lists what is inside before anything is extracted; step 3 then saves each file on its own, so you can take only the ones you want."
      actionLabel={() => 'Extract the files'}
      canRun={(files) => files.length === 1 && !!files[0].buffer && !!listing && listing.buffer === files[0].buffer && listing.entries.length > 0}
      onProcess={async (files, signal, onProgress) => {
        const { extractZipFiles } = await import('./process')
        const extracted = await extractZipFiles(new Uint8Array(files[0].buffer!))
        if (signal.aborted) throw new Error('Cancelled')
        onProgress(1)
        if (extracted.length === 0) throw new Error('This archive contains no files to extract.')
        const summary = extracted.length === 1
          ? 'One file extracted from the archive'
          : `${extracted.length} files extracted from the archive`
        return extracted.map((f) => ({
          name: f.name,
          blob: new Blob([f.data as BlobPart], { type: 'application/octet-stream' }),
          summary,
        }))
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          {files.length !== 1 || !files[0]?.buffer ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a ZIP archive in step 1 and the files inside it will be listed here.</p>
          ) : loadError && listing?.buffer !== files[0].buffer ? (
            <p role="alert" className="body-6 text-[var(--color-danger)]">{loadError}</p>
          ) : !listing || listing.buffer !== files[0].buffer ? (
            <ListingLoader
              buffer={files[0].buffer}
              onListing={(entries) => { setListing({ buffer: files[0].buffer!, entries }); setLoadError(null) }}
              onError={(message) => setLoadError(message)}
            />
          ) : listing.entries.length === 0 ? (
            <p className="body-6">This archive contains no files — it is empty, or holds only folders. There is nothing to extract, so step 3 is disabled.</p>
          ) : (
            <>
              <p className="button-sm">{listing.entries.length} {listing.entries.length === 1 ? 'file' : 'files'} inside {baseName(files[0].file.name)}.zip</p>
              <ul className="flex flex-col gap-2">
                {listing.entries.map((entry) => (
                  <li key={entry.path} className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="body-6 break-all">{entry.path}</span>
                    <span className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{formatSize(entry.size)}</span>
                  </li>
                ))}
              </ul>
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
                Step 3 extracts every file. Files are saved flat, under their own names — a file stored in a folder keeps its file name, not the folder.
              </p>
            </>
          )}
        </div>
      )}
    </ToolWorkspace>
  )
}
