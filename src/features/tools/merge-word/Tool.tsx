import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('merge-word')!

export default function MergeWordTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice="Documents are joined in the order listed, each starting on a new page, with their own headings and formatting kept. If two documents use the same style name in different ways, the combined file follows one version — check the result before you rely on it."
      actionLabel={(files) => `Merge ${files.length} documents`}
      canRun={(files) => files.length >= 2 && files.every((f) => !f.error && !!f.buffer)}
      reorderable
      onProcess={async (files, _signal, onProgress) => {
        const { mergeWordDocs } = await import('./process')
        onProgress(0.2)
        const merged = await mergeWordDocs(files.map((f) => f.buffer!))
        onProgress(1)
        return [{
          name: 'merged.docx',
          blob: new Blob([merged as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
          summary: `${files.length} Word documents merged into one, in the order listed`,
        }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            {files.length < 2
              ? 'Add at least two Word documents in step 1. You can drag them into a different order in the list above.'
              : `${files.length} documents ready. They will be joined in the order listed in step 1, each starting on a new page.`}
          </p>
        </div>
      )}
    </ToolWorkspace>
  )
}
