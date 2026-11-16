import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import PageThumbnails from '../../shared/PageThumbnails'
import { getTool } from '../registry'
import { describePageList } from '../split-pdf/prompt'
import type { BlankDetection, BlankSensitivity } from './process'
const tool = getTool('remove-blank-pages')!

interface DetectionState { buffer: ArrayBuffer; sensitivity: BlankSensitivity; result: BlankDetection }

export default function RemoveBlankPagesTool() {
  const [sensitivity, setSensitivity] = useState<BlankSensitivity>('normal')
  const [toRemove, setToRemove] = useState<Set<number>>(new Set())
  const [detection, setDetection] = useState<DetectionState | null>(null)
  const [detecting, setDetecting] = useState(0)
  const [detectError, setDetectError] = useState<string | null>(null)

  const toggle = (p: number) => setToRemove((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })

  const runDetection = async (buffer: ArrayBuffer) => {
    setDetectError(null)
    setDetection(null)
    setToRemove(new Set())
    setDetecting(0)
    try {
      const { detectBlankPages } = await import('./process')
      const { loadPdfJs } = await import('../../../lib/pdfjs')
      const { pageTextFromItems } = await import('../pdf-to-text/process')
      const doc = await loadPdfJs(buffer)
      const canvas = document.createElement('canvas')
      const result = await detectBlankPages(buffer, sensitivity, {
        renderPage: async (pageNum) => {
          const page = await doc.getPage(pageNum)
          const pt = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: 500 / pt.width })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) throw new Error('Canvas is not available in this browser.')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const content = await page.getTextContent()
          return {
            pixels: { data: image.data, width: image.width, height: image.height },
            text: pageTextFromItems(content.items as unknown[]),
          }
        },
        onProgress: (page) => setDetecting(page),
      })
      setDetection({ buffer, sensitivity, result })
      setToRemove(new Set(result.blankPages))
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'The pages could not be checked.')
    } finally {
      setDetecting(0)
    }
  }

  const current = (buffer?: ArrayBuffer) =>
    detection && buffer && detection.buffer === buffer && detection.sensitivity === sensitivity ? detection.result : null

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => `Remove ${toRemove.size} blank ${toRemove.size === 1 ? 'page' : 'pages'}`}
      canRun={(files) => {
        const result = current(files[0]?.buffer)
        return files.length === 1 && !files[0].error && !!files[0].buffer && !!result && toRemove.size > 0 && toRemove.size < result.pageCount
      }}
      onProcess={async (files) => {
        const { deletePages } = await import('../delete-pages/process')
        const data = await deletePages(files[0].buffer!, [...toRemove])
        const kept = (files[0].pageCount ?? 0) - toRemove.size
        return [{
          name: 'blank-pages-removed.pdf',
          blob: new Blob([data as BlobPart], { type: 'application/pdf' }),
          summary: `${toRemove.size} blank ${toRemove.size === 1 ? 'page' : 'pages'} removed (${describePageList([...toRemove])}), ${kept} ${kept === 1 ? 'page' : 'pages'} kept in the original order`,
        }]
      }}
    >
      {({ files }) => {
        const f = files[0]
        const result = current(f?.buffer)
        const stale = !!detection && !!f?.buffer && !result
        const allSelected = !!result && toRemove.size >= result.pageCount
        return (
          <div className={panelClass}>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              A page counts as blank when it has no readable text and, rendered, it is all one colour — nothing printed on it. Detection runs first and shows you exactly which pages it found; nothing is removed until you run Step 3, and you can unselect any page to keep it.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}><span className="button-sm">Sensitivity</span>
                <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value as BlankSensitivity)} className={fieldClass}>
                  <option value="strict">Strict — only completely empty pages</option>
                  <option value="normal">Normal — a faint speck or two still counts as blank</option>
                  <option value="loose">Loose — small marks still count as blank</option>
                </select></label>
              <div className={labelClass}>
                <span className="button-sm">Check the pages</span>
                <button
                  type="button"
                  disabled={!f?.buffer || detecting > 0}
                  onClick={() => { if (f?.buffer) void runDetection(f.buffer) }}
                  className="button-md rounded-xl bg-[var(--color-accent)] px-3 py-2 text-white outline-none transition-all duration-300 hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {detecting > 0 ? `Checking page ${detecting}…` : 'Find blank pages'}
                </button>
              </div>
            </div>
            {detectError ? <p role="alert" className="body-6 text-[var(--color-danger)]">{detectError}</p> : null}
            {stale && !detectError ? <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">The file or sensitivity changed since the last check. Run Find blank pages again.</p> : null}
            {result ? (
              result.blankPages.length === 0 ? (
                <p className="body-6">No blank pages were found at this sensitivity. Every page has text or visible marks on it.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="body-6">
                    {result.blankPages.length === 1 ? 'One page looks blank' : `${result.blankPages.length} pages look blank`}: {describePageList(result.blankPages)}.
                    They are selected below for removal — unselect any page you want to keep. {toRemove.size} of {result.pageCount} pages selected for removal.
                  </p>
                  {allSelected ? <p role="alert" className="body-6 text-[var(--color-danger)]">Every page is selected. A PDF has to keep at least one page, so unselect at least one page to continue.</p> : null}
                  {f?.buffer ? <PageThumbnails buffer={f.buffer} pageCount={result.pageCount} selected={toRemove} onToggle={toggle} label="Pages to remove" /> : null}
                </div>
              )
            ) : null}
          </div>
        )
      }}
    </ToolWorkspace>
  )
}
