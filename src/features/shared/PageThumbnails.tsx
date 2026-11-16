import { useEffect, useRef, useState } from 'react'
import { loadPdfJs, renderPage, type PdfDocProxy } from '../../lib/pdfjs'

interface Props {
  buffer?: ArrayBuffer
  pageCount: number
  selected?: Set<number>
  onToggle?: (page: number) => void
  /** Optional extra CSS transform per page, e.g. rotation preview. */
  transformFor?: (page: number) => string
  label?: string
}

/** Shared thumbnail grid rendered with PDF.js using the locally bundled worker. */
export default function PageThumbnails({ buffer, pageCount, selected, onToggle, transformFor, label }: Props) {
  const [doc, setDoc] = useState<PdfDocProxy | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [loadedFor, setLoadedFor] = useState<ArrayBuffer | undefined>(undefined)
  useEffect(() => {
    let alive = true
    if (!buffer) return
    loadPdfJs(buffer).then((d) => { if (alive) { setDoc(d); setLoadedFor(buffer) } }).catch(() => { if (alive) setError('Page previews could not be rendered for this file.') })
    return () => { alive = false }
  }, [buffer])

  if (!buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a PDF above and its pages will appear here.</p>
  if (error) return <p role="alert" className="body-6 text-[var(--color-danger)]">{error}</p>
  if (!doc || loadedFor !== buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Rendering page previews…</p>

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" role="group" aria-label={label ?? 'Pages'}>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
        <Thumb key={page} doc={doc} page={page} selected={selected?.has(page)} onToggle={onToggle} transform={transformFor?.(page)} />
      ))}
    </div>
  )
}

function Thumb({ doc, page, selected, onToggle, transform }: { doc: PdfDocProxy; page: number; selected?: boolean; onToggle?: (p: number) => void; transform?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) void renderPage(doc, page, ref.current, 140).catch(() => {})
  }, [doc, page])
  const content = (
    <>
      <canvas ref={ref} className="w-full rounded-lg bg-white" style={transform ? { transform } : undefined} aria-hidden />
      <span className="caption-2">Page {page}{selected ? ' · selected' : ''}</span>
    </>
  )
  const cls = `flex flex-col items-center gap-2 rounded-xl p-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${selected ? 'bg-[var(--color-accent-soft)] ring-2 ring-[var(--color-accent)] dark:bg-[var(--color-dark-panel)]' : 'bg-[var(--color-surface-raised)] dark:bg-[var(--color-dark-panel)]'}`
  return onToggle ? (
    <button type="button" onClick={() => onToggle(page)} aria-pressed={!!selected} className={`${cls} hover:-translate-y-0.5 active:scale-[0.98]`}>{content}</button>
  ) : (
    <div className={cls}>{content}</div>
  )
}
