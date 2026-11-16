import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
const tool = getTool('scrub-pdf')!

async function processOne(file: WorkspaceFile): Promise<ProcessOutput> {
  const { scrubPdf } = await import('./process')
  const result = await scrubPdf(file.buffer!)
  const summary = result.removed.length
    ? `Removed ${result.removed.length} ${result.removed.length === 1 ? 'item' : 'items'} — ${result.removed.join('; ')}`
    : 'Nothing to remove: no metadata, attachments or JavaScript were found in this file'
  return { name: 'scrubbed.pdf', blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }), summary }
}

export default function ScrubPdfTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice="Scrubbing removes the parts of a PDF you cannot see on the page: its metadata (title, author, subject, keywords, creator and producer), any files attached inside it, and JavaScript set to run when the document opens or is used. The result panel lists exactly what was found and removed, so you can check before you share the file."
      actionLabel={(files) => (files.length > 1 ? `Scrub ${files.length} PDFs` : 'Scrub PDF')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {() => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">There are no settings to choose. Page content, images and form values are left exactly as they are — only the hidden data named above is taken out. If nothing is found, you will be told and the file is returned with its content unchanged. You can add several PDFs and scrub them all in one batch; each file gets its own report of what was removed.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
