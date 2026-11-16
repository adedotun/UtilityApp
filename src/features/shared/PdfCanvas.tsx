import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { loadPdfJs, renderPage, type PdfDocProxy } from '../../lib/pdfjs'

interface Props {
  buffer?: ArrayBuffer
  page: number
  onPageChange: (p: number) => void
  width?: number
  /** Overlay rendered inside the page frame; receives the rendered page size in px. */
  children?: (size: { w: number; h: number }) => ReactNode
  onCanvasClick?: (frac: { x: number; yTop: number }, size: { w: number; h: number }) => void
}

/** Renders one PDF page with page navigation and a positioned overlay layer. */
export default function PdfCanvas({ buffer, page, onPageChange, width = 520, children, onCanvasClick }: Props) {
  const [doc, setDoc] = useState<PdfDocProxy | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [loadedFor, setLoadedFor] = useState<ArrayBuffer | undefined>(undefined)
  useEffect(() => {
    let alive = true
    if (!buffer) return
    loadPdfJs(buffer).then((d) => { if (alive) { setDoc(d); setLoadedFor(buffer); setError('') } }).catch(() => { if (alive) setError('This PDF could not be rendered for editing.') })
    return () => { alive = false }
  }, [buffer])

  useEffect(() => {
    if (!doc || !canvasRef.current) return
    let alive = true
    renderPage(doc, page, canvasRef.current, width).then(() => {
      if (alive && canvasRef.current) setSize({ w: canvasRef.current.width, h: canvasRef.current.height })
    }).catch(() => {})
    return () => { alive = false }
  }, [doc, page, width])

  if (!buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a PDF in step 1 and it will open here for editing.</p>
  if (error) return <p role="alert" className="body-6 text-[var(--color-danger)]">{error}</p>
  const total = doc && loadedFor === buffer ? doc.numPages : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page" className="rounded-lg p-2 outline-none transition-all duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40"><CaretLeft size={18} aria-hidden /></button>
        <span className="caption-2">Page {page} of {total || '…'}</span>
        <button type="button" disabled={!total || page >= total} onClick={() => onPageChange(page + 1)} aria-label="Next page" className="rounded-lg p-2 outline-none transition-all duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40"><CaretRight size={18} aria-hidden /></button>
      </div>
      <div
        className="relative mx-auto w-full shadow-sm"
        style={{ maxWidth: width, aspectRatio: size.w && size.h ? `${size.w} / ${size.h}` : undefined }}
        onClick={(e) => {
          if (!onCanvasClick) return
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          onCanvasClick({ x: (e.clientX - rect.left) / rect.width, yTop: (e.clientY - rect.top) / rect.height }, { w: rect.width, h: rect.height })
        }}
      >
        <canvas ref={canvasRef} className="block w-full rounded-lg bg-white" aria-label={`Page ${page} preview`} />
        {size.w > 0 && loadedFor === buffer ? children?.(size) : null}
      </div>
    </div>
  )
}
