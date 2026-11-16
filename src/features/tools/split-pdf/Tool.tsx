import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import { planSplit, type SplitMode } from './process'
const tool = getTool('split-pdf')!

export default function SplitPdfTool() {
  const [mode, setMode] = useState<SplitMode>('all')
  const [ranges, setRanges] = useState('1-3')
  const [everyN, setEveryN] = useState(2)
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Split PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, _s, onProgress) => {
        const { splitPdf } = await import('./process')
        onProgress(0.3)
        const parts = await splitPdf(files[0].buffer!, mode, ranges, everyN)
        onProgress(1)
        return parts.map((part) => ({ name: part.name, blob: new Blob([part.data as BlobPart], { type: 'application/pdf' }), summary: `Split into ${parts.length} files` }))
      }}
    >
      {({ files }) => {
        const count = files[0]?.pageCount ?? 0
        let preview: string | null = null
        let previewError: string | null = null
        if (count > 0) {
          try { const n = planSplit(mode, count, ranges, everyN).length; preview = `This will create ${n} ${n === 1 ? 'file' : 'files'} from ${count} pages.` }
          catch (e) { previewError = e instanceof Error ? e.message : 'Check the ranges.' }
        }
        return (
          <div className={panelClass}>
            <label className={labelClass}><span className="button-sm">Split by</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as SplitMode)} className={fieldClass}>
                <option value="all">Every page on its own</option>
                <option value="ranges">Page ranges</option>
                <option value="every-n">Every N pages</option>
              </select></label>
            {mode === 'ranges' ? (
              <label className={labelClass}><span className="button-sm">Ranges, for example 1-3, 5-7</span>
                <input value={ranges} onChange={(e) => setRanges(e.target.value)} className={fieldClass} placeholder="1-3, 5-7" />
              </label>
            ) : null}
            {mode === 'every-n' ? (
              <label className={labelClass}><span className="button-sm">Pages per file</span>
                <input type="number" min={1} value={everyN} onChange={(e) => setEveryN(Number(e.target.value))} className={fieldClass} />
              </label>
            ) : null}
            {previewError ? <p role="alert" className="body-6 text-[var(--color-danger)]">{previewError}</p> : null}
            {preview ? <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{preview}</p> : null}
            {!count ? <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a PDF to see how many files this will create.</p> : null}
          </div>
        )
      }}
    </ToolWorkspace>
  )
}
