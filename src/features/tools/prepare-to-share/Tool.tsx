import { useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { formatSize } from '../../../lib/files'
import { getTool } from '../registry'
import type { ShareStep } from './process'
const tool = getTool('prepare-to-share')!

const STEP_LABELS: Record<ShareStep, string> = {
  scrub: 'Step 1 of 2: removing metadata, attachments and JavaScript…',
  compress: 'Step 2 of 2: compressing the scrubbed file…',
}

export default function PrepareToShareTool() {
  const [level, setLevel] = useState<'email' | 'balanced' | 'quality'>('balanced')
  const [step, setStep] = useState('')

  const processOne = async (file: WorkspaceFile, signal: AbortSignal, onProgress: (n: number) => void): Promise<ProcessOutput> => {
    const { prepareToShare } = await import('./process')
    const { buildRasterizedPdf, LEVEL_DPI } = await import('../compress-pdf/process')
    try {
      const result = await prepareToShare(
        file.buffer!,
        async (scrubbed) => {
          // The Compress tool's rasterised candidate, built the same way its
          // own page builds it: render every page at the level's DPI.
          const { loadPdfJs } = await import('../../../lib/pdfjs')
          const { dpi, jpegQuality } = LEVEL_DPI[level]
          const doc = await loadPdfJs(scrubbed)
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
            onProgress(0.15 + (p / doc.numPages) * 0.85)
          }
          return buildRasterizedPdf(pages)
        },
        (s) => {
          setStep(STEP_LABELS[s])
          if (s === 'compress') onProgress(0.15)
        },
      )
      const scrubPart = result.removed.length
        ? `Step 1, scrub: removed ${result.removed.length} ${result.removed.length === 1 ? 'item' : 'items'} — ${result.removed.join('; ')}`
        : 'Step 1, scrub: nothing to remove — no metadata, attachments or JavaScript were found, and the chain carried on'
      const saved = Math.max(0, Math.round((1 - result.outputSize / result.scrubbedSize) * 100))
      const compressPart = result.returnedOriginal
        ? `Step 2, compress: the scrubbed file could not be made smaller at this level, so it is the result at ${formatSize(result.outputSize)}`
        : `Step 2, compress: ${formatSize(result.scrubbedSize)} to ${formatSize(result.outputSize)}, saving ${saved} percent`
      return {
        name: 'prepared-to-share.pdf',
        blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
        summary: `${scrubPart}. ${compressPart}. Started at ${formatSize(result.originalSize)}.`,
      }
    } finally {
      setStep('')
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="Two tools in one pass, in the order you would run them by hand. Step 1 is Scrub: metadata, attached files and JavaScript are removed, and you are told exactly what was found. Step 2 is Compress at the level below. If a step cannot be completed you are told which one, and no half-finished file is presented as the result."
      actionLabel={() => 'Prepare to share'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => [await processOne(files[0], signal, onProgress)]}
    >
      {({ status }) => (
        <div className={panelClass}>
          <fieldset className="flex flex-col gap-3">
            <legend className="button-sm">Compression level, for step 2</legend>
            {([
              ['email', 'Smaller for email', 'Lowest size. Pages become images at 100 dpi, so text will not stay selectable.'],
              ['balanced', 'Balanced', 'Pages become images at 150 dpi. A good middle ground for sharing.'],
              ['quality', 'Keep quality', 'Pages become images at 200 dpi. Larger, but sharper.'],
            ] as const).map(([value, name, desc]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-surface-raised)] p-4 dark:bg-[var(--color-dark-panel)]">
                <input type="radio" name="share-level" value={value} checked={level === value} onChange={() => setLevel(value)} className="mt-1 accent-[var(--color-accent)]" />
                <span><span className="title-3 block">{name}</span><span className="body-6 block text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{desc}</span></span>
              </label>
            ))}
          </fieldset>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Step 1 has no settings: page content, images and form values are left exactly as they are, only the hidden data is taken out. Compression re renders pages as images; if the result would be larger than the scrubbed file, the scrubbed file is returned instead and you will be told.</p>
          {status === 'working' && step ? <p className="body-6" aria-live="polite">{step}</p> : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
