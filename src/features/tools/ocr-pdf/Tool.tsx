import { useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
// @ts-ignore - vite asset url import for the tesseract worker script (bundled locally, never a CDN)
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
const tool = getTool('ocr-pdf')!

type OutputChoice = 'pdf' | 'text' | 'both'

export default function OcrPdfTool() {
  const [choice, setChoice] = useState<OutputChoice>('pdf')
  const [phase, setPhase] = useState('')
  return (
    <ToolWorkspace
      tool={tool}
      notice="OCR reads the words in scanned pages. The recognition engine and its English language data are part of this site and load from here — never from a third-party server — and the reading happens on your device, like every other tool. Recognition quality depends on the scan: clear, straight pages at a decent size read best."
      actionLabel={() => 'Run OCR'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => {
        const { ocrPdf, createRecognizer, OCR_DPI } = await import('./process')
        const { loadPdfJs } = await import('../../../lib/pdfjs')
        const buffer = files[0].buffer!
        const doc = await loadPdfJs(buffer)
        const total = doc.numPages
        let currentPage = 0
        setPhase('Loading the recognition engine from this site…')
        const recognizer = await createRecognizer({
          workerPath: workerUrl as unknown as string,
          corePath: '/tess-core',
          langPath: '/tess-data',
          onProgress: (fraction) => {
            if (total > 0) onProgress((currentPage + fraction) / total)
          },
        })
        try {
          const canvas = document.createElement('canvas')
          const result = await ocrPdf(buffer, {
            renderPage: async (pageNum) => {
              if (signal.aborted) throw new Error('Cancelled')
              currentPage = pageNum - 1
              setPhase(`Reading page ${pageNum} of ${total}…`)
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
            onProgress: (page, count) => {
              currentPage = page
              onProgress(page / count)
            },
          })
          const outputs = []
          if (choice === 'pdf' || choice === 'both') {
            outputs.push({
              name: 'searchable.pdf',
              blob: new Blob([result.pdf as BlobPart], { type: 'application/pdf' }),
              summary: `Text recognised on ${result.pagesWithText} of ${result.pageCount} pages and added as an invisible layer, so the PDF is searchable and copyable while looking like the scan`,
            })
          }
          if (choice === 'text' || choice === 'both') {
            outputs.push({
              name: `${baseName(files[0].file.name)}.txt`,
              blob: new Blob([result.text], { type: 'text/plain' }),
              summary: `Recognised text from ${result.pagesWithText} of ${result.pageCount} pages, one section per page`,
            })
          }
          return outputs
        } finally {
          await recognizer.terminate()
          setPhase('')
        }
      }}
    >
      {({ status }) => (
        <div className={panelClass}>
          <fieldset className="flex flex-col gap-3">
            <legend className="button-sm">What to save</legend>
            {([
              ['pdf', 'Searchable PDF', 'The same pages as images, with the recognised words added as an invisible text layer. Best for keeping and sharing the document.'],
              ['text', 'Text file', 'Just the recognised words, one section per page. Best for copying into something else.'],
              ['both', 'Both', 'The searchable PDF and the text file.'],
            ] as const).map(([value, name, desc]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-surface-raised)] p-4 dark:bg-[var(--color-dark-panel)]">
                <input type="radio" name="ocr-output" value={value} checked={choice === value} onChange={() => setChoice(value)} className="mt-1 accent-[var(--color-accent)]" />
                <span><span className="title-3 block">{name}</span><span className="body-6 block text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{desc}</span></span>
              </label>
            ))}
          </fieldset>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            English text only for now. OCR is slow work — a dense page can take several seconds, and the progress bar moves page by page. The first run also loads the recognition engine (about 6 MB) from this site; after that it is cached on your device.
          </p>
          {status === 'working' && phase ? <p className="body-6" aria-live="polite">{phase}</p> : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
