import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('edit-metadata')!

import { useEffect } from 'react'
export default function EditMetadataTool() {
  const [fields, setFields] = useState({ title: '', author: '', subject: '', keywords: '' })
  const [loaded, setLoaded] = useState('')
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Save metadata'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { setMetadata } = await import('./process')
        const data = await setMetadata(files[0].buffer!, fields)
        return [{ name: 'updated.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: 'Metadata updated' }]
      }}
    >
      {({ files }) => {
        const buffer = files[0]?.buffer
        const key = files[0]?.id ?? ''
        return (
          <div className={panelClass}>
            <MetadataLoader buffer={buffer} fileKey={key} loaded={loaded} setLoaded={setLoaded} setFields={setFields} />
            {(['title', 'author', 'subject', 'keywords'] as const).map((k) => (
              <label key={k} className={labelClass}><span className="button-sm">{k === 'keywords' ? 'Keywords, separated by commas' : k[0].toUpperCase() + k.slice(1)}</span>
                <input value={fields[k]} onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))} className={fieldClass} />
              </label>
            ))}
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">The fields above are filled with the metadata already in your PDF. Change what you need, then save.</p>
          </div>
        )
      }}
    </ToolWorkspace>
  )
}

function MetadataLoader({ buffer, fileKey, loaded, setLoaded, setFields }: { buffer?: ArrayBuffer; fileKey: string; loaded: string; setLoaded: (s: string) => void; setFields: (f: { title: string; author: string; subject: string; keywords: string }) => void }) {
  useEffect(() => {
    if (!buffer || loaded === fileKey) return
    let alive = true
    import('./process').then(({ readMetadata }) => readMetadata(buffer)).then((m) => {
      if (!alive) return
      setFields({ title: m.title, author: m.author, subject: m.subject, keywords: m.keywords })
      setLoaded(fileKey)
    }).catch(() => {})
    return () => { alive = false }
  }, [buffer, fileKey, loaded, setLoaded, setFields])
  return null
}
