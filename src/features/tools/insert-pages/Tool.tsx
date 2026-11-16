import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import type { InsertPosition } from './process'
const tool = getTool('insert-pages')!

type Mode = 'blank' | 'pdf'
type PositionChoice = 'start' | 'end' | 'after'

export default function InsertPagesTool() {
  const [mode, setMode] = useState<Mode>('blank')
  const [count, setCount] = useState(1)
  const [positionChoice, setPositionChoice] = useState<PositionChoice>('end')
  const [afterPage, setAfterPage] = useState(1)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [pageList, setPageList] = useState('')

  const pickSource = async (file: File | undefined) => {
    setSourceBuffer(null)
    setSourceName('')
    setSourceError(null)
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setSourceError('The second file must be a PDF.')
      return
    }
    try {
      setSourceBuffer(await file.arrayBuffer())
      setSourceName(file.name)
    } catch {
      setSourceError('That file could not be read.')
    }
  }

  const position = (): InsertPosition =>
    positionChoice === 'after' ? { at: 'after', page: afterPage } : { at: positionChoice }

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Insert pages'}
      canRun={(files) => {
        if (files.length !== 1 || files[0].error || !files[0].buffer) return false
        if (positionChoice === 'after' && (afterPage < 1 || afterPage > (files[0].pageCount ?? 0))) return false
        if (mode === 'blank') return count >= 1 && count <= 100
        return !!sourceBuffer && !sourceError
      }}
      onProcess={async (files) => {
        const buffer = files[0].buffer!
        if (mode === 'blank') {
          const { insertBlankPages, describePosition } = await import('./process')
          const data = await insertBlankPages(buffer, position(), count)
          return [{
            name: 'pages-inserted.pdf',
            blob: new Blob([data as BlobPart], { type: 'application/pdf' }),
            summary: `${count} blank ${count === 1 ? 'page' : 'pages'} inserted ${describePosition(position())}, sized to match the neighbouring page`,
          }]
        }
        const { insertPdfPages, describePosition } = await import('./process')
        const result = await insertPdfPages(buffer, sourceBuffer!, position(), pageList)
        return [{
          name: 'pages-inserted.pdf',
          blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
          summary: `${result.inserted} ${result.inserted === 1 ? 'page' : 'pages'} from ${sourceName} inserted ${describePosition(position())}`,
        }]
      }}
    >
      {({ files }) => {
        const total = files[0]?.pageCount ?? 0
        return (
          <div className={panelClass}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}><span className="button-sm">What to insert</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={fieldClass}>
                  <option value="blank">Blank pages</option>
                  <option value="pdf">Pages from another PDF</option>
                </select></label>
              <label className={labelClass}><span className="button-sm">Where</span>
                <select value={positionChoice} onChange={(e) => setPositionChoice(e.target.value as PositionChoice)} className={fieldClass}>
                  <option value="start">At the start</option>
                  <option value="end">At the end</option>
                  <option value="after">After a chosen page</option>
                </select></label>
            </div>

            {positionChoice === 'after' ? (
              <label className={labelClass}><span className="button-sm">After page</span>
                <input type="number" min={1} max={Math.max(total, 1)} value={afterPage} onChange={(e) => setAfterPage(Number(e.target.value))} className={fieldClass} />
                {total > 0 && (afterPage < 1 || afterPage > total) ? <span role="alert" className="body-6 text-[var(--color-danger)]">Choose a page between 1 and {total}.</span> : null}
              </label>
            ) : null}

            {mode === 'blank' ? (
              <label className={labelClass}><span className="button-sm">How many blank pages</span>
                <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} className={fieldClass} />
              </label>
            ) : (
              <div className="flex flex-col gap-4">
                <label className={labelClass}><span className="button-sm">Second PDF</span>
                  <input type="file" accept="application/pdf" onChange={(e) => void pickSource(e.target.files?.[0])} className={fieldClass} />
                  {sourceName ? <span className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{sourceName} is ready. It is processed on your device, like the main file.</span> : null}
                  {sourceError ? <span role="alert" className="body-6 text-[var(--color-danger)]">{sourceError}</span> : null}
                </label>
                <label className={labelClass}><span className="button-sm">Pages to take from it</span>
                  <input type="text" value={pageList} onChange={(e) => setPageList(e.target.value)} placeholder="Leave blank for every page, or write 1-3, 5" className={fieldClass} />
                </label>
              </div>
            )}
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Blank pages take the size of the page they follow, so the document keeps one page size. Inserted pages are copied exactly as they are in their own file.</p>
          </div>
        )
      }}
    </ToolWorkspace>
  )
}
