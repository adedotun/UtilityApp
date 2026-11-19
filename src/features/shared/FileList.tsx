import { ArrowDown, ArrowUp, X } from '@phosphor-icons/react'
import { formatSize } from '../../lib/files'
import FilePreview from './FilePreview'
import type { WorkspaceFile } from './useWorkspace'

interface Props {
  files: WorkspaceFile[]
  reorderable: boolean
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}

export default function FileList({ files, reorderable, onRemove, onMove }: Props) {
  if (files.length === 0) {
    return (
      <p className="body-6 rounded-xl bg-white p-4 text-[var(--color-ink-muted)] dark:bg-[var(--color-dark-raised)] dark:text-[var(--color-dark-muted)]">
        No files yet. Add a file above to begin.
      </p>
    )
  }
  return (
    <ul className="flex flex-col divide-y divide-[var(--color-line)] rounded-2xl bg-white dark:divide-[var(--color-dark-line)] dark:bg-[var(--color-dark-raised)]">
      {files.map((f, i) => (
        <li key={f.id} className="flex items-center gap-3 px-4 py-3">
          <FilePreview entry={f} />
          <div className="min-w-0 flex-1">
            <p className="title-3 truncate">{f.file.name}</p>
            <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              {formatSize(f.file.size)}
              {f.pageCount !== undefined ? ` · ${f.pageCount} ${f.pageCount === 1 ? 'page' : 'pages'}` : ''}
              {f.note ? ` · ${f.note}` : ''}
            </p>
            {f.error ? <p role="alert" className="body-6 mt-1 text-[var(--color-danger)]">{f.error}</p> : null}
          </div>
          {reorderable ? (
            <div className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => onMove(f.id, -1)} aria-label={`Move ${f.file.name} earlier`} className="rounded-lg p-2 outline-none transition-all duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40">
                <ArrowUp size={16} aria-hidden />
              </button>
              <button type="button" disabled={i === files.length - 1} onClick={() => onMove(f.id, 1)} aria-label={`Move ${f.file.name} later`} className="rounded-lg p-2 outline-none transition-all duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40">
                <ArrowDown size={16} aria-hidden />
              </button>
            </div>
          ) : null}
          <button type="button" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.file.name}`} className="rounded-lg p-2 outline-none transition-all duration-300 hover:text-[var(--color-danger)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]">
            <X size={16} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
