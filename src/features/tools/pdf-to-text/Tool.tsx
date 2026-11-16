import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
const tool = getTool('pdf-to-text')!

async function processOne(file: WorkspaceFile): Promise<ProcessOutput> {
  const { extractPdfText } = await import('./process')
  const result = await extractPdfText(file.buffer!)
  return { name: `${baseName(file.file.name)}.txt`, blob: new Blob([result.text], { type: 'text/plain' }), summary: `Text copied from ${result.pagesWithText} of ${result.pageCount} pages, one section per page` }
}

export default function PdfToTextTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice="Only the PDF text layer is copied out. A scanned PDF is a set of images with no text layer, so if your file has no readable text you will be told here instead of being given an empty file."
      actionLabel={(files) => (files.length > 1 ? `Extract text from ${files.length} PDFs` : 'Extract text')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {() => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">The text file holds one section per page, headed with its page number, in reading order. Pages with no text are marked in the file rather than left blank without explanation. You can add several PDFs and extract them all in one batch, one text file per PDF.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
