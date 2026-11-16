import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import PageThumbnails from '../../shared/PageThumbnails'
import { getTool } from '../registry'
const tool = getTool('watermark')!

export default function WatermarkTool() {
  const [kind, setKind] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(30)
  const [position, setPosition] = useState<'center' | 'diagonal' | 'top' | 'bottom'>('diagonal')
  const [imageFile, setImageFile] = useState<File | null>(null)

  const processOne = async (file: WorkspaceFile): Promise<ProcessOutput> => {
    if (kind === 'text') {
      const { addTextWatermark } = await import('./process')
      const data = await addTextWatermark(file.buffer!, text, opacity / 100, position)
      return { name: 'watermarked.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `Text watermark added to ${file.pageCount} pages` }
    }
    const { addImageWatermark } = await import('./process')
    const { toPngBytes, imageKind } = await import('../images-to-pdf/process')
    const png = imageKind(imageFile!.name, imageFile!.type) === 'png' ? new Uint8Array(await imageFile!.arrayBuffer()) : await toPngBytes(imageFile!)
    const data = await addImageWatermark(file.buffer!, png, opacity / 100)
    return { name: 'watermarked.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `Image watermark added to ${file.pageCount} pages` }
  }

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={(files) => (files.length > 1 ? `Watermark ${files.length} PDFs` : 'Add watermark')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer) && (kind === 'text' ? text.trim().length > 0 : !!imageFile)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Watermark type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={fieldClass}>
                <option value="text">Text</option><option value="image">Image or logo</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Opacity · {opacity} percent</span>
              <input type="range" min={5} max={100} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
            </label>
          </div>
          {kind === 'text' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}><span className="button-sm">Text</span>
                <input value={text} onChange={(e) => setText(e.target.value)} className={fieldClass} /></label>
              <label className={labelClass}><span className="button-sm">Position</span>
                <select value={position} onChange={(e) => setPosition(e.target.value as typeof position)} className={fieldClass}>
                  <option value="diagonal">Diagonal, across the page</option><option value="center">Centre</option><option value="top">Top</option><option value="bottom">Bottom</option>
                </select></label>
            </div>
          ) : (
            <label className={labelClass}><span className="button-sm">Watermark image</span>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className={fieldClass} /></label>
          )}
          {files.length > 1 ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">The same watermark is applied to every page of every PDF in the batch.</p>
          ) : null}
          {files.length === 1 && files[0]?.buffer ? (
            <div>
              <p className="body-6 mb-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Preview on page 1</p>
              <div className="relative mx-auto max-w-[220px]">
                <PageThumbnails buffer={files[0].buffer} pageCount={1} />
                {kind === 'text' ? <span className="heading-5 pointer-events-none absolute inset-0 flex items-center justify-center text-center" style={{ opacity: opacity / 100, transform: position === 'diagonal' ? 'rotate(-38deg)' : undefined }}>{text}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
