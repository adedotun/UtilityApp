import { useEffect, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import { DELIMITER_LABELS, type CsvDelimiter } from '../spreadsheet/csv'
import type { CsvData, DelimiterChoice } from './process'
const tool = getTool('csv-to-excel')!

const PREVIEW_ROWS = 15
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

interface PanelState { forId: string; data: CsvData | null; error: string | null }

function Preview({ buffer, forId, choice }: { buffer?: ArrayBuffer; forId: string; choice: DelimiterChoice }) {
  const [state, setState] = useState<PanelState | null>(null)
  useEffect(() => {
    if (!buffer) return
    let alive = true
    import('./process')
      .then((m) => m.readCsv(new TextDecoder().decode(buffer), choice))
      .then((data) => { if (alive) setState({ forId, data, error: null }) })
      .catch((err: unknown) => { if (alive) setState({ forId, data: null, error: err instanceof Error ? err.message : 'This file could not be read as CSV.' }) })
    return () => { alive = false }
  }, [buffer, forId, choice])

  if (!buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a CSV file in step 1 and its first rows will be previewed here.</p>
  if (!state || state.forId !== forId) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Reading your CSV…</p>
  if (state.error) return <p role="alert" className="body-6 text-[var(--color-danger)]">{state.error}</p>
  const data = state.data
  if (!data) return null
  const rows = data.rows.slice(0, PREVIEW_ROWS)
  return (
    <div className="flex flex-col gap-3">
      <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        {data.rowCount} rows and up to {data.colCount} columns, read as {DELIMITER_LABELS[data.delimiter].toLowerCase()}-separated.
        {data.rowCount > PREVIEW_ROWS ? ` Showing the first ${PREVIEW_ROWS} rows.` : ''}
      </p>
      <div className="overflow-x-auto rounded-xl">
        <table className="body-6 w-full border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-[var(--color-line)] px-2 py-1 dark:border-[var(--color-dark-line)]">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function CsvToExcelTool() {
  const [choice, setChoice] = useState<DelimiterChoice>('auto')
  return (
    <ToolWorkspace
      tool={tool}
      notice="Values are copied as text exactly as they appear in the CSV. If a column of long numbers or dates looks different in Excel, that is Excel reformatting the text on its side — the file itself holds what the CSV held."
      actionLabel={() => 'Convert to Excel'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { csvToXlsx } = await import('./process')
        const result = await csvToXlsx(new TextDecoder().decode(files[0].buffer!), choice)
        return [{
          name: `${baseName(files[0].file.name)}.xlsx`,
          blob: new Blob([result.data as BlobPart], { type: XLSX_TYPE }),
          summary: `${result.rowCount} rows and up to ${result.colCount} columns, read as ${DELIMITER_LABELS[result.delimiter].toLowerCase()}-separated`,
        }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <label className={labelClass}><span className="button-sm">Delimiter</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value as DelimiterChoice)} className={fieldClass}>
              <option value="auto">Auto-detect</option>
              {(Object.keys(DELIMITER_LABELS) as CsvDelimiter[]).map((d) => (
                <option key={d} value={d}>{DELIMITER_LABELS[d]}</option>
              ))}
            </select></label>
          <Preview buffer={files[0]?.buffer} forId={files[0]?.id ?? ''} choice={choice} />
        </div>
      )}
    </ToolWorkspace>
  )
}
