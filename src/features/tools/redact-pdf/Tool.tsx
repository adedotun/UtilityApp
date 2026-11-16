import { useRef, useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import PdfCanvas from '../../shared/PdfCanvas'
import { getTool } from '../registry'
import type { RedactionBox } from './process'
const tool = getTool('redact-pdf')!

export default function RedactPdfTool() {
  const [page, setPage] = useState(1)
  const [boxes, setBoxes] = useState<RedactionBox[]>([])
  const pageBoxes = boxes.filter((b) => b.page === page)

  const undo = () => {
    const idx = [...boxes].map((b, i) => ({ b, i })).filter(({ b }) => b.page === page).pop()?.i
    if (idx !== undefined) setBoxes((prev) => prev.filter((_, i) => i !== idx))
  }
  const clearPage = () => setBoxes((prev) => prev.filter((b) => b.page !== page))

  return (
    <ToolWorkspace
      tool={tool}
      notice="This is true redaction, not a cover-up. Each page you mark is rebuilt as an image with your boxes burned in as solid black, so the text under a box is removed from the file entirely — it cannot be selected, copied or recovered. The trade-off is stated plainly: a redacted page becomes an image and loses its whole text layer, including text outside the boxes. Pages you do not mark are copied across untouched."
      actionLabel={() => 'Redact PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && boxes.length > 0}
      onProcess={async (files, signal, onProgress) => {
        const { buildRedactedPdf, burnRedactionBoxes, boxesByPage, REDACT_DPI } = await import('./process')
        const { loadPdfJs } = await import('../../../lib/pdfjs')
        const buffer = files[0].buffer!
        const doc = await loadPdfJs(buffer)
        const byPage = boxesByPage(boxes)
        const rendered = new Map()
        const canvas = document.createElement('canvas')
        let done = 0
        for (const [pageNum, pageBoxes] of byPage) {
          if (signal.aborted) throw new Error('Cancelled')
          const pdfPage = await doc.getPage(pageNum)
          const pt = pdfPage.getViewport({ scale: 1 })
          const viewport = pdfPage.getViewport({ scale: REDACT_DPI / 72 })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas is not available in this browser.')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
          burnRedactionBoxes(pixels, pageBoxes)
          ctx.putImageData(pixels, 0, 0)
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
          if (!blob) throw new Error('A page could not be rendered.')
          rendered.set(pageNum, { jpeg: new Uint8Array(await blob.arrayBuffer()), widthPt: pt.width, heightPt: pt.height })
          done += 1
          onProgress(done / byPage.size)
        }
        const result = await buildRedactedPdf(buffer, boxes, rendered)
        return [{
          name: 'redacted.pdf',
          blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
          summary: `${boxes.length} ${boxes.length === 1 ? 'box' : 'boxes'} burned into ${result.redactedPages.length} ${result.redactedPages.length === 1 ? 'page' : 'pages'} (${result.redactedPages.map((p) => `page ${p}`).join(', ')}). Those pages are now images, so nothing under the boxes can be recovered from this file`,
        }]
      }}
    >
      {({ files }) => (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className={panelClass}>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              Drag on the page to draw a black box over each name, number or line that must never be shared. Move between pages with the arrows under the preview; boxes are kept per page.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={undo} disabled={pageBoxes.length === 0} className="button-sm rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40 dark:bg-[var(--color-dark-panel)]">Undo last on this page</button>
              <button type="button" onClick={clearPage} disabled={pageBoxes.length === 0} className="button-sm rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40 dark:bg-[var(--color-dark-panel)]">Clear this page</button>
            </div>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              {boxes.length} {boxes.length === 1 ? 'box' : 'boxes'} in total, {pageBoxes.length} on this page. Make each box a little larger than the text it covers, so nothing peeks out at the edges.
            </p>
          </div>
          <div className={panelClass}>
            <RedactCanvas buffer={files[0]?.buffer} page={page} setPage={setPage} boxes={pageBoxes}
              onCommit={(box) => setBoxes((prev) => [...prev, box])} />
          </div>
        </div>
      )}
    </ToolWorkspace>
  )
}

interface CanvasProps {
  buffer?: ArrayBuffer
  page: number
  setPage: (p: number) => void
  boxes: RedactionBox[]
  onCommit: (b: RedactionBox) => void
}

function RedactCanvas({ buffer, page, setPage, boxes, onCommit }: CanvasProps) {
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [live, setLive] = useState<RedactionBox | null>(null)
  const toBox = (a: { x: number; y: number }, b: { x: number; y: number }): RedactionBox => {
    const x = Math.min(a.x, b.x)
    const yTop = Math.min(a.y, b.y)
    const w = Math.abs(b.x - a.x)
    const h = Math.abs(b.y - a.y)
    return { page, x, y: 1 - yTop - h, w: Math.max(w, 0.01), h: Math.max(h, 0.01) }
  }
  return (
    <div
      onPointerDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('button')) return
        const frame = e.currentTarget.querySelector('[data-pageframe]') as HTMLElement | null
        if (!frame) return
        const rect = frame.getBoundingClientRect()
        const frac = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
        drag.current = frac
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const frame = e.currentTarget.querySelector('[data-pageframe]') as HTMLElement | null
        if (!frame) return
        const rect = frame.getBoundingClientRect()
        const frac = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
        setLive(toBox(drag.current, frac))
      }}
      onPointerUp={() => {
        if (drag.current && live && (live.w > 0.012 || live.h > 0.012)) onCommit(live)
        drag.current = null
        setLive(null)
      }}
      className="touch-none"
    >
      <PdfCanvas buffer={buffer} page={page} onPageChange={setPage}>
        {(size) => (
          <div data-pageframe className="absolute inset-0">
            <svg className="h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none" aria-hidden>
              {[...boxes, ...(live ? [live] : [])].map((b, i) => {
                const X = (v: number) => v * size.w
                const Yt = (v: number) => (1 - v) * size.h
                return <rect key={i} x={X(b.x)} y={Yt(b.y + b.h)} width={X(b.w)} height={Yt(0) - Yt(b.h)} fill="#000000" />
              })}
            </svg>
          </div>
        )}
      </PdfCanvas>
    </div>
  )
}
