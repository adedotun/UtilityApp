import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import PageThumbnails from '../../shared/PageThumbnails'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import { addHeaderFooter, expandPlaceholders, type StampAlign, type StampPlacement } from './process'
const tool = getTool('headers-footers')!

export default function HeadersFootersTool() {
  const [text, setText] = useState('')
  const [placement, setPlacement] = useState<StampPlacement>('footer')
  const [align, setAlign] = useState<StampAlign>('center')
  const [fontSize, setFontSize] = useState(10)
  const [opacity, setOpacity] = useState(100)
  const [today] = useState(() => new Date().toLocaleDateString())

  const processOne = async (file: WorkspaceFile): Promise<ProcessOutput> => {
    const data = await addHeaderFooter(file.buffer!, {
      text,
      placement,
      align,
      fontSize,
      opacity: opacity / 100,
      filename: baseName(file.file.name),
      date: today,
    })
    return { name: 'stamped.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `Stamped in the ${placement} of ${file.pageCount} pages` }
  }

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={(files) => (files.length > 1 ? `Stamp ${files.length} PDFs` : 'Add header or footer')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer) && text.trim().length > 0}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Text to stamp</span>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: Acme report, page {page} of {total}" className={fieldClass} /></label>
            <label className={labelClass}><span className="button-sm">Position</span>
              <select value={placement} onChange={(e) => setPlacement(e.target.value as StampPlacement)} className={fieldClass}>
                <option value="header">Header, top of every page</option>
                <option value="footer">Footer, bottom of every page</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Alignment</span>
              <select value={align} onChange={(e) => setAlign(e.target.value as StampAlign)} className={fieldClass}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Font size</span>
              <input type="number" min={6} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className={fieldClass} /></label>
            <label className={labelClass}><span className="button-sm">Opacity · {opacity} percent</span>
              <input type="range" min={5} max={100} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" /></label>
          </div>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            Placeholders you can use: {'{page}'} the page number, {'{total}'} the page count, {'{date}'} today&apos;s date, {'{filename}'} the file name. They are filled in separately on every page.
          </p>
          {files.length > 1 ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">With several PDFs added, the stamp is applied to each file in one batch. Placeholders are filled in per file, so {'{filename}'} and {'{total}'} use each file&apos;s own name and page count.</p>
          ) : (
            <StampPreview text={text} placement={placement} align={align} total={files[0]?.pageCount ?? 0} filename={files[0] ? baseName(files[0].file.name) : 'document'} date={today} buffer={files[0]?.buffer} />
          )}
        </div>
      )}
    </ToolWorkspace>
  )
}

function StampPreview({ text, placement, align, total, filename, date, buffer }: { text: string; placement: StampPlacement; align: StampAlign; total: number; filename: string; date: string; buffer?: ArrayBuffer }) {
  if (!text.trim()) return null
  const sample = expandPlaceholders(text, { page: 1, total: total || 1, date, filename })
  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
  return (
    <div>
      <p className="body-6 mb-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Preview on page 1. It will read: {sample}</p>
      <div className="relative mx-auto max-w-[220px]">
        {buffer ? <PageThumbnails buffer={buffer} pageCount={1} /> : null}
        <span className={`caption-2 absolute right-0 left-0 px-3 ${placement === 'header' ? 'top-2' : 'bottom-2'} ${alignClass}`}>{sample}</span>
      </div>
    </div>
  )
}
