import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
const tool = getTool('pdf-to-word')!

const FIDELITY = 'Plain words about fidelity: the Word file is rebuilt from the PDF text layer, so the layout is reconstructed, not identical. Text and paragraphs carry across and larger text becomes headings, but columns, tables, images and exact positioning do not. Check the result before you rely on it.'

async function processOne(file: WorkspaceFile): Promise<ProcessOutput> {
  const { pdfToWord } = await import('./process')
  const result = await pdfToWord(file.buffer!)
  return {
    name: `${baseName(file.file.name)}.docx`,
    blob: new Blob([result.data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    summary: `Word document rebuilt from ${result.pageCount} ${result.pageCount === 1 ? 'page' : 'pages'} as ${result.paragraphCount} paragraphs and headings`,
  }
}

export default function PdfToWordTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice={FIDELITY}
      actionLabel={(files) => (files.length > 1 ? `Convert ${files.length} PDFs to Word` : 'Convert to Word')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => [await processOne(files[0])]}
      batchProcess={processOne}
    >
      {() => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Lines are grouped into paragraphs by their spacing, and text noticeably larger than the body text becomes a heading. A scanned PDF has no text layer to rebuild from — if your file is a scan, use the OCR tool first. You can add several PDFs and convert them all in one batch, one Word document per PDF.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
