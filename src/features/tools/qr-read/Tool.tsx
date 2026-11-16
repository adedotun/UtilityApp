import { useState } from 'react'
import { ArrowSquareOut, ClipboardText } from '@phosphor-icons/react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { toast } from '../../../lib/toast'
import { getTool } from '../registry'
import type { QrReadResult } from './process'
const tool = getTool('qr-read')!

export default function QrReadTool() {
  const [result, setResult] = useState<QrReadResult | null>(null)

  const copyText = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.text)
      toast.success('The code’s content copied to the clipboard.')
    } catch {
      toast.error('Copying was blocked by the browser. Download the text file instead.')
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="A QR code can hide any text or web address, and it is not visible to the naked eye. This tool reads the code on your device and shows you exactly what it says before you act on it — the image is never uploaded. Check an address here before opening it if it came from a sticker, a poster or a stranger."
      actionLabel={() => 'Read the QR code'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { readQrCode } = await import('./process')
        const { createBrowserEngine } = await import('../image/engine')
        const found = await readQrCode(createBrowserEngine(), new Uint8Array(files[0].buffer!), files[0].file.type)
        if (!found) {
          setResult(null)
          throw new Error('No QR code was found in this image. Try a clearer, closer or straighter picture of the code.')
        }
        setResult(found)
        return [{
          name: `${baseName(files[0].file.name)}-qr.txt`,
          blob: new Blob([found.text], { type: 'text/plain' }),
          summary: 'The QR code’s content, saved as a text file',
        }]
      }}
    >
      {({ status }) => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            Screenshots and photos both work. The decoded content appears here after the reading, and is also saved as a text file in step 3.
          </p>
          {status === 'done' && result ? (
            <div className="flex flex-col gap-3">
              <p className="button-sm">What the code says</p>
              <p className="body-6 rounded-xl bg-[var(--color-surface-raised)] p-4 break-all whitespace-pre-wrap dark:bg-[var(--color-dark-panel)]">{result.text}</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void copyText()} className="button-md inline-flex items-center gap-2 self-start rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">
                  <ClipboardText size={18} aria-hidden /> Copy the content
                </button>
                {result.isUrl ? (
                  <a href={result.text.trim()} target="_blank" rel="noreferrer" className="button-md inline-flex items-center gap-2 self-start rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">
                    <ArrowSquareOut size={18} aria-hidden /> Open the link
                  </a>
                ) : null}
              </div>
              {result.isUrl ? (
                <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Read the address carefully before opening it — a code can point anywhere.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
