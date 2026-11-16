import { useEffect, useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import { DELIMITER_LABELS } from '../spreadsheet/csv'
import type { CleanCsvAnalysis } from './process'
const tool = getTool('clean-csv')!

interface PanelState { forId: string; data: CleanCsvAnalysis | null; error: string | null }

function Analysis({ buffer, forId }: { buffer?: ArrayBuffer; forId: string }) {
  const [state, setState] = useState<PanelState | null>(null)
  useEffect(() => {
    if (!buffer) return
    let alive = true
    import('./process')
      .then((m) => m.analyseCsv(new TextDecoder().decode(buffer)))
      .then((data) => { if (alive) setState({ forId, data, error: null }) })
      .catch((err: unknown) => { if (alive) setState({ forId, data: null, error: err instanceof Error ? err.message : 'This file could not be read as CSV.' }) })
    return () => { alive = false }
  }, [buffer, forId])

  if (!buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a CSV file in step 1 and you will see here exactly what cleaning will change, before anything is downloaded.</p>
  if (!state || state.forId !== forId) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Checking your CSV…</p>
  if (state.error) return <p role="alert" className="body-6 text-[var(--color-danger)]">{state.error}</p>
  const data = state.data
  if (!data) return null
  const { stats } = data
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Rows in', stats.rowsIn],
          ['Rows out', stats.rowsOut],
          ['Duplicates removed', stats.duplicatesRemoved],
          ['Empty rows dropped', stats.emptyDropped],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[var(--color-surface-raised)] p-3 dark:bg-[var(--color-dark-panel)]">
            <dt className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{label}</dt>
            <dd className="title-3 mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.rowsOut === 0 ? (
        <p role="alert" className="body-6 text-[var(--color-danger)]">Every row in this file is empty, so there is nothing to save after cleaning.</p>
      ) : stats.duplicatesRemoved === 0 && stats.emptyDropped === 0 ? (
        <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">This file is already tidy: no duplicates, no empty rows, nothing to trim. Step 3 will still save a cleaned copy if you want one.</p>
      ) : (
        <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Preview of the cleaned file ({DELIMITER_LABELS[data.delimiter].toLowerCase()}-separated, kept from the original):</p>
      )}
      {stats.rowsOut > 0 ? (
        <div className="overflow-x-auto rounded-xl">
          <table className="body-6 w-full border-collapse">
            <tbody>
              {data.previewRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-[var(--color-line)] px-2 py-1 dark:border-[var(--color-dark-line)]">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

export default function CleanCsvTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice="Cleaning means three things, in this order: spaces are trimmed from every value, rows that are then completely empty are dropped, and exact duplicate rows are removed, keeping the first. Nothing else about your data is changed, and the original delimiter is kept."
      actionLabel={() => 'Clean the CSV'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { analyseCsv } = await import('./process')
        const result = analyseCsv(new TextDecoder().decode(files[0].buffer!))
        if (result.stats.rowsOut === 0) throw new Error('Every row in this file is empty, so there is nothing to save after cleaning.')
        const { stats } = result
        return [{
          name: `${baseName(files[0].file.name)}-clean.csv`,
          blob: new Blob([result.csv], { type: 'text/csv' }),
          summary: `${stats.rowsOut} rows kept from ${stats.rowsIn}: ${stats.duplicatesRemoved} duplicates removed, ${stats.emptyDropped} empty rows dropped`,
        }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <Analysis buffer={files[0]?.buffer} forId={files[0]?.id ?? ''} />
        </div>
      )}
    </ToolWorkspace>
  )
}
