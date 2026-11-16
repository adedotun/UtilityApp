import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import type { ProcessOutput, WorkspaceFile } from '../../shared/useWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
const tool = getTool('word-to-markdown')!

const NOTICE = 'How this works, plainly: the document is first turned into clean HTML (the same conversion View Word previews), then that HTML is written out as Markdown. Headings, bold and italic, lists and links carry across. Tables come out as plain text rows, and images are not carried into the Markdown. The HTML version is offered as a second download so nothing is lost.'

async function processOne(file: WorkspaceFile): Promise<ProcessOutput> {
  const { wordToMarkdown } = await import('./process')
  const result = await wordToMarkdown(file.buffer!)
  return {
    name: `${baseName(file.file.name)}.md`,
    blob: new Blob([result.markdown], { type: 'text/markdown' }),
    summary: 'Word document converted to Markdown',
  }
}

export default function WordToMarkdownTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice={NOTICE}
      actionLabel={(files) => (files.length > 1 ? `Convert ${files.length} documents to Markdown` : 'Convert to Markdown')}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && !!f.buffer)}
      onProcess={async (files) => {
        const { wordToMarkdown } = await import('./process')
        const result = await wordToMarkdown(files[0].buffer!)
        const base = baseName(files[0].file.name)
        return [
          { name: `${base}.md`, blob: new Blob([result.markdown], { type: 'text/markdown' }), summary: 'Word document converted to Markdown' },
          { name: `${base}.html`, blob: new Blob([result.html], { type: 'text/html' }), summary: 'The same document as clean HTML, the intermediate step of the conversion' },
        ]
      }}
      batchProcess={processOne}
    >
      {() => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">With one document you get two downloads: the Markdown file and the HTML it was made from. With several documents, each is converted to its own Markdown file in one batch.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
