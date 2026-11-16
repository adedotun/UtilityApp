import { useEffect, useState } from 'react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import type { EpubBook } from './process'
const tool = getTool('epub-viewer')!

const NOTICE = 'The book is opened entirely on your device — its chapters are read from the file here, never uploaded. Books protected with DRM are encrypted and cannot be opened; the tool will say so plainly rather than fail.'

interface ReaderState { forId: string; book: EpubBook | null; error: string | null }

function Reader({ file }: { file?: { id: string; buffer?: ArrayBuffer; error?: string } }) {
  const [state, setState] = useState<ReaderState | null>(null)
  const [chapter, setChapter] = useState(0)

  useEffect(() => {
    if (!file?.buffer) return
    let alive = true
    import('./process')
      .then((m) => m.readEpub(file.buffer!))
      .then((book) => { if (alive) { setState({ forId: file.id, book, error: null }); setChapter(0) } })
      .catch((err: unknown) => {
        if (alive) setState({ forId: file.id, book: null, error: err instanceof Error ? err.message : 'This book could not be opened.' })
      })
    return () => { alive = false }
  }, [file?.id, file?.buffer])

  if (!file) return <div className={panelClass}><p className="body-3">Add an EPUB in step 1 and its chapters will appear here to read.</p></div>
  if (file.error) return <div className={panelClass}><p role="alert" className="body-6 text-[var(--color-danger)]">{file.error}</p></div>
  if (!state || state.forId !== file.id) return <div className={panelClass}><p className="body-3" aria-busy="true">Opening the book…</p></div>
  if (state.error) return <div className={panelClass}><p role="alert" className="body-6 text-[var(--color-danger)]">{state.error}</p></div>
  const book = state.book
  if (!book) return null
  const current = book.chapters[Math.min(chapter, book.chapters.length - 1)]

  return (
    <div className={panelClass}>
      {book.title ? <p className="title-3">{book.title}</p> : null}
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Chapters" className="flex shrink-0 flex-col gap-1 md:w-56">
          {book.chapters.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setChapter(i)}
              aria-current={i === chapter ? 'true' : undefined}
              className={`button-sm rounded-lg px-3 py-2 text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] ${i === chapter ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] dark:bg-[var(--color-dark-panel)]' : 'hover:text-[var(--color-accent)]'}`}
            >
              {i + 1}. {c.title}
            </button>
          ))}
        </nav>
        <article className="min-w-0 flex-1">
          <h3 className="heading-5">{current.title}</h3>
          <div className="mt-3 flex flex-col gap-3">
            {current.text.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="body-3">{para.replace(/\n/g, ' ')}</p>
            ))}
          </div>
          <p className="caption-2 mt-4 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            Chapter {Math.min(chapter, book.chapters.length - 1) + 1} of {book.chapters.length}. Formatting is simplified to plain readable text.
          </p>
        </article>
      </div>
    </div>
  )
}

export default function EpubViewerTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice={NOTICE}
      actionLabel={() => 'Save the whole book as text'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { readEpub } = await import('./process')
        const book = await readEpub(files[0].buffer!)
        const text = book.chapters.map((c) => `${c.title}\n${'='.repeat(Math.min(c.title.length, 60))}\n\n${c.text}`).join('\n\n\n')
        return [{
          name: `${baseName(files[0].file.name)}.txt`,
          blob: new Blob([text], { type: 'text/plain' }),
          summary: `${book.chapters.length} chapters saved as one text file`,
        }]
      }}
    >
      {({ files }) => <Reader file={files[0]} />}
    </ToolWorkspace>
  )
}
