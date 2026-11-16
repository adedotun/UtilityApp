import { useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import PageThumbnails from '../../shared/PageThumbnails'
import { getTool } from '../registry'
const tool = getTool('extract-pages')!

export default function ExtractPagesTool() {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const toggle = (p: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => `Extract ${selected.size} ${selected.size === 1 ? 'page' : 'pages'}`}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && selected.size > 0}
      onProcess={async (files) => {
        const { extractPages } = await import('./process')
        const data = await extractPages(files[0].buffer!, [...selected])
        return [{ name: 'extracted.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `${selected.size} pages extracted, in page order` }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Select the pages to keep. {selected.size} of {files[0]?.pageCount ?? 0} selected. Pages are extracted in their original order.</p>
          {files[0]?.buffer ? <PageThumbnails buffer={files[0].buffer} pageCount={files[0].pageCount ?? 0} selected={selected} onToggle={toggle} label="Select pages to extract" /> : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
