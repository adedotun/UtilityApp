import { useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('compress-pdf')!

import { formatSize } from '../../../lib/files'
export default function CompressPdfTool() {
  const [level, setLevel] = useState<'email' | 'balanced' | 'quality'>('balanced')
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Compress PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => {
        const { compressPdf, buildRasterizedPdf, LEVEL_DPI } = await import('./process')
        const buffer = files[0].buffer!
        let candidate: Uint8Array | undefined
        try {
          const { loadPdfJs } = await import('../../../lib/pdfjs')
          const { dpi, jpegQuality } = LEVEL_DPI[level]
          const doc = await loadPdfJs(buffer)
          const pages = []
          const canvas = document.createElement('canvas')
          for (let p = 1; p <= doc.numPages; p++) {
            if (signal.aborted) throw new Error('Cancelled')
            const page = await doc.getPage(p)
            const pt = page.getViewport({ scale: 1 })
            const viewport = page.getViewport({ scale: dpi / 72 })
            canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Canvas unavailable')
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
            await page.render({ canvas, canvasContext: ctx, viewport }).promise
            const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', jpegQuality))
            if (!blob) throw new Error('A page could not be rendered.')
            pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), widthPt: pt.width, heightPt: pt.height })
            onProgress(p / doc.numPages)
          }
          candidate = await buildRasterizedPdf(pages)
        } catch {
          candidate = undefined
        }
        const result = await compressPdf(buffer, candidate)
        const saved = Math.max(0, Math.round((1 - result.outputSize / result.originalSize) * 100))
        const summary = result.returnedOriginal
          ? `This file could not be made smaller at this level, so the original was returned unchanged at ${formatSize(result.originalSize)}`
          : `Compressed from ${formatSize(result.originalSize)} to ${formatSize(result.outputSize)}, saving ${saved} percent`
        return [{ name: 'compressed.pdf', blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }), summary }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <fieldset className="flex flex-col gap-3">
            <legend className="button-sm">Compression level</legend>
            {([
              ['email', 'Smaller for email', 'Lowest size. Pages become images at 100 dpi, so text will not stay selectable.'],
              ['balanced', 'Balanced', 'Pages become images at 150 dpi. A good middle ground for sharing.'],
              ['quality', 'Keep quality', 'Pages become images at 200 dpi. Larger, but sharper.'],
            ] as const).map(([value, name, desc]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-surface-raised)] p-4 dark:bg-[var(--color-dark-panel)]">
                <input type="radio" name="level" value={value} checked={level === value} onChange={() => setLevel(value)} className="mt-1 accent-[var(--color-accent)]" />
                <span><span className="title-3 block">{name}</span><span className="body-6 block text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{desc}</span></span>
              </label>
            ))}
          </fieldset>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            {files[0] ? `Current size: ${formatSize(files[0].file.size)}. ` : ''}Compression re renders pages as images, which is what actually shrinks image heavy PDFs. If the result would be larger than your original, the original is returned instead and you will be told.
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
