import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('reorder-pages')!

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft as ArrowLeftIcon, ArrowRight } from '@phosphor-icons/react'
import { loadPdfJs, renderPage, type PdfDocProxy } from '../../../lib/pdfjs'

export default function ReorderPagesTool() {
  const [order, setOrder] = useState<number[]>([])
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Save reordered PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && order.length === (files[0].pageCount ?? -1)}
      onProcess={async (files) => {
        const { reorderPages } = await import('./process')
        const data = await reorderPages(files[0].buffer!, order)
        return [{ name: 'reordered.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `${order.length} pages saved in the new order` }]
      }}
    >
      {({ files }) => {
        const f = files[0]
        return (
          <div className={panelClass}>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Drag a page to move it, or focus a page and use the move buttons. Every page must stay in the document exactly once.</p>
            {f?.buffer ? <ReorderGrid key={f.id} buffer={f.buffer} pageCount={f.pageCount ?? 0} order={order} setOrder={setOrder} /> : <p className="body-6">Add a PDF above and its pages will appear here.</p>}
          </div>
        )
      }}
    </ToolWorkspace>
  )
}

function ReorderGrid({ buffer, pageCount, order, setOrder }: { buffer: ArrayBuffer; pageCount: number; order: number[]; setOrder: (o: number[]) => void }) {
  const [doc, setDoc] = useState<PdfDocProxy | null>(null)
  const dragFrom = useRef<number | null>(null)
  useEffect(() => { setOrder(Array.from({ length: pageCount }, (_, i) => i + 1)) }, [pageCount, setOrder])
  useEffect(() => { let alive = true; loadPdfJs(buffer).then((d) => { if (alive) setDoc(d) }).catch(() => {}); return () => { alive = false } }, [buffer])
  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= order.length) return
    const copy = [...order]; const [item] = copy.splice(idx, 1); copy.splice(next, 0, item); setOrder(copy)
  }
  const drop = (idx: number) => {
    if (dragFrom.current === null || dragFrom.current === idx) return
    const copy = [...order]; const [item] = copy.splice(dragFrom.current, 1); copy.splice(idx, 0, item); dragFrom.current = null; setOrder(copy)
  }
  if (!doc) return <p className="body-6" aria-busy="true">Rendering page previews…</p>
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {order.map((page, idx) => (
        <div key={page} draggable onDragStart={() => { dragFrom.current = idx }} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(idx)}
          className="flex flex-col items-center gap-2 rounded-xl bg-[var(--color-surface-raised)] p-2 dark:bg-[var(--color-dark-panel)]">
          <Thumb doc={doc} page={page} />
          <span className="caption-2">Page {page} · position {idx + 1}</span>
          <div className="flex gap-1">
            <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label={`Move page ${page} earlier`} className="rounded-lg p-1 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40"><ArrowLeftIcon size={14} aria-hidden /></button>
            <button type="button" disabled={idx === order.length - 1} onClick={() => move(idx, 1)} aria-label={`Move page ${page} later`} className="rounded-lg p-1 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40"><ArrowRight size={14} aria-hidden /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Thumb({ doc, page }: { doc: PdfDocProxy; page: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) void renderPage(doc, page, ref.current, 140).catch(() => {}) }, [doc, page])
  return <canvas ref={ref} className="w-full rounded-lg bg-white" aria-hidden />
}
