import { useState } from 'react'
import ToolWorkspace, { labelClass, panelClass } from '../../shared/ToolWorkspace'
import PdfCanvas from '../../shared/PdfCanvas'
import PageThumbnails from '../../shared/PageThumbnails'
import { getTool } from '../registry'
import type { CropFractions } from './process'
const tool = getTool('crop-pdf')!

const EDGES: { key: keyof CropFractions; name: string }[] = [
  { key: 'left', name: 'Left' }, { key: 'right', name: 'Right' }, { key: 'top', name: 'Top' }, { key: 'bottom', name: 'Bottom' },
]

export default function CropPdfTool() {
  const [page, setPage] = useState(1)
  const [crop, setCrop] = useState<CropFractions>({ left: 0.05, bottom: 0.05, right: 0.05, top: 0.05 })
  const [applyTo, setApplyTo] = useState<'all' | 'selected'>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const toggle = (p: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Crop PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && (applyTo === 'all' || selected.size > 0)}
      onProcess={async (files) => {
        const { cropPdf } = await import('./process')
        const data = await cropPdf(files[0].buffer!, crop, applyTo === 'selected' ? [...selected] : [])
        return [{ name: 'cropped.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `Cropped ${applyTo === 'selected' ? selected.size : files[0].pageCount} pages` }]
      }}
    >
      {({ files }) => (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className={panelClass}>
            {EDGES.map(({ key, name }) => (
              <label key={key} className={labelClass}><span className="button-sm">{name} trim · {Math.round(crop[key] * 100)} percent</span>
                <input type="range" min={0} max={40} value={Math.round(crop[key] * 100)} onChange={(e) => setCrop((c) => ({ ...c, [key]: Number(e.target.value) / 100 }))} className="w-full accent-[var(--color-accent)]" />
              </label>
            ))}
            <label className={labelClass}><span className="button-sm">Apply to</span>
              <select value={applyTo} onChange={(e) => setApplyTo(e.target.value as typeof applyTo)} className="body-3 w-full rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] dark:bg-[var(--color-dark-panel)]">
                <option value="all">All pages, same crop</option><option value="selected">Selected pages only</option>
              </select></label>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">The outlined area on the page is what stays. Drag the outlined area to move it. Trimming sets the page crop and media boxes in the saved file.</p>
            {applyTo === 'selected' && files[0]?.buffer ? <PageThumbnails buffer={files[0].buffer} pageCount={files[0].pageCount ?? 0} selected={selected} onToggle={toggle} label="Select pages to crop" /> : null}
          </div>
          <div className={panelClass}>
            <PdfCanvas buffer={files[0]?.buffer} page={page} onPageChange={setPage}>
              {(size) => (
                <div
                  className="absolute cursor-move border-2 border-[var(--color-accent)]"
                  style={{ left: `${crop.left * 100}%`, top: `${crop.top * 100}%`, width: `${(1 - crop.left - crop.right) * 100}%`, height: `${(1 - crop.top - crop.bottom) * 100}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    const frame = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect()
                    const sx = e.clientX, sy = e.clientY, orig = { ...crop }
                    const move = (ev: PointerEvent) => {
                      const dx = (ev.clientX - sx) / frame.width, dy = (ev.clientY - sy) / frame.height
                      const wFrac = 1 - orig.left - orig.right, hFrac = 1 - orig.top - orig.bottom
                      const left = Math.min(Math.max(orig.left + dx, 0), 1 - wFrac)
                      const top = Math.min(Math.max(orig.top + dy, 0), 1 - hFrac)
                      setCrop({ left, right: 1 - wFrac - left, top, bottom: 1 - hFrac - top })
                    }
                    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
                    void size
                  }}
                  aria-label="Crop area. Use the sliders to adjust each edge."
                  role="img"
                />
              )}
            </PdfCanvas>
          </div>
        </div>
      )}
    </ToolWorkspace>
  )
}
