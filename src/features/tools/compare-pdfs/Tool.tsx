import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import type { ComparisonResult, PageStatus } from './process'
const tool = getTool('compare-pdfs')!

const STATUS_LABELS: Record<PageStatus, string> = {
  same: 'Same',
  changed: 'Text changed',
  'only-in-a': 'Only in the first PDF',
  'only-in-b': 'Only in the second PDF',
}

const MAX_DIFF_LINES = 60

interface CompareState { aBuffer: ArrayBuffer; bBuffer: ArrayBuffer; result: ComparisonResult }

export default function ComparePdfsTool() {
  const [secondBuffer, setSecondBuffer] = useState<ArrayBuffer | null>(null)
  const [secondName, setSecondName] = useState('')
  const [secondError, setSecondError] = useState<string | null>(null)
  const [compareState, setCompareState] = useState<CompareState | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [openPages, setOpenPages] = useState<Set<number>>(new Set())

  const pickSecond = async (file: File | undefined) => {
    setSecondBuffer(null)
    setSecondName('')
    setSecondError(null)
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setSecondError('The second file must be a PDF.')
      return
    }
    try {
      setSecondBuffer(await file.arrayBuffer())
      setSecondName(file.name)
    } catch {
      setSecondError('That file could not be read.')
    }
  }

  const runCompare = async (aBuffer: ArrayBuffer, bBuffer: ArrayBuffer): Promise<ComparisonResult> => {
    const { comparePdfs } = await import('./process')
    const result = await comparePdfs(aBuffer, bBuffer)
    setCompareState({ aBuffer, bBuffer, result })
    return result
  }

  const togglePage = (page: number) => setOpenPages((prev) => { const n = new Set(prev); if (n.has(page)) n.delete(page); else n.add(page); return n })

  return (
    <ToolWorkspace
      tool={tool}
      notice="This compares the words only: page 1 against page 1, page 2 against page 2, and so on. Layout, fonts, images and page design are not compared, and a page that moved will show as changed in both places. Scanned PDFs have no text to compare — run OCR on them first."
      actionLabel={() => 'Compare and save the report'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && !!secondBuffer && !secondError}
      onProcess={async (files) => {
        const result = await runCompare(files[0].buffer!, secondBuffer!)
        const { comparisonReport } = await import('./process')
        const report = comparisonReport(result, files[0].file.name, secondName || 'second PDF')
        const c = result.counts
        return [{
          name: 'comparison-report.txt',
          blob: new Blob([report], { type: 'text/plain' }),
          summary: `${c.same} ${c.same === 1 ? 'page' : 'pages'} the same, ${c.changed} changed, ${c['only-in-a']} only in the first PDF, ${c['only-in-b']} only in the second`,
        }]
      }}
    >
      {({ files }) => {
        const aBuffer = files[0]?.buffer
        const result = compareState && aBuffer && secondBuffer && compareState.aBuffer === aBuffer && compareState.bBuffer === secondBuffer
          ? compareState.result
          : null
        return (
          <div className={panelClass}>
            <label className={labelClass}><span className="button-sm">Second PDF</span>
              <input type="file" accept="application/pdf" onChange={(e) => void pickSecond(e.target.files?.[0])} className={fieldClass} />
              {secondName ? <span className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{secondName} is ready. It is processed on your device, like the main file.</span> : null}
              {secondError ? <span role="alert" className="body-6 text-[var(--color-danger)]">{secondError}</span> : null}
            </label>
            <div>
              <button
                type="button"
                disabled={!aBuffer || !secondBuffer || comparing}
                onClick={() => {
                  if (!aBuffer || !secondBuffer) return
                  setComparing(true)
                  setCompareError(null)
                  runCompare(aBuffer, secondBuffer)
                    .catch((e: unknown) => setCompareError(e instanceof Error ? e.message : 'The files could not be compared.'))
                    .finally(() => setComparing(false))
                }}
                className="button-md rounded-xl bg-[var(--color-accent)] px-3 py-2 text-white outline-none transition-all duration-300 hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {comparing ? 'Comparing…' : 'Compare text'}
              </button>
            </div>
            {compareError ? <p role="alert" className="body-6 text-[var(--color-danger)]">{compareError}</p> : null}
            {result ? (
              <div className="flex flex-col gap-3">
                <p className="body-6">
                  {result.counts.same} {result.counts.same === 1 ? 'page' : 'pages'} the same · {result.counts.changed} changed · {result.counts['only-in-a']} only in the first PDF · {result.counts['only-in-b']} only in the second PDF.
                  The first PDF has {result.aPageCount} {result.aPageCount === 1 ? 'page' : 'pages'}, the second has {result.bPageCount}.
                </p>
                <ul className="flex flex-col">
                  {result.pages.map((page) => (
                    <li key={page.page} className="border-t border-[var(--color-line)] py-2 first:border-t-0 dark:border-[var(--color-dark-line)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="body-6">Page {page.page} — {STATUS_LABELS[page.status]}</span>
                        {page.status === 'changed' ? (
                          <button type="button" onClick={() => togglePage(page.page)} aria-expanded={openPages.has(page.page)} className="button-sm rounded-lg bg-[var(--color-surface-raised)] px-2 py-1 outline-none transition-all duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">
                            {openPages.has(page.page) ? 'Hide the differences' : 'Show the differences'}
                          </button>
                        ) : null}
                      </div>
                      {page.status === 'changed' && openPages.has(page.page) && page.diff ? (
                        <div className="mt-2 flex flex-col gap-1 rounded-xl bg-[var(--color-surface-raised)] p-3 dark:bg-[var(--color-dark-panel)]">
                          {page.diff.slice(0, MAX_DIFF_LINES).map((line, i) => (
                            <p key={i} className={`body-6 ${line.kind === 'removed' ? 'text-[var(--color-danger)]' : line.kind === 'same' ? 'text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]' : ''}`}>
                              {line.kind === 'removed' ? '− ' : line.kind === 'added' ? '+ ' : '  '}{line.text}
                            </p>
                          ))}
                          {page.diff.length > MAX_DIFF_LINES ? <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">And {page.diff.length - MAX_DIFF_LINES} more lines on this page — the downloaded report has them all.</p> : null}
                          <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">− only in the first PDF · + only in the second PDF</p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )
      }}
    </ToolWorkspace>
  )
}
