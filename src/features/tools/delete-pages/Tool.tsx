import { useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import PageThumbnails from '../../shared/PageThumbnails'
import { getTool } from '../registry'
const tool = getTool('delete-pages')!

export default function DeletePagesTool() {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const toggle = (p: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => `Delete ${selected.size} ${selected.size === 1 ? 'page' : 'pages'}`}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && selected.size > 0 && selected.size < (files[0].pageCount ?? 0)}
      onProcess={async (files) => {
        const { deletePages } = await import('./process')
        const data = await deletePages(files[0].buffer!, [...selected])
        const kept = (files[0].pageCount ?? 0) - selected.size
        return [{ name: 'pages-deleted.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `${selected.size} pages deleted, ${kept} kept in the original order` }]
      }}
    >
      {({ files }) => {
        const total = files[0]?.pageCount ?? 0
        const allSelected = total > 0 && selected.size >= total
        return (
          <div className={panelClass}>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Select the pages to remove. {selected.size} of {total} selected. The pages left over keep their original order.</p>
            {allSelected ? <p role="alert" className="body-6 text-[var(--color-danger)]">Every page is selected. A PDF has to keep at least one page, so unselect at least one page to continue.</p> : null}
            {files[0]?.buffer ? <PageThumbnails buffer={files[0].buffer} pageCount={total} selected={selected} onToggle={toggle} label="Select pages to delete" /> : null}
          </div>
        )
      }}
    </ToolWorkspace>
  )
}
