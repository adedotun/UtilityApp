import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { formatSize } from '../../../lib/files'
import { getTool } from '../registry'
import { FORMAT_EXT, FORMAT_MIME, formatFromFile } from '../image/engine'
import type { CompressFormatChoice } from './process'
const tool = getTool('compress-image')!

export default function CompressImageTool() {
  const [quality, setQuality] = useState(75)
  const [maxDimension, setMaxDimension] = useState<number | null>(null)
  const [format, setFormat] = useState<CompressFormatChoice>('keep')

  const processOne = async (file: WorkspaceFile): Promise<ProcessOutput> => {
    const { compressImage } = await import('./process')
    const { createBrowserEngine } = await import('../image/engine')
    const sourceFormat = formatFromFile(file.file.name, file.file.type)
    if (!sourceFormat) throw new Error(`${file.file.name} is not a PNG, JPEG or WebP image.`)
    const result = await compressImage(new Uint8Array(file.buffer!), createBrowserEngine(), file.file.type, sourceFormat, {
      quality: quality / 100,
      maxDimension,
      format,
    })
    const saved = result.originalSize - result.outputSize
    const summary = result.returnedOriginal
      ? `${formatSize(result.originalSize)} — re-encoding was not smaller, so the original file was kept unchanged`
      : `${formatSize(result.originalSize)} → ${formatSize(result.outputSize)} (${Math.round((saved / result.originalSize) * 100)} percent smaller) · ${result.outWidth} × ${result.outHeight} pixels`
    return {
      name: `compressed.${FORMAT_EXT[result.format]}`,
      blob: new Blob([result.data as BlobPart], { type: FORMAT_MIME[result.format] }),
      summary,
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="Compression re-encodes the image on your device. As with Compress PDF, if the re-encoded file turns out no smaller than the original, the original is returned and the result says so — a file from this tool is never bigger than the one you added."
      actionLabel={(files) => (files.length > 1 ? `Compress ${files.length} images` : 'Compress image')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}><span className="button-sm">Quality · {quality} percent</span>
              <input type="range" min={10} max={100} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
            </label>
            <label className={labelClass}><span className="button-sm">Maximum size</span>
              <select value={maxDimension ?? ''} onChange={(e) => setMaxDimension(e.target.value === '' ? null : Number(e.target.value))} className={fieldClass}>
                <option value="">Keep original dimensions</option>
                <option value={1920}>Longest side 1920 pixels</option>
                <option value={1280}>Longest side 1280 pixels</option>
                <option value={800}>Longest side 800 pixels</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Output format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as CompressFormatChoice)} className={fieldClass}>
                <option value="keep">Keep the same format</option>
                <option value="jpeg">JPEG — usually smallest for photos</option>
                <option value="webp">WebP — small, for the web</option>
              </select></label>
          </div>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            Lower quality and smaller dimensions both shrink the file; dimensions usually save the most. The quality setting does not apply when the output stays PNG, because PNG is lossless.
            {files.length > 1 ? ' Every file is listed in step 3 with its own before and after size.' : ''}
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
