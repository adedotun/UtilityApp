import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import type { PageSizeName } from './process'
const tool = getTool('resize-pages')!

type Choice = PageSizeName | 'custom'
const SIZE_LABELS: Record<PageSizeName, string> = { a4: 'A4', letter: 'Letter', legal: 'Legal' }

export default function ResizePagesTool() {
  const [choice, setChoice] = useState<Choice>('a4')
  const [widthMm, setWidthMm] = useState(210)
  const [heightMm, setHeightMm] = useState(297)

  const customValid = widthMm >= 13 && widthMm <= 5080 && heightMm >= 13 && heightMm <= 5080
  const targetLabel = choice === 'custom' ? `${widthMm} × ${heightMm} mm` : SIZE_LABELS[choice]

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => `Resize to ${targetLabel}`}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && (choice !== 'custom' || customValid)}
      onProcess={async (files) => {
        const { resizePdf, mmToPt, PAGE_SIZES: sizes } = await import('./process')
        const target = choice === 'custom'
          ? { widthPt: mmToPt(widthMm), heightPt: mmToPt(heightMm) }
          : sizes[choice]
        const data = await resizePdf(files[0].buffer!, target.widthPt, target.heightPt)
        return [{
          name: 'resized.pdf',
          blob: new Blob([data as BlobPart], { type: 'application/pdf' }),
          summary: `Every page resized to ${targetLabel}, with content scaled to fit and centred`,
        }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <label className={labelClass}><span className="button-sm">New page size</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value as Choice)} className={fieldClass}>
              <option value="a4">A4 (210 × 297 mm)</option>
              <option value="letter">Letter (216 × 279 mm)</option>
              <option value="legal">Legal (216 × 356 mm)</option>
              <option value="custom">Custom size in millimetres</option>
            </select></label>
          {choice === 'custom' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}><span className="button-sm">Width (mm)</span>
                <input type="number" min={13} max={5080} value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value))} className={fieldClass} /></label>
              <label className={labelClass}><span className="button-sm">Height (mm)</span>
                <input type="number" min={13} max={5080} value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value))} className={fieldClass} /></label>
              {!customValid ? <p role="alert" className="body-6 text-[var(--color-danger)]">Each side must be between 13 mm and 5080 mm.</p> : null}
            </div>
          ) : null}
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Content is scaled to fit the new size and centred, never cropped or stretched. A page of a different shape gets even margins on the longer sides. Sizes are portrait; a landscape page keeps its picture, fitted inside the new page.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
