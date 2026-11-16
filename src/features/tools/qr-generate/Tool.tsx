import { useEffect, useRef, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import type { WorkspaceFile } from '../../shared/useWorkspace'
import { getTool } from '../registry'
import { createBrowserEngine } from '../image/engine'
import { generateQrPng, qrModules, QR_QUIET_ZONE } from './process'
const tool = getTool('qr-generate')!

const SIZES = [
  { value: 256, label: '256 × 256, for screens' },
  { value: 512, label: '512 × 512, general use' },
  { value: 1024, label: '1024 × 1024, for print' },
]

/** Draws the current text's code into the preview canvas; returns any problem. */
function drawPreview(canvas: HTMLCanvasElement, text: string): string | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (!text.trim()) {
    canvas.width = 232
    canvas.height = 232
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return null
  }
  try {
    const matrix = qrModules(text)
    const total = matrix.size + QR_QUIET_ZONE * 2
    const scale = Math.max(1, Math.round(232 / total))
    canvas.width = total * scale
    canvas.height = total * scale
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (matrix.data[y * matrix.size + x]) {
          ctx.fillRect((x + QR_QUIET_ZONE) * scale, (y + QR_QUIET_ZONE) * scale, scale, scale)
        }
      }
    }
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'That text cannot be made into a QR code.'
  }
}

function EditorPanel({ files, text, onText, size, onSize }: { files: WorkspaceFile[]; text: string; onText: (t: string) => void; size: number; onSize: (n: number) => void }) {
  const file = files[0]
  const [loadedFor, setLoadedFor] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!file || loadedFor === file.id) return
    let alive = true
    file.file.text().then((t) => {
      if (alive) { setLoadedFor(file.id); onText(t) }
    })
    return () => { alive = false }
  }, [file, loadedFor, onText])

  useEffect(() => {
    if (canvasRef.current) setProblem(drawPreview(canvasRef.current, text))
  }, [text])

  return (
    <div className={panelClass}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          <span className="button-sm">Text or web address</span>
          <textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            rows={5}
            placeholder={'Type or paste the text for the code, for example https://example.com'}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          <span className="button-sm">Image size</span>
          <select value={size} onChange={(e) => onSize(Number(e.target.value))} className={fieldClass}>
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {problem ? (
        <p role="alert" className="body-6 text-[var(--color-danger)]">{problem}</p>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="button-sm">Preview</p>
          <canvas ref={canvasRef} className="h-[232px] w-[232px] rounded-xl bg-white ring-1 ring-[var(--color-line)] dark:ring-[var(--color-dark-line)]" aria-label="Preview of the QR code" />
          {!text.trim() ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">The preview appears as you type. Step 3 stays disabled until there is some text to encode.</p>
          ) : null}
        </div>
      )}
      <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        {file
          ? 'The text file from step 1 is loaded above. Edit it freely — the code encodes exactly what is in the box.'
          : 'No file needed: type directly into the box. Adding a .txt file in step 1 loads its text here instead.'}
      </p>
    </div>
  )
}

export default function QrGenerateTool() {
  const [text, setText] = useState('')
  const [size, setSize] = useState(512)
  return (
    <ToolWorkspace
      tool={tool}
      notice="The code is drawn on your device from exactly the text you enter — check the preview before sharing it, because a QR code shows nothing to the naked eye. Anyone who scans it will see the text, so never encode passwords or private details."
      actionLabel={() => 'Save the QR code as a PNG'}
      canRun={() => text.trim().length > 0}
      onProcess={async () => {
        const png = await generateQrPng(createBrowserEngine(), text, size)
        return [{
          name: 'qr-code.png',
          blob: new Blob([png as BlobPart], { type: 'image/png' }),
          summary: `QR code saved as a ${size} × ${size} PNG image`,
        }]
      }}
    >
      {({ files }) => <EditorPanel files={files} text={text} onText={setText} size={size} onSize={setSize} />}
    </ToolWorkspace>
  )
}
