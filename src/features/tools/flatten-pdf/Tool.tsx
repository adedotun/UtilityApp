import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
const tool = getTool('flatten-pdf')!

async function processOne(file: WorkspaceFile): Promise<ProcessOutput> {
  const { flattenPdf } = await import('./process')
  const result = await flattenPdf(file.buffer!)
  return { name: 'flattened.pdf', blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }), summary: `${result.fieldCount} form ${result.fieldCount === 1 ? 'field' : 'fields'} flattened into the pages` }
}

export default function FlattenPdfTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice="Flattening bakes form fields into the pages themselves. The values stay visible and printable, but nobody can type into the fields or change them afterwards. If a PDF has no form fields, you will be told here and nothing will be changed."
      actionLabel={(files) => (files.length > 1 ? `Flatten ${files.length} PDFs` : 'Flatten PDF')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {() => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">There are no settings to choose. Flatten a filled form before sending it when you want the answers locked in as part of the page, rather than left editable. You can add several PDFs and flatten them all in one batch; a file with no form fields is listed with that reason and the others still process.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
