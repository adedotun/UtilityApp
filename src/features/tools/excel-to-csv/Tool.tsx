import { useEffect, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import type { SheetData } from './process'
const tool = getTool('excel-to-csv')!

const PREVIEW_ROWS = 15

interface PanelState { forId: string; data: SheetData | null; error: string | null }

function SheetPanel({ buffer, forId, sheet, onSheet }: { buffer?: ArrayBuffer; forId: string; sheet: string; onSheet: (s: string) => void }) {
  const [state, setState] = useState<PanelState | null>(null)
  useEffect(() => {
    if (!buffer) return
    let alive = true
    import('./process')
      .then((m) => m.sheetRows(buffer, sheet || undefined))
      .then((data) => { if (alive) setState({ forId, data, error: null }) })
      .catch((err: unknown) => { if (alive) setState({ forId, data: null, error: err instanceof Error ? err.message : 'This file could not be read as a spreadsheet.' }) })
    return () => { alive = false }
  }, [buffer, forId, sheet])

  if (!buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a spreadsheet in step 1 and its sheets and first rows will be previewed here.</p>
  if (!state || state.forId !== forId) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Reading your spreadsheet…</p>
  if (state.error) return <p role="alert" className="body-6 text-[var(--color-danger)]">{state.error}</p>
  const data = state.data
  if (!data) return null
  const rows = data.rows.slice(0, PREVIEW_ROWS)
  const colCount = Math.max(...data.rows.map((r) => r.length), 0)
  return (
    <div className="flex flex-col gap-4">
      {data.sheetNames.length > 1 ? (
        <label className={labelClass}><span className="button-sm">Sheet to convert</span>
          <select value={data.sheetName} onChange={(e) => onSheet(e.target.value)} className={fieldClass}>
            {data.sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>
      ) : (
        <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">This workbook has one sheet, &ldquo;{data.sheetName}&rdquo;.</p>
      )}
      <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        {data.rows.length} rows and up to {colCount} columns on this sheet.
        {data.rows.length > PREVIEW_ROWS ? ` Showing the first ${PREVIEW_ROWS} rows.` : ''}
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

export default function ExcelToCsvTool() {
  const [sheet, setSheet] = useState('')
  return (
    <ToolWorkspace
      tool={tool}
      notice="One sheet becomes one CSV file, with values written as they are displayed in the spreadsheet — formulas are saved as their results, not their workings. Values holding commas, quotes or line breaks are quoted following RFC 4180, so other programs read them back correctly."
      actionLabel={() => 'Convert to CSV'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { excelToCsv } = await import('./process')
        const result = await excelToCsv(files[0].buffer!, sheet || undefined)
        return [{
          name: `${baseName(files[0].file.name)}.csv`,
          blob: new Blob([result.csv], { type: 'text/csv' }),
          summary: `${result.rowCount} rows from the sheet "${result.sheetName}"`,
        }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <SheetPanel buffer={files[0]?.buffer} forId={files[0]?.id ?? ''} sheet={sheet} onSheet={setSheet} />
        </div>
      )}
    </ToolWorkspace>
  )
}
