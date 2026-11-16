import { useEffect, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { WorkspaceFile } from '../../shared/useWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
const tool = getTool('markdown-to-pdf')!

const NOTICE = 'Plain words about fidelity: headings, paragraphs, bold and italic, lists, quotes and code blocks are laid out in a clean A4 document. Images are not included, tables come out as plain lines of text, and exact styling from a Markdown editor will not carry across.'

function EditorPanel({ files, text, onText }: { files: WorkspaceFile[]; text: string; onText: (t: string) => void }) {
  const file = files[0]
  const [loadedFor, setLoadedFor] = useState('')

  useEffect(() => {
    if (!file || loadedFor === file.id) return
    let alive = true
    file.file.text().then((t) => {
      if (alive) { setLoadedFor(file.id); onText(t) }
    })
    return () => { alive = false }
  }, [file, loadedFor, onText])

  return (
    <div className={panelClass}>
      <label className={labelClass}>
        <span className="button-sm">Markdown text</span>
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={12}
          placeholder={'# My document\n\nWrite or paste Markdown here, or add a .md file in step 1 and its text will appear here for editing.'}
          className={`${fieldClass} font-mono`}
        />
      </label>
      <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        {file
          ? 'The file from step 1 is loaded above. Edit it freely — step 3 converts exactly what is in the box.'
          : 'No file needed: paste Markdown into the box and convert it directly. Adding a .md or .txt file in step 1 loads its text here instead.'}
      </p>
    </div>
  )
}

export default function MarkdownToPdfTool() {
  const [text, setText] = useState('')
  return (
    <ToolWorkspace
      tool={tool}
      notice={NOTICE}
      actionLabel={() => 'Convert to PDF'}
      canRun={(files) => text.trim().length > 0 || (files.length === 1 && !files[0].error && !!files[0].buffer)}
      onProcess={async (files) => {
        const source = text.trim() ? text : files[0]?.buffer ? new TextDecoder().decode(files[0].buffer) : ''
        const title = files[0] ? baseName(files[0].file.name) : 'Markdown document'
        const { markdownToPdf } = await import('./process')
        const pdf = await markdownToPdf(source, title)
        return [{
          name: `${title}.pdf`,
          blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }),
          summary: 'Markdown converted to a laid-out PDF',
        }]
      }}
    >
      {({ files }) => <EditorPanel files={files} text={text} onText={setText} />}
    </ToolWorkspace>
  )
}
