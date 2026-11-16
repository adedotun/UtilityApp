import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import { FORMAT_EXT, FORMAT_MIME, type ImageFormat } from '../image/engine'
const tool = getTool('convert-image')!

const TARGET_LABELS: Record<ImageFormat, string> = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP' }

export default function ConvertImageTool() {
  const [target, setTarget] = useState<ImageFormat>('jpeg')
  const [quality, setQuality] = useState(92)

  const processOne = async (file: WorkspaceFile): Promise<ProcessOutput> => {
    const { convertImage, decodeHeicToJpeg, isHeicFile } = await import('./process')
    const { createBrowserEngine } = await import('../image/engine')
    let bytes: Uint8Array = new Uint8Array(file.buffer!)
    let mime = file.file.type
    if (isHeicFile(file.file.name, file.file.type)) {
      bytes = await decodeHeicToJpeg(file.file)
      mime = 'image/jpeg'
    }
    const result = await convertImage(bytes, createBrowserEngine(), mime, target, quality / 100)
    return {
      name: `${baseName(file.file.name)}.${FORMAT_EXT[target]}`,
      blob: new Blob([result.data as BlobPart], { type: FORMAT_MIME[target] }),
      summary: `Converted to ${TARGET_LABELS[target]} · ${result.width} × ${result.height} pixels`,
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="Conversion happens by redrawing the image in the new format on your device. JPEG has no transparency, so transparent areas become white. HEIC photos (the iPhone default) are decoded on your device by an engine bundled with this site; if a browser cannot run that decoder, the file is listed with the reason instead of failing quietly."
      actionLabel={(files) => (files.length > 1 ? `Convert ${files.length} images` : 'Convert image')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Convert to</span>
              <select value={target} onChange={(e) => setTarget(e.target.value as ImageFormat)} className={fieldClass}>
                <option value="jpeg">JPEG — best for photos and sharing</option>
                <option value="png">PNG — lossless, keeps transparency</option>
                <option value="webp">WebP — small files for the web</option>
              </select></label>
            {target !== 'png' ? (
              <label className={labelClass}><span className="button-sm">Quality · {quality} percent</span>
                <input type="range" min={10} max={100} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
              </label>
            ) : null}
          </div>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            The image keeps its pixel dimensions; only the format changes. PNG ignores the quality setting because it is lossless.
            {files.length > 1 ? ' With several images added, each one is converted with these settings and listed separately, ready to download together as a ZIP.' : ''}
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
