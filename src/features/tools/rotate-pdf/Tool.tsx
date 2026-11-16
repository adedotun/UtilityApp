import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import PageThumbnails from '../../shared/PageThumbnails'
import { getTool } from '../registry'
const tool = getTool('rotate-pdf')!

export default function RotatePdfTool() {
  const [angle, setAngle] = useState<90 | 180 | 270>(90)
  const [applyTo, setApplyTo] = useState<'all' | 'selected'>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const toggle = (p: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Rotate PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && (applyTo === 'all' || selected.size > 0)}
      onProcess={async (files) => {
        const { rotatePdf } = await import('./process')
        const data = await rotatePdf(files[0].buffer!, angle, applyTo === 'selected' ? [...selected] : [])
        return [{ name: 'rotated.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `Rotated ${applyTo === 'selected' ? selected.size : files[0].pageCount} pages by ${angle} degrees` }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Angle, clockwise</span>
              <select value={angle} onChange={(e) => setAngle(Number(e.target.value) as typeof angle)} className={fieldClass}>
                <option value={90}>90 degrees</option><option value={180}>180 degrees</option><option value={270}>270 degrees</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Apply to</span>
              <select value={applyTo} onChange={(e) => setApplyTo(e.target.value as typeof applyTo)} className={fieldClass}>
                <option value="all">All pages</option><option value="selected">Selected pages only</option>
              </select></label>
          </div>
          {applyTo === 'selected' && files[0]?.buffer ? (
            <>
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Select pages below. {selected.size} selected. Thumbnails are shown rotated as a preview.</p>
              <PageThumbnails buffer={files[0].buffer} pageCount={files[0].pageCount ?? 0} selected={selected} onToggle={toggle} transformFor={(p) => selected.has(p) ? `rotate(${angle}deg) scale(0.82)` : ''} label="Select pages to rotate" />
            </>
          ) : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
