import { useEffect, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import type { ExtractedTables } from './process'
const tool = getTool('pdf-to-excel')!

const HONESTY = 'How this works, plainly: the tool reads the PDF text layer and guesses the table from positions — items on one line become a row, and horizontal gaps become columns. That works well on simple, evenly spaced tables and is imperfect on complex layouts: a cell spanning two columns can merge them, and text that is not a table comes out as rows too. The preview below shows exactly what was detected before you download anything. A scanned PDF has no text layer — use the OCR tool on it first.'

const PREVIEW_ROWS = 15
const PREVIEW_COLS = 8

interface PreviewState { buffer: ArrayBuffer; tables: ExtractedTables | null; error: string | null }

function TablePreview({ buffer }: { buffer?: ArrayBuffer }) {
  const [state, setState] = useState<PreviewState | null>(null)

  useEffect(() => {
    if (!buffer) return
    let alive = true
    import('./process')
      .then((m) => m.extractTables(buffer))
      .then((result) => { if (alive) setState({ buffer, tables: result, error: null }) })
      .catch((err: unknown) => {
        if (alive) setState({ buffer, tables: null, error: err instanceof Error ? err.message : 'The table could not be read from this file.' })
      })
    return () => { alive = false }
  }, [buffer])

  if (!buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a PDF in Step 1 and the table found on its first page will be previewed here.</p>
  if (!state || state.buffer !== buffer) return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Reading the table from your PDF…</p>
  if (state.error) return <p role="alert" className="body-6 text-[var(--color-danger)]">{state.error}</p>
  const tables = state.tables
  if (!tables) return null

  const firstPage = tables.pages.findIndex((p) => p.length > 0)
  const rows = (tables.pages[firstPage] ?? []).slice(0, PREVIEW_ROWS)
  const colCount = Math.max(...rows.map((r) => r.length), 0)
  const shownCols = Math.min(colCount, PREVIEW_COLS)
  return (
    <div className="flex flex-col gap-3">
      <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        Preview of page {firstPage + 1}: {tables.rowCount} rows detected across {tables.tablePages} of {tables.pageCount} {tables.pageCount === 1 ? 'page' : 'pages'}.
        {tables.pages[firstPage].length > PREVIEW_ROWS ? ` Showing the first ${PREVIEW_ROWS} rows.` : ''}
        {colCount > PREVIEW_COLS ? ` Showing the first ${PREVIEW_COLS} of ${colCount} columns.` : ''}
      </p>
      <div className="overflow-x-auto rounded-xl">
        <table className="body-6 w-full border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {Array.from({ length: shownCols }, (_, ci) => (
                  <td key={ci} className="border border-[var(--color-line)] px-2 py-1 dark:border-[var(--color-dark-line)]">{row[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PdfToExcelTool() {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  return (
    <ToolWorkspace
      tool={tool}
      notice={HONESTY}
      actionLabel={() => (format === 'xlsx' ? 'Convert to Excel' : 'Convert to CSV')}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { pdfToExcel } = await import('./process')
        const result = await pdfToExcel(files[0].buffer!, format)
        const isXlsx = format === 'xlsx'
        return [{
          name: `${baseName(files[0].file.name)}.${isXlsx ? 'xlsx' : 'csv'}`,
          blob: new Blob([result.data as BlobPart], {
            type: isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
          }),
          summary: isXlsx
            ? `${result.rowCount} rows on ${result.tablePages} sheet${result.tablePages === 1 ? '' : 's'}, one per page with a table`
            : `${result.rowCount} rows from ${result.tablePages} ${result.tablePages === 1 ? 'page' : 'pages'} combined into one CSV table`,
        }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <label className={labelClass}><span className="button-sm">Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className={fieldClass}>
              <option value="xlsx">Excel (.xlsx), one sheet per page</option>
              <option value="csv">CSV (.csv), every page in one table</option>
            </select></label>
          <TablePreview buffer={files[0]?.buffer} />
        </div>
      )}
    </ToolWorkspace>
  )
}
