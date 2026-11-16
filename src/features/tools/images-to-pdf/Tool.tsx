import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('images-to-pdf')!

export default function ImagesToPdfTool() {
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'legal' | 'fit'>('a4')
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto')
  return (
    <ToolWorkspace
      tool={tool}
      reorderable
      actionLabel={(files) => `Convert ${files.length} ${files.length === 1 ? 'image' : 'images'} to PDF`}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error)}
      onProcess={async (files, _s, onProgress) => {
        const { imagesToPdf, imageKind, toPngBytes } = await import('./process')
        const inputs = []
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          const kind = imageKind(f.file.name, f.file.type)
          inputs.push(kind ? { data: new Uint8Array(f.buffer!), kind } : { data: await toPngBytes(f.file), kind: 'png' as const })
          onProgress((i + 1) / files.length / 2)
        }
        const data = await imagesToPdf(inputs, pageSize, orientation)
        onProgress(1)
        return [{ name: 'images.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `${files.length} images converted to a ${inputs.length} page PDF` }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Page size</span>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value as typeof pageSize)} className={fieldClass}>
                <option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="fit">Fit to image</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Orientation</span>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)} className={fieldClass}>
                <option value="auto">Auto, from each image</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select></label>
          </div>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Images appear in the order listed in step 1. Use the arrows there to reorder them. PNG and JPEG are embedded as they are; other formats are converted to PNG first.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
