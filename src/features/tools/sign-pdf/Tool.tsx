import { useEffect, useRef, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import PdfCanvas from '../../shared/PdfCanvas'
import { getTool } from '../registry'
import { toast } from '../../../lib/toast'
import type { SignaturePlacement, TextPlacement } from './process'
const tool = getTool('sign-pdf')!

const SIG_KEY = 'pdf-tweaks-signatures'

interface PlacedSig { id: number; page: number; x: number; y: number; width: number; dataUrl: string; aspect: number }
let nextId = 1

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export default function SignPdfTool() {
  const [page, setPage] = useState(1)
  const [placed, setPlaced] = useState<PlacedSig[]>([])
  const [texts, setTexts] = useState<TextPlacement[]>([])
  const [pending, setPending] = useState<{ dataUrl: string; aspect: number } | null>(null)
  const [saved, setSaved] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(SIG_KEY) ?? '[]') as string[] } catch { return [] } })
  const [typed, setTyped] = useState('')
  const [textValue, setTextValue] = useState('')
  const [mode, setMode] = useState<'signature' | 'text'>('signature')
  const [dateOn, setDateOn] = useState(false)
  const padRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => { const c = padRef.current; if (c) { c.width = 320; c.height = 120 } }, [])

  const padPoint = (e: React.PointerEvent) => {
    const rect = padRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * padRef.current!.width, y: ((e.clientY - rect.top) / rect.height) * padRef.current!.height }
  }
  const padDraw = (e: React.PointerEvent) => {
    const ctx = padRef.current?.getContext('2d'); if (!ctx) return
    const p = padPoint(e)
    if (!drawing.current) { ctx.beginPath(); ctx.moveTo(p.x, p.y); drawing.current = true }
    ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#111827'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke()
  }
  const finishPad = () => {
    drawing.current = false
    const c = padRef.current; if (!c) return
    const dataUrl = c.toDataURL('image/png')
    setPending({ dataUrl, aspect: c.height / c.width })
  }
  const applyTyped = async () => {
    if (!typed.trim()) return
    const { textToSignaturePng } = await import('./process')
    const bytes = await textToSignaturePng(typed.trim())
    const blob = new Blob([bytes as BlobPart], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { setPending({ dataUrl: url, aspect: img.height / img.width }); }
    img.src = url
    // store as data url for placement rendering
    const reader = new FileReader()
    reader.onload = () => setPending({ dataUrl: reader.result as string, aspect: 72 / (Math.max(120, typed.length * 26)) })
    reader.readAsDataURL(blob)
  }
  const saveCurrent = () => {
    if (!pending) return
    const next = [...saved, pending.dataUrl]
    setSaved(next)
    try { localStorage.setItem(SIG_KEY, JSON.stringify(next)) } catch { toast.error('This signature could not be saved on this device.') }
    toast.success('Signature saved on this device for reuse.')
  }

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => 'Save signed PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && (placed.length > 0 || texts.length > 0)}
      onProcess={async (files) => {
        const { signPdf } = await import('./process')
        const sigs: SignaturePlacement[] = placed.map((p) => ({ page: p.page, x: p.x, y: p.y, width: p.width, png: dataUrlToBytes(p.dataUrl) }))
        const allTexts = [...texts]
        if (dateOn) {
          const first = placed[0]
          if (first) allTexts.push({ page: first.page, x: first.x, y: Math.max(0, first.y - 0.045), text: new Date().toLocaleDateString('en-CA'), size: 10 })
        }
        const data = await signPdf(files[0].buffer!, sigs, allTexts)
        return [{ name: 'signed.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: `${placed.length} signature${placed.length === 1 ? '' : 's'} and ${allTexts.length} text item${allTexts.length === 1 ? '' : 's'} placed` }]
      }}
    >
      {({ files }) => (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className={panelClass}>
            <div className="flex gap-2" role="tablist" aria-label="Signing mode">
              {(['signature', 'text'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`button-sm rounded-lg px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] ${mode === m ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] dark:bg-[var(--color-dark-panel)]'}`}>
                  {m === 'signature' ? 'Signature' : 'Text and date'}
                </button>
              ))}
            </div>
            {mode === 'signature' ? (
              <>
                <p className="button-sm">Draw your signature</p>
                <canvas ref={padRef} className="w-full touch-none rounded-xl bg-white shadow-inner" style={{ aspectRatio: '320 / 120' }}
                  onPointerDown={(e) => { (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); padDraw(e) }}
                  onPointerMove={(e) => { if (drawing.current) padDraw(e) }}
                  onPointerUp={finishPad} aria-label="Signature drawing pad" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { const c = padRef.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); setPending(null) }} className="button-sm rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">Clear pad</button>
                  <button type="button" disabled={!pending} onClick={saveCurrent} className="button-sm rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40 dark:bg-[var(--color-dark-panel)]">Save for reuse</button>
                </div>
                <label className={labelClass}><span className="button-sm">Or type your name</span>
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} className={fieldClass} placeholder="Your name" /></label>
                <button type="button" disabled={!typed.trim()} onClick={() => void applyTyped()} className="button-sm self-start rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] disabled:opacity-40 dark:bg-[var(--color-dark-panel)]">Use typed signature</button>
                {saved.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="button-sm">Saved on this device</p>
                    {saved.map((s, i) => (
                      <button key={i} type="button" onClick={() => setPending({ dataUrl: s, aspect: 120 / 320 })} className="rounded-lg bg-white p-1 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]">
                        <img src={s} alt={`Saved signature ${i + 1}`} className="max-h-10" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{pending ? 'Now click on the document where the signature should go. Drag it afterwards to adjust.' : 'Draw, type, or pick a saved signature, then click the document to place it.'}</p>
              </>
            ) : (
              <>
                <label className={labelClass}><span className="button-sm">Text to add</span>
                  <input value={textValue} onChange={(e) => setTextValue(e.target.value)} className={fieldClass} placeholder="For example, your name or a note" /></label>
                <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Click on the document to place this text at that spot.</p>
                <label className="flex items-center gap-2"><input type="checkbox" checked={dateOn} onChange={(e) => setDateOn(e.target.checked)} className="accent-[var(--color-accent)]" /><span className="body-6">Add today date under the first signature</span></label>
              </>
            )}
            {placed.length + texts.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {placed.map((p) => (<li key={p.id} className="body-6 flex items-center justify-between">Signature on page {p.page}<button type="button" onClick={() => setPlaced((prev) => prev.filter((x) => x.id !== p.id))} className="button-sm rounded-lg px-2 py-1 text-[var(--color-danger)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">Remove</button></li>))}
                {texts.map((t, i) => (<li key={i} className="body-6 flex items-center justify-between">Text on page {t.page}: {t.text}<button type="button" onClick={() => setTexts((prev) => prev.filter((_, j) => j !== i))} className="button-sm rounded-lg px-2 py-1 text-[var(--color-danger)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">Remove</button></li>))}
              </ul>
            ) : null}
          </div>
          <div className={panelClass}>
            <PdfCanvas buffer={files[0]?.buffer} page={page} onPageChange={setPage}
              onCanvasClick={(frac) => {
                if (mode === 'signature' && pending) {
                  const width = 0.28
                  const item: PlacedSig = { id: nextId++, page, x: Math.min(Math.max(frac.x - width / 2, 0), 1 - width), y: Math.min(Math.max(1 - frac.yTop - 0.03, 0), 0.97), width, dataUrl: pending.dataUrl, aspect: pending.aspect }
                  setPlaced((prev) => [...prev, item])
                } else if (mode === 'text' && textValue.trim()) {
                  setTexts((prev) => [...prev, { page, x: frac.x, y: 1 - frac.yTop, text: textValue.trim(), size: 12 }])
                }
              }}
            >
              {() => (
                <>
                  {placed.filter((p) => p.page === page).map((p) => (
                    <img key={p.id} src={p.dataUrl} alt="Placed signature" draggable={false}
                      className="absolute cursor-move"
                      style={{ left: `${p.x * 100}%`, bottom: `${p.y * 100}%`, width: `${p.width * 100}%` }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        const frame = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect()
                        const startX = e.clientX, startY = e.clientY, orig = { x: p.x, y: p.y }
                        const move = (ev: PointerEvent) => setPlaced((prev) => prev.map((x) => x.id === p.id ? { ...x, x: Math.min(Math.max(orig.x + (ev.clientX - startX) / frame.width, 0), 1 - p.width), y: Math.min(Math.max(orig.y - (ev.clientY - startY) / frame.height, 0), 0.97) } : x))
                        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
                      }} />
                  ))}
                  {texts.filter((t) => t.page === page).map((t, i) => (
                    <span key={i} className="absolute text-sm text-slate-900" style={{ left: `${t.x * 100}%`, bottom: `${t.y * 100}%` }}>{t.text}</span>
                  ))}
                </>
              )}
            </PdfCanvas>
          </div>
        </div>
      )}
    </ToolWorkspace>
  )
}
