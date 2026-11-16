import { useEffect, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
import { FORMAT_EXT, FORMAT_MIME, formatFromFile } from '../image/engine'
import type { ResizeSpec } from './process'
const tool = getTool('resize-image')!

/** Reads the pixel dimensions of the single added image, for display in step 2. */
function DimensionsHint({ file }: { file: File }) {
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    let alive = true
    createImageBitmap(file)
      .then((bitmap) => { if (alive) setDims({ width: bitmap.width, height: bitmap.height }) })
      .catch(() => { if (alive) setDims(null) })
    return () => { alive = false }
  }, [file])
  if (!dims) return null
  return (
    <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
      This image is {dims.width} × {dims.height} pixels.
    </p>
  )
}

export default function ResizeImageTool() {
  const [mode, setMode] = useState<'percent' | 'pixels'>('percent')
  const [percent, setPercent] = useState(50)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [lock, setLock] = useState(true)

  const spec = (): ResizeSpec => {
    if (mode === 'percent') return { mode: 'percent', percent }
    const w = width.trim() === '' ? null : Number(width)
    const h = lock || height.trim() === '' ? null : Number(height)
    return { mode: 'pixels', width: w, height: h }
  }

  const specValid = (): boolean => {
    if (mode === 'percent') return Number.isFinite(percent) && percent > 0
    const w = width.trim() === '' ? null : Number(width)
    const h = height.trim() === '' ? null : Number(height)
    if (w != null && (!Number.isFinite(w) || w <= 0)) return false
    if (!lock && h != null && (!Number.isFinite(h) || h <= 0)) return false
    return w != null || (!lock && h != null)
  }

  const processOne = async (file: WorkspaceFile): Promise<ProcessOutput> => {
    const { resizeImage } = await import('./process')
    const { createBrowserEngine } = await import('../image/engine')
    const sourceFormat = formatFromFile(file.file.name, file.file.type)
    if (!sourceFormat) throw new Error(`${file.file.name} is not a PNG, JPEG or WebP image.`)
    const result = await resizeImage(new Uint8Array(file.buffer!), createBrowserEngine(), file.file.type, sourceFormat, spec())
    return {
      name: `resized.${FORMAT_EXT[sourceFormat]}`,
      blob: new Blob([result.data as BlobPart], { type: FORMAT_MIME[sourceFormat] }),
      summary: `${result.width} × ${result.height} → ${result.outWidth} × ${result.outHeight} pixels`,
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={(files) => (files.length > 1 ? `Resize ${files.length} images` : 'Resize image')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer) && specValid()}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Resize by</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={fieldClass}>
                <option value="percent">Percentage of the original</option>
                <option value="pixels">Pixel dimensions</option>
              </select></label>
            {mode === 'percent' ? (
              <label className={labelClass}><span className="button-sm">Size · {percent} percent</span>
                <input type="range" min={5} max={400} step={5} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
              </label>
            ) : (
              <label className={labelClass}><span className="button-sm">Keep proportions</span>
                <select value={lock ? 'locked' : 'free'} onChange={(e) => setLock(e.target.value === 'locked')} className={fieldClass}>
                  <option value="locked">Locked — set the width, the height follows</option>
                  <option value="free">Free — set both sides exactly</option>
                </select></label>
            )}
          </div>
          {mode === 'pixels' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}><span className="button-sm">Width, pixels</span>
                <input type="number" min={1} value={width} onChange={(e) => setWidth(e.target.value)} placeholder="For example 800" className={fieldClass} /></label>
              {!lock ? (
                <label className={labelClass}><span className="button-sm">Height, pixels</span>
                  <input type="number" min={1} value={height} onChange={(e) => setHeight(e.target.value)} placeholder="For example 600" className={fieldClass} /></label>
              ) : null}
            </div>
          ) : null}
          {files.length === 1 && files[0] ? <DimensionsHint file={files[0].file} /> : null}
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            The image keeps its format. Resizing larger than the original is allowed, but it cannot add detail that was not there.
            {mode === 'pixels' && !lock ? ' Setting both sides exactly can stretch the image if the proportions differ from the original.' : ''}
            {files.length > 1 ? ' With several images added, the same setting is applied to each one; with proportions locked, each image keeps its own shape.' : ''}
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
