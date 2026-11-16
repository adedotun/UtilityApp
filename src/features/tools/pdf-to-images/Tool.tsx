import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import { baseName } from '../../../lib/files'
const tool = getTool('pdf-to-images')!

export default function PdfToImagesTool() {
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scale, setScale] = useState(2)
  const [quality, setQuality] = useState(92)
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Convert to images'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => {
        const { loadPdfJs, renderPage } = await import('../../../lib/pdfjs')
        const { zipImages, pageImageName } = await import('./process')
        const doc = await loadPdfJs(files[0].buffer!)
        const total = doc.numPages
        const images = []
        const canvas = document.createElement('canvas')
        for (let p = 1; p <= total; p++) {
          if (signal.aborted) throw new Error('Cancelled')
          const page = await doc.getPage(p)
          const viewport = page.getViewport({ scale })
          canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas is not available in this browser.')
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          void renderPage
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, `image/${format}`, quality / 100))
          if (!blob) throw new Error(`Page ${p} could not be converted.`)
          images.push({ name: pageImageName(p - 1, total, format), data: blob })
          onProgress(p / total)
        }
        const zip = await zipImages(images)
        return [{ name: `${baseName(files[0].file.name)}-images.zip`, blob: zip, summary: `${total} pages converted to ${format.toUpperCase()} and zipped` }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}><span className="button-sm">Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className={fieldClass}>
                <option value="png">PNG, best quality</option><option value="jpeg">JPEG, smaller files</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Resolution</span>
              <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className={fieldClass}>
                <option value={1}>1x, screen</option><option value={2}>2x, sharp</option><option value={3}>3x, print</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">JPEG quality · {quality}</span>
              <input type="range" min={50} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" disabled={format === 'png'} />
            </label>
          </div>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Every page is saved as its own image and delivered in one ZIP file.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
