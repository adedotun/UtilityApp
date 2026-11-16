import type { ReactNode } from 'react'
import { ArrowLeft, DownloadSimple } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { ToolDef } from '../tools/registry'
import { CATEGORY_LABELS } from '../tools/registry'
import { baseName, downloadBlob, formatSize } from '../../lib/files'
import Dropzone from './Dropzone'
import FileList from './FileList'
import { useWorkspace, type ProcessOutput, type WorkspaceFile } from './useWorkspace'
import { useEffect, useState } from 'react'
import { usePrefs } from '../../app/prefs'

export interface WorkspaceApi {
  files: WorkspaceFile[]
  run: (fn: (files: WorkspaceFile[], signal: AbortSignal, onProgress: (n: number) => void) => Promise<ProcessOutput[]>) => Promise<void>
  status: string
}

interface Props {
  tool: ToolDef
  /** Label for the primary action, naming the outcome, e.g. "Merge 3 PDFs". */
  actionLabel: (files: WorkspaceFile[]) => string
  canRun: (files: WorkspaceFile[]) => boolean
  onProcess: (files: WorkspaceFile[], signal: AbortSignal, onProgress: (n: number) => void) => Promise<ProcessOutput[]>
  reorderable?: boolean
  children?: (api: WorkspaceApi) => ReactNode
  notice?: string
}

export default function ToolWorkspace({ tool, actionLabel, canRun, onProcess, reorderable = false, children, notice }: Props) {
  const ws = useWorkspace(tool.accept, tool.multiple)
  const recordRecent = usePrefs((s) => s.recordRecent)
  const [outputName, setOutputName] = useState('')

  useEffect(() => { recordRecent(tool.slug) }, [tool.slug, recordRecent])
  useEffect(() => {
    document.title = `${tool.name} — PDF Tweaks`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', `${tool.name}: ${tool.outcome} Free, in your browser, with no uploads.`)
  }, [tool])

  const single = ws.outputs.length === 1 ? ws.outputs[0] : null

  return (
    <>
      <Link to="/" className="button-sm inline-flex items-center gap-2 rounded-lg outline-none transition-colors duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
        <ArrowLeft size={16} aria-hidden /> All tools
      </Link>

      <section className="mt-6 max-w-[680px]">
        <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{CATEGORY_LABELS[tool.category]}</p>
        <h1 className="heading-3 mt-2">{tool.name}</h1>
        <p className="body-3 mt-3 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{tool.outcome}</p>
        {notice ? <p className="body-6 mt-4 rounded-xl bg-[var(--color-accent-soft)] p-4 dark:bg-[var(--color-dark-panel)]">{notice}</p> : null}
      </section>

      <section className="mt-10" aria-label="Step 1, add files">
        <h2 className="heading-5">Step 1 · Add files</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Dropzone accept={tool.accept} multiple={tool.multiple} onFiles={(f) => void ws.addFiles(f)} label={`Add files for ${tool.name}`} />
          <FileList files={ws.files} reorderable={reorderable && ws.files.length > 1} onRemove={ws.removeFile} onMove={ws.moveFile} />
        </div>
      </section>

      {children ? (
        <section className="mt-10" aria-label="Step 2, choose options">
          <h2 className="heading-5">Step 2 · Choose options</h2>
          <div className="mt-4">{children({ files: ws.files, run: ws.run, status: ws.status })}</div>
        </section>
      ) : null}

      <section className="mt-10" aria-label="Step 3, process and download">
        <h2 className="heading-5">Step 3 · Process and download</h2>
        <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-[var(--color-dark-raised)]">
          {ws.status === 'working' ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-lg bg-[var(--color-line)] dark:bg-[var(--color-dark-line)]" role="progressbar" aria-valuenow={Math.round(ws.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-[var(--color-accent)] transition-all duration-300" style={{ width: `${Math.max(4, ws.progress * 100)}%` }} />
              </div>
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Working on your device. Large files can take a little while.</p>
              <button type="button" onClick={ws.cancel} className="button-md self-start rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none transition-all duration-300 hover:text-[var(--color-danger)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">Cancel</button>
            </>
          ) : (
            <button
              type="button"
              disabled={!canRun(ws.files)}
              onClick={() => void ws.run(onProcess)}
              className="button-md self-start rounded-xl bg-[var(--color-accent)] px-3 py-2 text-white outline-none transition-all duration-300 hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {actionLabel(ws.files)}
            </button>
          )}

          {ws.jobError ? <p role="alert" className="body-6 text-[var(--color-danger)]">{ws.jobError}</p> : null}

          {ws.status === 'done' && ws.outputs.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4 dark:border-[var(--color-dark-line)]">
              {single ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="button-sm">File name</span>
                    <input
                      value={outputName || baseName(single.name)}
                      onChange={(e) => setOutputName(e.target.value)}
                      className="body-3 rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] dark:bg-[var(--color-dark-panel)]"
                    />
                  </label>
                  <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{single.summary} · {formatSize(single.blob.size)}</p>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => downloadBlob(single.blob, `${outputName || baseName(single.name)}${single.name.slice(single.name.lastIndexOf('.'))}`)} className="button-md inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-white outline-none transition-all duration-300 hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]">
                      <DownloadSimple size={18} aria-hidden /> Download
                    </button>
                    <button type="button" onClick={ws.reset} className="button-md rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">Process another</button>
                  </div>
                </>
              ) : (
                <>
                  <ul className="flex flex-col gap-2">
                    {ws.outputs.map((o) => (
                      <li key={o.name} className="flex flex-wrap items-center justify-between gap-3">
                        <span className="body-6">{o.name} · {formatSize(o.blob.size)}</span>
                        <button type="button" onClick={() => downloadBlob(o.blob, o.name)} className="button-sm inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-2 py-2 text-white outline-none transition-all duration-300 hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]">
                          <DownloadSimple size={14} aria-hidden /> Download
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{ws.outputs[0]?.summary}</p>
                  <button type="button" onClick={ws.reset} className="button-md self-start rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">Process another</button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}

export const fieldClass = 'body-3 w-full rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] dark:bg-[var(--color-dark-panel)]'
export const labelClass = 'flex flex-col gap-2'
export const panelClass = 'flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-[var(--color-dark-raised)]'
