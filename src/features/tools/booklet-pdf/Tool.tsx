import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import type { SheetName } from './process'
const tool = getTool('booklet-pdf')!

export default function BookletPdfTool() {
  const [sheet, setSheet] = useState<SheetName>('a4')
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Make booklet'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { bookletPdf } = await import('./process')
        const result = await bookletPdf(files[0].buffer!, sheet)
        const blanks = result.paddedBlanks > 0
          ? ` ${result.paddedBlanks} blank ${result.paddedBlanks === 1 ? 'page was' : 'pages were'} added at the end so the pages pair up.`
          : ''
        return [{
          name: 'booklet.pdf',
          blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
          summary: `${result.pageCount} pages imposed onto ${result.sheetCount} ${result.sheetCount === 1 ? 'sheet' : 'sheets'} (${result.sideCount} printed sides), in booklet order.${blanks}`,
        }]
      }}
    >
      {({ files }) => {
        const total = files[0]?.pageCount ?? 0
        const padded = total > 0 ? Math.ceil(total / 4) * 4 : 0
        return (
          <div className={panelClass}>
            <label className={labelClass}><span className="button-sm">Sheet size</span>
              <select value={sheet} onChange={(e) => setSheet(e.target.value as SheetName)} className={fieldClass}>
                <option value="a4">A4 landscape</option>
                <option value="letter">Letter landscape</option>
              </select></label>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              Pages are reordered into printer's pairs — the last page sits beside the first, and so on — two to a landscape sheet.
              {total > 0 ? ` This document has ${total} ${total === 1 ? 'page' : 'pages'}, which makes ${padded / 4} ${padded / 4 === 1 ? 'sheet' : 'sheets'}${padded > total ? `, with ${padded - total} blank ${padded - total === 1 ? 'page' : 'pages'} added at the end so the pairing works` : ''}.` : ''}
            </p>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              To print it: choose double-sided printing and flip on the short edge, then fold the whole stack in half. The pages will read in order.
            </p>
          </div>
        )
      }}
    </ToolWorkspace>
  )
}
