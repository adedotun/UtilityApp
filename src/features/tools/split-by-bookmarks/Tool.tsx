import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('split-by-bookmarks')!

type Mode = 'bookmarks' | 'size'

export default function SplitByBookmarksTool() {
  const [mode, setMode] = useState<Mode>('bookmarks')
  const [targetMb, setTargetMb] = useState(5)
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => (mode === 'bookmarks' ? 'Split by bookmarks' : 'Split by size')}
      canRun={(files) => {
        if (files.length !== 1 || files[0].error || !files[0].buffer) return false
        if (mode === 'size') return Number.isFinite(targetMb) && targetMb >= 0.05 && targetMb <= 500
        return true
      }}
      onProcess={async (files, _signal, onProgress) => {
        const buffer = files[0].buffer!
        if (mode === 'bookmarks') {
          const { splitByBookmarks } = await import('./process')
          const parts = await splitByBookmarks(buffer)
          onProgress(1)
          return parts.map((part) => ({
            name: part.name,
            blob: new Blob([part.data as BlobPart], { type: 'application/pdf' }),
            summary: `Split into ${parts.length} ${parts.length === 1 ? 'file' : 'files'}, one per bookmark: ${parts.map((p) => p.title).join('; ')}`,
          }))
        }
        const { splitBySize } = await import('./process')
        const result = await splitBySize(buffer, targetMb)
        onProgress(1)
        let summary = `Split into ${result.files.length} ${result.files.length === 1 ? 'file' : 'files'} of at most ${targetMb} MB each, by estimated page sizes`
        if (result.oversizedSingles.length > 0) {
          summary += `. ${result.oversizedSingles.length === 1 ? 'One file is' : `${result.oversizedSingles.length} files are`} over the target because a single page in ${result.oversizedSingles.length === 1 ? 'it' : 'them'} is larger than ${targetMb} MB on its own and cannot be split further: ${result.oversizedSingles.join(', ')}`
        }
        if (result.oversizedFiles.length > 0) {
          summary += `. ${result.oversizedFiles.length === 1 ? 'One file' : `${result.oversizedFiles.length} files`} also came out slightly over the target — page sizes are estimated before splitting: ${result.oversizedFiles.join(', ')}`
        }
        return result.files.map((file) => ({
          name: file.name,
          blob: new Blob([file.data as BlobPart], { type: 'application/pdf' }),
          summary,
        }))
      }}
    >
      {() => (
        <div className={panelClass}>
          <label className={labelClass}><span className="button-sm">Split by</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={fieldClass}>
              <option value="bookmarks">Bookmarks — one file per chapter</option>
              <option value="size">File size — files under a target size</option>
            </select></label>
          {mode === 'bookmarks' ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              Bookmarks are the chapter list some PDFs show in a reader's sidebar. Each top-level bookmark becomes one file, running from its page to the page before the next bookmark, and files are named after their chapters. Pages before the first bookmark become a file of their own. If this PDF has no bookmarks, you will be told plainly and Split PDF with page ranges is the alternative.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <label className={labelClass}><span className="button-sm">Target size per file (MB)</span>
                <input type="number" min={0.05} max={500} step={0.5} value={targetMb} onChange={(e) => setTargetMb(Number(e.target.value))} className={fieldClass} />
                {!(Number.isFinite(targetMb) && targetMb >= 0.05 && targetMb <= 500) ? <span role="alert" className="body-6 text-[var(--color-danger)]">Set a target between 0.05 MB and 500 MB.</span> : null}
              </label>
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
                Pages are packed in order into files under the target. Each page's size is estimated from its content before splitting — no pages are rendered — and the result tells you honestly if any file still came out over the target. A single page that is larger than the target on its own becomes a file by itself; it cannot be split further.
              </p>
            </div>
          )}
        </div>
      )}
    </ToolWorkspace>
  )
}
