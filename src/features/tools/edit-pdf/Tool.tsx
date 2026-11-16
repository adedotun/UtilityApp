import { useRef, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import PdfCanvas from '../../shared/PdfCanvas'
import { getTool } from '../registry'
import type { EditItem, EditKind } from './process'
const tool = getTool('edit-pdf')!

const TOOLS: { kind: EditKind; name: string }[] = [
  { kind: 'highlight', name: 'Highlight' },
  { kind: 'redact', name: 'Redact' },
  { kind: 'draw', name: 'Draw' },
  { kind: 'rect', name: 'Rectangle' },
  { kind: 'ellipse', name: 'Ellipse' },
  { kind: 'line', name: 'Line' },
  { kind: 'text', name: 'Text' },
  { kind: 'image', name: 'Image' },
]

export default function EditPdfTool() {
  const [page, setPage] = useState(1)
  const [edits, setEdits] = useState<EditItem[]>([])
  const [kind, setKind] = useState<EditKind>('highlight')
  const [color, setColor] = useState('#facc15')
  const [opacity, setOpacity] = useState(50)
  const [textValue, setTextValue] = useState('')
  const [imagePng, setImagePng] = useState<Uint8Array | null>(null)

  const pageEdits = edits.filter((e) => e.page === page)
  const undo = () => {
    const idx = [...edits].map((e, i) => ({ e, i })).filter(({ e }) => e.page === page).pop()?.i
    if (idx !== undefined) setEdits((prev) => prev.filter((_, i) => i !== idx))
  }
  const clearPage = () => setEdits((prev) => prev.filter((e) => e.page !== page))

  return (
    <ToolWorkspace
      tool={tool}
      notice="About redact: it draws a solid box over the page. It does not remove the underlying text layer, so do not rely on it for truly sensitive information in a file you share widely."
      actionLabel={() => 'Save edited PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && edits.length > 0}
      onProcess={async (files) => {
        const { applyEdits } = await import('./process')
        const data = await applyEdits(files[0].buffer!, edits)
        return [{ name: 'edited.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `${edits.length} edits applied across ${new Set(edits.map((e) => e.page)).size} pages` }]
      }}
    >
      {({ files }) => (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className={panelClass}>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Editing tools">
              {TOOLS.map((t) => (
                <button key={t.kind} type="button" aria-pressed={kind === t.kind} onClick={() => { setKind(t.kind); if (t.kind === 'redact') setColor('#000000'); if (t.kind === 'highlight') setColor('#facc15') }}
                  className={`button-sm rounded-lg px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] ${kind === t.kind ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] dark:bg-[var(--color-dark-panel)]'}`}>{t.name}</button>
              ))}
              <button type="button" aria-pressed={kind === 'eraser' as EditKind} onClick={() => setKind('eraser' as EditKind)}
                className={`button-sm rounded-lg px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] ${kind as string === 'eraser' ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] dark:bg-[var(--color-dark-panel)]'}`}>Eraser</button>
            </div>
            <label className={labelClass}><span className="button-sm">Colour</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-xl bg-[var(--color-surface-raised)] p-1 dark:bg-[var(--color-dark-panel)]" /></label>
            <label className={labelClass}><span className="button-sm">Opacity · {opacity} percent</span>
              <input type="range" min={10} max={100} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" /></label>
            {kind === 'text' ? (
              <label className={labelClass}><span className="button-sm">Text to place</span>
                <input value={textValue} onChange={(e) => setTextValue(e.target.value)} className={fieldClass} placeholder="Type, then click the page" /></label>
            ) : null}
            {kind === 'image' ? (
              <label className={labelClass}><span className="button-sm">Image to place</span>
                <input type="file" accept="image/*" className={fieldClass} onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return
                  const { toPngBytes, imageKind } = await import('../images-to-pdf/process')
                  setImagePng(imageKind(f.name, f.type) === 'png' ? new Uint8Array(await f.arrayBuffer()) : await toPngBytes(f))
                }} /></label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={undo} disabled={pageEdits.length === 0} className="button-sm rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40 dark:bg-[var(--color-dark-panel)]">Undo last on this page</button>
              <button type="button" onClick={clearPage} disabled={pageEdits.length === 0} className="button-sm rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40 dark:bg-[var(--color-dark-panel)]">Clear this page</button>
            </div>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              {kind as string === 'eraser' ? 'Click an edit on this page to remove it.' : kind === 'text' || kind === 'image' ? 'Click the page to place it.' : 'Drag on the page to draw. Each edit is kept per page, and undo works per page.'} {edits.length} edits in total.
            </p>
          </div>
          <div className={panelClass}>
            <EditCanvas buffer={files[0]?.buffer} page={page} setPage={setPage} edits={pageEdits}
              onCommit={(item) => setEdits((prev) => [...prev, item])}
              onErase={(frac) => {
                const hit = [...pageEdits].reverse().find((e) => frac.x >= e.x - 0.02 && frac.x <= e.x + e.w + 0.02 && (1 - frac.yTop) >= e.y - 0.02 && (1 - frac.yTop) <= e.y + e.h + 0.02)
                if (hit) setEdits((prev) => prev.filter((e) => e !== hit))
              }}
              kind={kind} color={color} opacity={opacity / 100} textValue={textValue} imagePng={imagePng} />
          </div>
        </div>
      )}
    </ToolWorkspace>
  )
}

interface CanvasProps {
  buffer?: ArrayBuffer; page: number; setPage: (p: number) => void
  edits: EditItem[]
  onCommit: (e: EditItem) => void; onErase: (frac: { x: number; yTop: number }) => void
  kind: EditKind; color: string; opacity: number; textValue: string; imagePng: Uint8Array | null
}

function EditCanvas({ buffer, page, setPage, edits, onCommit, onErase, kind, color, opacity, textValue, imagePng }: CanvasProps) {
  const drag = useRef<{ start: { x: number; y: number }; points: { x: number; y: number }[] } | null>(null)
  const [live, setLive] = useState<EditItem | null>(null)
  const toItem = (a: { x: number; y: number }, b: { x: number; y: number }, points?: { x: number; y: number }[]): EditItem => {
    const x = Math.min(a.x, b.x), yTop = Math.min(a.y, b.y)
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y)
    return { kind, page, x, y: 1 - yTop - h, w: Math.max(w, 0.01), h: Math.max(h, 0.01), color, opacity: kind === 'redact' ? 1 : opacity, points: points?.map((p) => ({ x: p.x, y: 1 - p.y })) }
  }
  return (
    <div
      onPointerDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('button')) return
        const frame = (e.currentTarget.querySelector('[data-pageframe]') as HTMLElement | null)
        if (!frame) return
        const rect = frame.getBoundingClientRect()
        const frac = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
        if ((kind as string) === 'eraser') { onErase({ x: frac.x, yTop: frac.y }); return }
        if (kind === 'text') { if (textValue.trim()) onCommit({ kind, page, x: frac.x, y: 1 - frac.y, w: 0.3, h: 0.03, color, opacity, text: textValue.trim(), size: 14 }); return }
        if (kind === 'image') { if (imagePng) onCommit({ kind, page, x: frac.x, y: 1 - frac.y - 0.12, w: 0.25, h: 0.12, color, opacity, png: imagePng }); return }
        drag.current = { start: frac, points: [frac] }
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const frame = (e.currentTarget.querySelector('[data-pageframe]') as HTMLElement | null); if (!frame) return
        const rect = frame.getBoundingClientRect()
        const frac = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
        drag.current.points.push(frac)
        setLive(toItem(drag.current.start, frac, kind === 'draw' ? drag.current.points : kind === 'line' ? [drag.current.start, frac] : undefined))
      }}
      onPointerUp={() => {
        if (drag.current && live) {
          if (kind === 'draw' || kind === 'line' || live.w > 0.012 || live.h > 0.012) onCommit(live)
        }
        drag.current = null; setLive(null)
      }}
      className="touch-none"
    >
      <PdfCanvas buffer={buffer} page={page} onPageChange={setPage}>
        {(size) => (
          <div data-pageframe className="absolute inset-0">
            <svg className="h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none" aria-hidden>
              {[...edits, ...(live ? [live] : [])].map((e, i) => {
                const X = (v: number) => v * size.w, Yt = (v: number) => (1 - v) * size.h
                if (e.kind === 'draw' || e.kind === 'line') {
                  const pts = (e.points ?? []).map((p) => `${X(p.x)},${Yt(p.y)}`).join(' ')
                  return <polyline key={i} points={pts} fill="none" stroke={e.color} strokeWidth={2.5} opacity={e.opacity} />
                }
                if (e.kind === 'text') return <text key={i} x={X(e.x)} y={Yt(e.y)} fontSize={14} fill={e.color} opacity={e.opacity}>{e.text}</text>
                if (e.kind === 'image') return <rect key={i} x={X(e.x)} y={Yt(e.y + e.h)} width={X(e.w)} height={Yt(0) - Yt(e.h)} fill={e.color} opacity={0.25} />
                if (e.kind === 'ellipse') return <ellipse key={i} cx={X(e.x + e.w / 2)} cy={Yt(e.y + e.h / 2)} rx={X(e.w) / 2} ry={(Yt(0) - Yt(e.h)) / 2} fill={e.color} opacity={e.opacity} />
                return <rect key={i} x={X(e.x)} y={Yt(e.y + e.h)} width={X(e.w)} height={Yt(0) - Yt(e.h)} fill={e.color} opacity={e.kind === 'redact' ? 1 : e.opacity} stroke={e.kind === 'rect' ? e.color : undefined} />
              })}
            </svg>
          </div>
        )}
      </PdfCanvas>
    </div>
  )
}
