import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
const tool = getTool('repair-pdf')!

async function processOne(file: WorkspaceFile): Promise<ProcessOutput> {
  const { repairPdf } = await import('./process')
  const result = await repairPdf(file.buffer!)
  return {
    name: 'repaired.pdf',
    blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
    summary: result.warnings
      ? 'Rewritten into a clean file. qpdf reported warnings while fixing the structure, which is normal for a damaged file.'
      : 'Rewritten into a clean, standard file with no problems found.',
  }
}

export default function RepairPdfTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice="Repair means a clean structural rewrite: qpdf rebuilds the file's internal structure and writes a fresh, standard PDF, running locally in your browser. It fixes broken cross-references and malformed structure. It cannot bring back pages or content that are missing from the file."
      actionLabel={(files) => (files.length > 1 ? `Repair ${files.length} PDFs` : 'Repair PDF')}
      canRun={(files) => files.length >= 1 && files.every((f) => !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {() => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">There are no settings to choose. If your reader says a file is damaged, will not open, or opens with errors, a rewrite is the standard first fix. Password protected files cannot be repaired here; remove the password first if you know it. You can add several PDFs and repair them all in one batch; a file beyond repair is listed with its reason and the others still process.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
