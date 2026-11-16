import { useEffect, useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import { FORMAT_EXT, formatFromFile } from '../image/engine'
import type { PhotoDataReport } from './process'
const tool = getTool('exif-tools')!

interface LoadedReport extends PhotoDataReport { buffer: ArrayBuffer }

/** Parses the current photo's hidden data and reports it to the parent. */
function PhotoDataLoader({ buffer, onReport, onError }: { buffer: ArrayBuffer; onReport: (report: PhotoDataReport) => void; onError: (message: string) => void }) {
  useEffect(() => {
    let alive = true
    import('./process')
      .then((m) => m.parsePhotoData(new Uint8Array(buffer)))
      .then((report) => { if (alive) onReport(report) })
      .catch((err: unknown) => { if (alive) onError(err instanceof Error ? err.message : 'The photo data could not be read.') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer])
  return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Reading the data stored in this photo…</p>
}

export default function ExifToolsTool() {
  const [report, setReport] = useState<LoadedReport | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  return (
    <ToolWorkspace
      tool={tool}
      notice="Photos carry data you cannot see: the camera that took them, when, and often exactly where, as GPS coordinates. Anyone you send the photo to can read it. This tool shows you what is in your photo and saves a copy with all of it removed. The reading and the removal happen on your device — the coordinates shown here are never sent anywhere, and no map is loaded."
      actionLabel={() => 'Save a copy with the data removed'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && !!report && report.buffer === files[0].buffer && report.hasMetadata}
      onProcess={async (files) => {
        const { scrubPhoto } = await import('./process')
        const { createBrowserEngine } = await import('../image/engine')
        const format = formatFromFile(files[0].file.name, files[0].file.type)
        if (format !== 'jpeg' && format !== 'png') throw new Error('This tool works with JPEG and PNG photos.')
        const data = await scrubPhoto(new Uint8Array(files[0].buffer!), createBrowserEngine(), files[0].file.type, format)
        return [{
          name: `${baseName(files[0].file.name)}-scrubbed.${FORMAT_EXT[format]}`,
          blob: new Blob([data as BlobPart], { type: files[0].file.type || (format === 'jpeg' ? 'image/jpeg' : 'image/png') }),
          summary: `Removed: ${report!.found.join(', ')}. The copy was re-encoded from the picture itself to strip the data, so its file size can differ slightly; the picture is unchanged`,
        }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          {files.length !== 1 || !files[0]?.buffer ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a JPEG or PNG photo in step 1 and the data stored inside it will be listed here.</p>
          ) : loadError && report?.buffer !== files[0].buffer ? (
            <p role="alert" className="body-6 text-[var(--color-danger)]">{loadError}</p>
          ) : !report || report.buffer !== files[0].buffer ? (
            <PhotoDataLoader
              buffer={files[0].buffer}
              onReport={(r) => { setReport({ ...r, buffer: files[0].buffer! }); setLoadError(null) }}
              onError={(message) => setLoadError(message)}
            />
          ) : !report.hasMetadata ? (
            <p className="body-6">No hidden data was found in this photo — no camera details, dates, GPS or stored text. There is nothing to remove, so step 3 is disabled.</p>
          ) : (
            <>
              <p className="button-sm">What this photo reveals</p>
              <dl className="flex flex-col gap-3">
                {report.entries.map((entry) => (
                  <div key={`${entry.label}-${entry.value}`} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                    <dt className="button-sm sm:w-56 sm:shrink-0">{entry.label}</dt>
                    <dd className="body-6 break-words">{entry.value}</dd>
                  </div>
                ))}
              </dl>
              {report.gps ? (
                <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
                  The GPS location is shown as coordinates, as it is stored. This page never loads a map and never sends these coordinates anywhere.
                </p>
              ) : null}
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
                Step 3 saves a copy with all of this removed. The copy is re-encoded from the picture itself, which is how the data is stripped; the picture looks the same.
              </p>
            </>
          )}
        </div>
      )}
    </ToolWorkspace>
  )
}
