import { useEffect, useRef, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import { loadPdfJs, renderPage, type PdfDocProxy } from '../../../lib/pdfjs'
import { contentGroups, describeGroups, describePageList, findPagesWithText, parseSplitPrompt } from './prompt'
const tool = getTool('split-pdf')!

type Msg = { kind: 'ok' | 'error' | 'working'; text: string } | null

const EXAMPLES = [
  'Split after page 3',
  'First 2 pages, then the rest',
  'Odd pages in one file, even pages in another',
  'Pages that mention "invoice"',
]

const smallButtonClass = 'button-sm inline-flex items-center gap-2 self-start rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]'
const selectClass = 'body-6 w-full rounded-lg bg-white px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] dark:bg-[var(--color-dark-raised)]'

export default function SplitPdfTool() {
  const [groups, setGroups] = useState<number[][]>([])
  const [pool, setPool] = useState<number[]>([])
  const [prompt, setPrompt] = useState('')
  const [msg, setMsg] = useState<Msg>(null)
  const fileCount = groups.filter((g) => g.length > 0).length
  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => (fileCount > 0 ? `Split into ${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : 'Split PDF')}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && fileCount > 0}
      onProcess={async (files, _s, onProgress) => {
        const { splitPdfGroups } = await import('./process')
        onProgress(0.3)
        const parts = await splitPdfGroups(files[0].buffer!, groups)
        onProgress(1)
        return parts.map((part) => ({ name: part.name, blob: new Blob([part.data as BlobPart], { type: 'application/pdf' }), summary: `Split into ${parts.length} ${parts.length === 1 ? 'file' : 'files'}` }))
      }}
    >
      {({ files }) => {
        const f = files[0]
        if (!f?.buffer) return <div className={panelClass}><p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a PDF in Step 1, then describe your split here — or just drag its pages between files.</p></div>
        return (
          <SplitPlanner
            key={f.id}
            buffer={f.buffer}
            pageCount={f.pageCount ?? 0}
            groups={groups}
            setGroups={setGroups}
            pool={pool}
            setPool={setPool}
            prompt={prompt}
            setPrompt={setPrompt}
            msg={msg}
            setMsg={setMsg}
          />
        )
      }}
    </ToolWorkspace>
  )
}

interface PlannerProps {
  buffer: ArrayBuffer
  pageCount: number
  groups: number[][]
  setGroups: (g: number[][]) => void
  pool: number[]
  setPool: (p: number[]) => void
  prompt: string
  setPrompt: (p: string) => void
  msg: Msg
  setMsg: (m: Msg) => void
}

function SplitPlanner({ buffer, pageCount, groups, setGroups, pool, setPool, prompt, setPrompt, msg, setMsg }: PlannerProps) {
  const [doc, setDoc] = useState<PdfDocProxy | null>(null)
  const dragRef = useRef<{ page: number; from: number } | null>(null)

  // A new file starts as one file holding every page.
  useEffect(() => {
    setGroups([Array.from({ length: pageCount }, (_, i) => i + 1)])
    setPool([])
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, pageCount])
  useEffect(() => {
    let alive = true
    loadPdfJs(buffer).then((d) => { if (alive) setDoc(d) }).catch(() => {})
    return () => { alive = false }
  }, [buffer])

  const applyPrompt = async (text: string) => {
    try {
      const res = parseSplitPrompt(text, pageCount)
      if (res.kind === 'groups') {
        setGroups(res.groups)
        setPool(res.unassigned)
        setMsg({ kind: 'ok', text: `Here is what I understood: ${res.explanation}. Drag pages between files to fix anything.` })
        return
      }
      setMsg({ kind: 'working', text: `Searching the text of your PDF for "${res.query}"…` })
      const pdf = await loadPdfJs(buffer)
      const texts: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const tc = await page.getTextContent()
        texts.push(tc.items.map((it) => ('str' in it ? (it as { str: string }).str : '')).join(' '))
      }
      if (texts.every((t) => !t.trim())) {
        setMsg({ kind: 'error', text: 'This PDF has no readable text — it may be made of scanned images — so a content search cannot work here. Try page numbers instead, for example "split after page 3".' })
        return
      }
      const matches = findPagesWithText(texts, res.query)
      if (matches.length === 0) {
        setMsg({ kind: 'error', text: `No page mentions "${res.query}". Check the wording, or describe the split with page numbers instead.` })
        return
      }
      const next = contentGroups(matches, pageCount)
      setGroups(next)
      setPool([])
      setMsg({ kind: 'ok', text: `Found "${res.query}" on ${describePageList(matches)}. Those pages are in File 1 and the rest are in File 2 — drag pages between files to fix anything.` })
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'I could not understand that description.' })
    }
  }

  const movePage = (page: number, from: number, to: number) => {
    if (from === to) return
    const nextGroups = groups.map((g) => g.filter((p) => p !== page))
    let nextPool = pool.filter((p) => p !== page)
    if (to === -1) nextPool = [...nextPool, page].sort((a, b) => a - b)
    else nextGroups[to] = [...nextGroups[to], page].sort((a, b) => a - b)
    setGroups(nextGroups)
    setPool(nextPool)
  }

  const removeFile = (idx: number) => {
    setPool([...pool, ...groups[idx]].sort((a, b) => a - b))
    setGroups(groups.filter((_, i) => i !== idx))
  }

  const tray = (label: string, pages: number[], idx: number, removable: boolean) => (
    <div
      key={`${label}-${idx}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => { if (dragRef.current) { movePage(dragRef.current.page, dragRef.current.from, idx); dragRef.current = null } }}
      className="flex flex-col gap-3 rounded-xl bg-[var(--color-surface-raised)] p-4 dark:bg-[var(--color-dark-panel)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="button-sm">{label} <span className="text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">· {pages.length} {pages.length === 1 ? 'page' : 'pages'}{pages.length > 0 ? ` · ${describePageList(pages)}` : ''}</span></p>
        {removable ? (
          <button type="button" onClick={() => removeFile(idx)} className={smallButtonClass} aria-label={`Remove ${label}, its pages will not be in any file`}>
            <Trash size={14} aria-hidden /> Remove file
          </button>
        ) : null}
      </div>
      {pages.length === 0 ? (
        <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Drag pages here, or use a page's move menu below.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {pages.map((page) => (
            <div
              key={page}
              draggable
              onDragStart={() => { dragRef.current = { page, from: idx } }}
              className="flex flex-col items-center gap-2 rounded-xl bg-white p-2 dark:bg-[var(--color-dark-raised)]"
            >
              {doc ? <Thumb doc={doc} page={page} /> : <p className="body-6" aria-busy="true">…</p>}
              <span className="caption-2">Page {page}</span>
              <label className="w-full">
                <span className="sr-only">Move page {page} to</span>
                <select
                  value={idx}
                  onChange={(e) => movePage(page, idx, Number(e.target.value))}
                  className={selectClass}
                >
                  {groups.map((_, gi) => <option key={gi} value={gi}>File {gi + 1}</option>)}
                  <option value={-1}>Not in any file</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className={panelClass}>
        <label className={labelClass}>
          <span className="button-sm">Describe your split</span>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void applyPrompt(prompt) }}
            className={fieldClass}
            placeholder='For example: split after page 3, or pages that mention "invoice"'
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void applyPrompt(prompt)} disabled={msg?.kind === 'working'} className="button-md rounded-xl bg-[var(--color-accent)] px-3 py-2 text-white outline-none transition-all duration-300 hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
            Apply description
          </button>
          <span className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Understood on your device — nothing is uploaded.</span>
        </div>
        <div className="flex flex-col gap-2">
          <p className="button-sm">Try one of these</p>
          <ul className="flex flex-col">
            {EXAMPLES.map((ex) => (
              <li key={ex} className="border-t border-[var(--color-line)] first:border-t-0 dark:border-[var(--color-dark-line)]">
                <button type="button" onClick={() => { setPrompt(ex); void applyPrompt(ex) }} className="body-6 w-full py-2 text-left outline-none transition-colors duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {msg ? (
          <p role={msg.kind === 'error' ? 'alert' : undefined} className={`body-6 ${msg.kind === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]'}`}>
            {msg.text}
          </p>
        ) : null}
      </div>

      <div className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="button-sm">Your files</p>
          <button type="button" onClick={() => setGroups([...groups, []])} className={smallButtonClass}>
            <Plus size={14} aria-hidden /> New file
          </button>
        </div>
        <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
          {describeGroups(groups, pool)}. Drag a page into another file, or use its move menu. Pages that are not in any file will not be in the output.
        </p>
        {pool.length > 0 ? tray('Not in any file', pool, -1, false) : null}
        {groups.map((g, i) => tray(`File ${i + 1}`, g, i, true))}
      </div>
    </div>
  )
}

function Thumb({ doc, page }: { doc: PdfDocProxy; page: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) void renderPage(doc, page, ref.current, 140).catch(() => {}) }, [doc, page])
  return <canvas ref={ref} className="w-full rounded-lg bg-white" aria-hidden />
}
