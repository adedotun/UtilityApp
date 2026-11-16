import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import type { SlideImage } from './process'
const tool = getTool('pdf-to-powerpoint')!

const HONESTY = 'Plainly: each slide is a picture of the page. The presentation looks exactly like the PDF, but the text on the slides is not editable and animations or speaker notes are not created. If you need editable text, use PDF to Word instead.'

export default function PdfToPowerPointTool() {
  const [scale, setScale] = useState(2)
  return (
    <ToolWorkspace
      tool={tool}
      notice={HONESTY}
      actionLabel={() => 'Convert to PowerPoint'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => {
        const { loadPdfJs } = await import('../../../lib/pdfjs')
        const { buildPptx } = await import('./process')
        const doc = await loadPdfJs(files[0].buffer!)
        const total = doc.numPages
        const images: SlideImage[] = []
        const canvas = document.createElement('canvas')
        for (let p = 1; p <= total; p++) {
          if (signal.aborted) throw new Error('Cancelled')
          const page = await doc.getPage(p)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas is not available in this browser.')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          images.push({ dataUrl: canvas.toDataURL('image/png'), widthPt: base.width, heightPt: base.height })
          onProgress(p / total)
        }
        const data = await buildPptx(images)
        return [{
          name: `${baseName(files[0].file.name)}.pptx`,
          blob: new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
          summary: `${total} ${total === 1 ? 'slide' : 'slides'}, one picture of each page, in a presentation sized to the first page`,
        }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <label className={labelClass}><span className="button-sm">Picture resolution</span>
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className={fieldClass}>
              <option value={1}>1x, screen</option>
              <option value={2}>2x, sharp</option>
              <option value={3}>3x, print</option>
            </select></label>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Higher resolution slides look sharper on a big screen and make a larger file. The presentation itself is sized from the first page, so a document with mixed page sizes has its other pages fitted inside, centred.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
