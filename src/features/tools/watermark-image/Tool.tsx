import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
import { FORMAT_EXT, FORMAT_MIME, formatFromFile } from '../image/engine'
import type { ImageWatermarkPosition } from './process'
const tool = getTool('watermark-image')!

export default function WatermarkImageTool() {
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(30)
  const [position, setPosition] = useState<ImageWatermarkPosition>('diagonal')

  const processOne = async (file: WorkspaceFile): Promise<ProcessOutput> => {
    const { watermarkImage } = await import('./process')
    const { createBrowserEngine } = await import('../image/engine')
    const format = formatFromFile(file.file.name, file.file.type)
    if (!format) throw new Error(`${file.file.name} is not a PNG, JPEG or WebP image.`)
    const data = await watermarkImage(new Uint8Array(file.buffer!), createBrowserEngine(), file.file.type, format, {
      text,
      opacity: opacity / 100,
      position,
    })
    return {
      name: `watermarked.${FORMAT_EXT[format]}`,
      blob: new Blob([data as BlobPart], { type: FORMAT_MIME[format] }),
      summary: `Watermark "${text}" added ${position === 'diagonal' ? 'diagonally' : `at the ${position}`} at ${opacity} percent opacity`,
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="The watermark is drawn into the picture itself and the image is re-encoded in its own format, on your device. A watermark drawn this way is part of the image — it cannot be peeled off, but cropping the marked area out is still possible, so place it over what matters."
      actionLabel={(files) => (files.length > 1 ? `Watermark ${files.length} images` : 'Add watermark')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer) && text.trim().length > 0}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Text</span>
              <input value={text} onChange={(e) => setText(e.target.value)} className={fieldClass} /></label>
            <label className={labelClass}><span className="button-sm">Position</span>
              <select value={position} onChange={(e) => setPosition(e.target.value as ImageWatermarkPosition)} className={fieldClass}>
                <option value="diagonal">Diagonal, across the image</option>
                <option value="center">Centre</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Opacity · {opacity} percent</span>
              <input type="range" min={5} max={100} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
            </label>
          </div>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            The text is sized to the image, so the same setting looks right on a small screenshot and a large photo.
            {files.length > 1 ? ' With several images added, every one gets the same watermark and the results can be downloaded together as a ZIP.' : ''}
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
