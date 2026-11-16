import { useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
import type { GrayscaleLevel } from './process'
const tool = getTool('grayscale-pdf')!

export default function GrayscalePdfTool() {
  const [level, setLevel] = useState<GrayscaleLevel>('balanced')

  const processOne = async (file: WorkspaceFile, signal: AbortSignal, onProgress: (n: number) => void): Promise<ProcessOutput> => {
    const { buildGrayscalePdf, grayscalePixels, GRAYSCALE_DPI } = await import('./process')
    const { loadPdfJs } = await import('../../../lib/pdfjs')
    const buffer = file.buffer!
    const { dpi, jpegQuality } = GRAYSCALE_DPI[level]
    const doc = await loadPdfJs(buffer)
    const pages = []
    const canvas = document.createElement('canvas')
    for (let p = 1; p <= doc.numPages; p++) {
      if (signal.aborted) throw new Error('Cancelled')
      const page = await doc.getPage(p)
      const pt = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: dpi / 72 })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas is not available in this browser.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
      grayscalePixels({ data: image.data, width: image.width, height: image.height })
      ctx.putImageData(image, 0, 0)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', jpegQuality))
      if (!blob) throw new Error('A page could not be rendered.')
      pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), widthPt: pt.width, heightPt: pt.height })
      onProgress(p / doc.numPages)
    }
    const data = await buildGrayscalePdf(pages)
    return {
      name: 'grayscale.pdf',
      blob: new Blob([data as BlobPart], { type: 'application/pdf' }),
      summary: `All ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} converted to grayscale at ${dpi} dpi. The pages are now images, so the text is no longer selectable`,
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="Grayscale rebuilds every page as a picture with the colour removed. The pages look the same apart from being black and white, but text stops being selectable and searchable — keep the original if you need the text. For a searchable copy, run OCR on the result."
      actionLabel={(files) => (files.length > 1 ? `Convert ${files.length} PDFs to grayscale` : 'Convert to grayscale')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files, signal, onProgress) => [await processOne(files[0], signal, onProgress)]}
      batchProcess={processOne}
    >
      {() => (
        <div className={panelClass}>
          <fieldset className="flex flex-col gap-3">
            <legend className="button-sm">Render quality</legend>
            {([
              ['email', 'Smaller file', 'Pages become grayscale images at 100 dpi. Fine for reading on screen and sending by email.'],
              ['balanced', 'Balanced', 'Pages become grayscale images at 150 dpi. A good middle ground.'],
              ['quality', 'Keep quality', 'Pages become grayscale images at 200 dpi. Larger, but sharper for printing.'],
            ] as const).map(([value, name, desc]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-surface-raised)] p-4 dark:bg-[var(--color-dark-panel)]">
                <input type="radio" name="gray-level" value={value} checked={level === value} onChange={() => setLevel(value)} className="mt-1 accent-[var(--color-accent)]" />
                <span><span className="title-3 block">{name}</span><span className="body-6 block text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{desc}</span></span>
              </label>
            ))}
          </fieldset>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            Converting to grayscale does not always make the file smaller — that depends on the original. If size is the goal, Compress is the better tool; this one is for when the colour has to go, for example for cheaper printing.
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
