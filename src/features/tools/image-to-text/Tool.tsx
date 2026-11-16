import { useState } from 'react'
import { ClipboardText } from '@phosphor-icons/react'
import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { toast } from '../../../lib/toast'
import { getTool } from '../registry'
// @ts-ignore - vite asset url import for the tesseract worker script (bundled locally, never a CDN)
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
const tool = getTool('image-to-text')!

export default function ImageToTextTool() {
  const [phase, setPhase] = useState('')
  const [recognisedText, setRecognisedText] = useState('')

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(recognisedText)
      toast.success('Text copied to the clipboard.')
    } catch {
      toast.error('Copying was blocked by the browser. Download the text file instead.')
    }
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="OCR reads the words in a photo or screenshot. The recognition engine and its English language data are part of this site and load from here — never from a third-party server — and the reading happens on your device, like every other tool. Recognition quality depends on the image: clear, straight text at a decent size reads best."
      actionLabel={() => 'Read the text'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => {
        const { imageToText } = await import('./process')
        const { createRecognizer } = await import('../ocr-engine')
        setPhase('Loading the recognition engine from this site…')
        const recognizer = await createRecognizer({
          workerPath: workerUrl as unknown as string,
          corePath: '/tess-core',
          langPath: '/tess-data',
          onProgress: (fraction) => onProgress(fraction),
        })
        try {
          if (signal.aborted) throw new Error('Cancelled')
          setPhase('Reading the words in your image…')
          const result = await imageToText(new Uint8Array(files[0].buffer!), (image) => recognizer.recognize(image))
          setRecognisedText(result.text)
          onProgress(1)
          return [{
            name: `${baseName(files[0].file.name)}.txt`,
            blob: new Blob([result.text], { type: 'text/plain' }),
            summary: `${result.wordCount} ${result.wordCount === 1 ? 'word' : 'words'} recognised and saved as a text file`,
          }]
        } finally {
          await recognizer.terminate()
          setPhase('')
        }
      }}
    >
      {({ status }) => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
            English text only for now. The recognised words are saved as a plain text file in step 3, and can be copied from here once the reading is done. The first run loads the recognition engine (about 6 MB) from this site; after that it is cached on your device.
          </p>
          {status === 'working' && phase ? <p className="body-6" aria-live="polite">{phase}</p> : null}
          {status === 'done' && recognisedText ? (
            <div className="flex flex-col gap-3">
              <p className="button-sm">The recognised text</p>
              <p className="body-6 max-h-40 overflow-auto rounded-xl bg-[var(--color-surface-raised)] p-4 whitespace-pre-wrap dark:bg-[var(--color-dark-panel)]">{recognisedText}</p>
              <button type="button" onClick={() => void copyText()} className="button-md inline-flex items-center gap-2 self-start rounded-xl bg-[var(--color-surface-raised)] px-3 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">
                <ClipboardText size={18} aria-hidden /> Copy the text
              </button>
            </div>
          ) : null}
        </div>
      )}
    </ToolWorkspace>
  )
}
