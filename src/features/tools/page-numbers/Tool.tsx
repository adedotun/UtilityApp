import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import PageThumbnails from '../../shared/PageThumbnails'
import { getTool } from '../registry'
const tool = getTool('page-numbers')!

export default function PageNumbersTool() {
  const [format, setFormat] = useState<'plain' | 'page' | 'of-total' | 'page-of-total'>('page-of-total')
  const [position, setPosition] = useState<'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'>('bottom-center')
  const [start, setStart] = useState(1)

  const processOne = async (file: WorkspaceFile): Promise<ProcessOutput> => {
    const { addPageNumbers } = await import('./process')
    const data = await addPageNumbers(file.buffer!, format, position, start)
    return { name: 'numbered.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `Page numbers added to ${file.pageCount} pages, starting at ${start}` }
  }

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={(files) => (files.length > 1 ? `Number ${files.length} PDFs` : 'Add page numbers')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {({ files }) => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}><span className="button-sm">Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className={fieldClass}>
                <option value="plain">1</option><option value="page">Page 1</option><option value="of-total">1 / 10</option><option value="page-of-total">Page 1 of 10</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Position</span>
              <select value={position} onChange={(e) => setPosition(e.target.value as typeof position)} className={fieldClass}>
                <option value="bottom-center">Bottom centre</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option>
                <option value="top-center">Top centre</option><option value="top-left">Top left</option><option value="top-right">Top right</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">First page number</span>
              <input type="number" min={0} value={start} onChange={(e) => setStart(Number(e.target.value))} className={fieldClass} />
            </label>
          </div>
          {files.length > 1 ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Numbering restarts at {start} in each file, and any total in the format is that file&apos;s own page count.</p>
          ) : (
            <NumberPreview format={format} position={position} start={start} total={files[0]?.pageCount ?? 10} buffer={files[0]?.buffer} />
          )}
        </div>
      )}
    </ToolWorkspace>
  )
}

import { formatPageNumber } from './process'
function NumberPreview({ format, position, start, total, buffer }: { format: 'plain' | 'page' | 'of-total' | 'page-of-total'; position: string; start: number; total: number; buffer?: ArrayBuffer }) {
  const sample = formatPageNumber(format, start, start + total - 1)
  const align = position.endsWith('left') ? 'text-left' : position.endsWith('right') ? 'text-right' : 'text-center'
  return (
    <div>
      <p className="body-6 mb-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Preview on page 1. It will read: {sample}</p>
      <div className="relative mx-auto max-w-[220px]">
        {buffer ? <PageThumbnails buffer={buffer} pageCount={1} /> : null}
        <span className={`caption-2 absolute right-0 left-0 px-3 ${position.startsWith('top') ? 'top-2' : 'bottom-2'} ${align}`}>{sample}</span>
      </div>
    </div>
  )
}
