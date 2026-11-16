import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('merge-pdf')!

export default function MergePdfTool() {
  return (
    <ToolWorkspace
      tool={tool}
      reorderable
      actionLabel={(files) => `Merge ${files.length} PDFs`}
      canRun={(files) => files.length >= 2 && files.every((f) => !f.error && f.buffer)}
      onProcess={async (files, _s, onProgress) => {
        const { mergePdfs } = await import('./process')
        const total = files.reduce((a, f) => a + (f.pageCount ?? 0), 0)
        onProgress(0.4)
        const data = await mergePdfs(files.map((f) => f.buffer!))
        onProgress(1)
        return [{ name: 'merged.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `${files.length} PDFs merged into ${total} pages` }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <p className="body-3">Files merge in the order listed in step 1. Use the arrows there to change the order.</p>
          <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            {files.length} files · {files.reduce((a, f) => a + (f.pageCount ?? 0), 0)} pages in total · {(files.reduce((a, f) => a + f.file.size, 0) / 1024).toFixed(1)} KB
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
