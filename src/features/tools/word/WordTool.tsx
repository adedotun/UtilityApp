
import { useEffect, useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import { baseName } from '../../../lib/files'

const FIDELITY = 'Plain words about fidelity: this conversion keeps your text and paragraph structure. Complex Word layout, tables, headers and styling will not carry across exactly. Check the result before you rely on it.'

export function WordConvertTool({ slug }: { slug: string }) {
  const tool = getTool(slug)!
  return (
    <ToolWorkspace
      tool={tool}
      notice={FIDELITY}
      actionLabel={(files) => `Convert ${files.length} ${files.length === 1 ? 'document' : 'documents'} to PDF`}
      canRun={(files) => files.length >= 1 && files.every((f) => !f.error && f.buffer)}
      onProcess={async (files, _s, onProgress) => {
        const mammoth = (await import('mammoth')) as unknown as { extractRawText: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
        const { textToPdf } = await import('../word/process')
        const pdfs: ArrayBuffer[] = []
        for (let i = 0; i < files.length; i++) {
          const { value } = await mammoth.extractRawText({ arrayBuffer: files[i].buffer! })
          if (!value.trim()) throw new Error(`${files[i].file.name} appears to contain no readable text.`)
          pdfs.push((await textToPdf(value, baseName(files[i].file.name))) as unknown as ArrayBuffer)
          onProgress((i + 1) / files.length)
        }
        if (pdfs.length === 1) return [{ name: 'converted.pdf', blob: new Blob([pdfs[0]], { type: 'application/pdf' }), summary: 'Word document converted to PDF, text and paragraphs kept' }]
        const { mergePdfs } = await import('../merge-pdf/process')
        const merged = await mergePdfs(pdfs)
        return [{ name: 'converted.pdf', blob: new Blob([merged as BlobPart], { type: 'application/pdf' }), summary: `${files.length} Word documents converted and combined into one PDF` }]
      }}
    >
      {({ files }) => (slug === 'view-word' ? <WordPreview file={files[0]} /> : (
        <div className={panelClass}><p className="body-3">Each document is converted in step 3. With more than one document, the PDFs are combined into a single file in the order listed.</p></div>
      ))}
    </ToolWorkspace>
  )
}

function WordPreview({ file }: { file?: { id: string; buffer?: ArrayBuffer; file: File } }) {
  const [html, setHtml] = useState('')
  const [htmlFor, setHtmlFor] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!file?.buffer) return
    let alive = true
    ;(async () => {
      try {
        const mammoth = (await import('mammoth')) as unknown as { convertToHtml: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
        const { value } = await mammoth.convertToHtml({ arrayBuffer: file.buffer! })
        if (alive) { setHtml(value); setHtmlFor(file.id); setError('') }
      } catch { if (alive) setError('This document could not be previewed. It may be damaged or in an older format.') }
    })()
    return () => { alive = false }
  }, [file?.id, file?.buffer])
  if (!file) return <div className={panelClass}><p className="body-3">Add a Word document above and a readable preview will appear here. Use step 3 to convert it to PDF.</p></div>
  if (error) return <div className={panelClass}><p role="alert" className="body-6 text-[var(--color-danger)]">{error}</p></div>
  if (!html || htmlFor !== file.id) return <div className={panelClass}><p className="body-3" aria-busy="true">Preparing the preview…</p></div>
  return (
    <div className={panelClass}>
      <article className="prose-like flex flex-col gap-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--color-line)] [&_td]:p-2" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Preview rendered from your document on this device. Use step 3 to convert it to PDF.</p>
    </div>
  )
}
