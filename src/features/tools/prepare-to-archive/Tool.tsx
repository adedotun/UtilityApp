import { useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
// @ts-ignore - vite asset url import for the tesseract worker script (bundled locally, never a CDN)
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
const tool = getTool('prepare-to-archive')!

export default function PrepareToArchiveTool() {
  const [phase, setPhase] = useState('')

  const processOne = async (file: WorkspaceFile, signal: AbortSignal, onProgress: (n: number) => void): Promise<ProcessOutput> => {
    const { prepareToArchive } = await import('./process')
    const { createRecognizer, OCR_DPI } = await import('../ocr-pdf/process')
    const { loadPdfJs } = await import('../../../lib/pdfjs')
    const buffer = file.buffer!
    const doc = await loadPdfJs(buffer)
    const total = doc.numPages
    let currentPage = 0
    setPhase('Loading the recognition engine from this site…')
    const recognizer = await createRecognizer({
      workerPath: workerUrl as unknown as string,
      corePath: '/tess-core',
      langPath: '/tess-data',
      onProgress: (fraction) => {
        if (total > 0) onProgress(Math.min(0.95, (currentPage + fraction) / total))
      },
    })
    try {
      const canvas = document.createElement('canvas')
      const result = await prepareToArchive(buffer, {
        renderPage: async (pageNum) => {
          if (signal.aborted) throw new Error('Cancelled')
          currentPage = pageNum - 1
          setPhase(`Step 1 of 2: reading page ${pageNum} of ${total} with OCR…`)
          const page = await doc.getPage(pageNum)
          const pt = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: OCR_DPI / 72 })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas is not available in this browser.')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
          if (!blob) throw new Error('A page could not be rendered.')
          return {
            image: new Uint8Array(await blob.arrayBuffer()),
            format: 'jpeg' as const,
            widthPx: canvas.width,
            heightPx: canvas.height,
            widthPt: pt.width,
            heightPt: pt.height,
          }
        },
        recognize: (image) => recognizer.recognize(image),
        onStep: (s) => {
          if (s === 'flatten') setPhase('Step 2 of 2: flattening form fields…')
        },
        onProgress: (done, count) => onProgress(0.05 + (done / count) * 0.9),
      })
      const ocrPart = result.ocrSkipped
        ? 'Step 1, OCR: every page already has a text layer, so OCR was skipped'
        : `Step 1, OCR: recognised words added to ${result.pagesOcrd} of the ${result.pagesNeedingOcr} ${result.pagesNeedingOcr === 1 ? 'page' : 'pages'} that had no text layer${result.pagesOcrd < result.pagesNeedingOcr ? `; the other ${result.pagesNeedingOcr - result.pagesOcrd} had nothing OCR could read` : ''}. Pages that already had text were left exactly as they were`
      const flattenPart = result.flattened
        ? `Step 2, flatten: ${result.fieldCount} form ${result.fieldCount === 1 ? 'field' : 'fields'} flattened into the pages`
        : 'Step 2, flatten: this PDF has no form fields, so there was nothing to flatten'
      return {
        name: 'prepared-to-archive.pdf',
        blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
        summary: `${ocrPart}. ${flattenPart}.`,
      }
    } finally {
      await recognizer.terminate()
      setPhase('')
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="Two tools in one pass, in the order you would run them by hand. Step 1 is OCR, but only for pages that have no text layer — pages that are already searchable are left exactly as they are, and if the whole document already has text, OCR is skipped and you are told. Step 2 is Flatten, baking any form fields into the pages. If a step cannot be completed you are told which one, and no half-finished file is presented as the result."
      actionLabel={() => 'Prepare to archive'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => [await processOne(files[0], signal, onProgress)]}
    >
      {({ status }) => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">There are no settings to choose. The recognition engine and its English language data are part of this site and load from here — never from a third-party server. OCR is slow work: only the pages without text are read, each can take several seconds, and the first run also loads the recognition engine (about 6 MB) from this site; after that it is cached on your device.</p>
          {status === 'working' && phase ? <p className="body-6" aria-live="polite">{phase}</p> : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
