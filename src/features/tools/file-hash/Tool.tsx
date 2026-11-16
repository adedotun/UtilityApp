import { useEffect, useState } from 'react'
import { ClipboardText } from '@phosphor-icons/react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { baseName, formatSize } from '../../../lib/files'
import { toast } from '../../../lib/toast'
import { getTool } from '../registry'
import type { FileHashes } from './process'
const tool = getTool('file-hash')!

interface LoadedHashes extends FileHashes { buffer: ArrayBuffer }

/** Computes the current file's hashes and reports them to the parent. */
function HashLoader({ buffer, onHashes, onError }: { buffer: ArrayBuffer; onHashes: (hashes: FileHashes) => void; onError: (message: string) => void }) {
  useEffect(() => {
    let alive = true
    import('./process')
      .then((m) => m.hashData(new Uint8Array(buffer)))
      .then((hashes) => { if (alive) onHashes(hashes) })
      .catch((err: unknown) => { if (alive) onError(err instanceof Error ? err.message : 'The hashes could not be computed.') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer])
  return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Working out this file's hashes…</p>
}

function HashRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} hash copied to the clipboard.`)
    } catch {
      toast.error('Copying was blocked by the browser. Select the hash and copy it by hand.')
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="button-sm">{label}</p>
        <button type="button" onClick={() => void copy()} className="button-sm inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface-raised)] px-2 py-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-panel)]">
          <ClipboardText size={14} aria-hidden /> Copy
        </button>
      </div>
      <p className="body-6 rounded-xl bg-[var(--color-surface-raised)] p-4 font-mono break-all dark:bg-[var(--color-dark-panel)]">{value}</p>
    </div>
  )
}

export default function FileHashTool() {
  const [hashes, setHashes] = useState<LoadedHashes | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expected, setExpected] = useState('')
  const [match, setMatch] = useState<'SHA-256' | 'SHA-1' | 'none' | null>(null)

  const checkExpected = async (value: string) => {
    setExpected(value)
    if (!hashes || !value.trim()) { setMatch(null); return }
    const { findMatchingHash } = await import('./process')
    setMatch(findMatchingHash(hashes, value) ?? 'none')
  }

  return (
    <ToolWorkspace
      tool={tool}
      notice="A hash is a fingerprint of a file: change one byte and the fingerprint changes completely. If a download site or a sender gives you a hash, compare it with the one worked out here — a match means the file you have is byte for byte the file they meant. The working out happens on your device; the file is never uploaded."
      actionLabel={() => 'Save the hashes as a text file'}
      canRun={(files) => files.length === 1 && !!files[0].buffer && !!hashes && hashes.buffer === files[0].buffer}
      onProcess={async (files) => {
        const { hashReportText } = await import('./process')
        const report = hashReportText(files[0].file.name, files[0].file.size, hashes!)
        return [{
          name: `${baseName(files[0].file.name)}-hashes.txt`,
          blob: new Blob([report], { type: 'text/plain' }),
          summary: 'SHA-256 and SHA-1 hashes saved as a text file',
        }]
      }}
    >
      {({ files }) => (
        <div className={panelClass}>
          {files.length !== 1 || !files[0]?.buffer ? (
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a file in step 1 and its hashes will be worked out and shown here.</p>
          ) : loadError && hashes?.buffer !== files[0].buffer ? (
            <p role="alert" className="body-6 text-[var(--color-danger)]">{loadError}</p>
          ) : !hashes || hashes.buffer !== files[0].buffer ? (
            <HashLoader
              buffer={files[0].buffer}
              onHashes={(h) => { setHashes({ ...h, buffer: files[0].buffer! }); setLoadError(null); setMatch(null) }}
              onError={(message) => setLoadError(message)}
            />
          ) : (
            <>
              <p className="button-sm">Hashes for {files[0].file.name} · {formatSize(files[0].file.size)}</p>
              <HashRow label="SHA-256" value={hashes.sha256} />
              <HashRow label="SHA-1" value={hashes.sha1} />
              <label className={labelClass}>
                <span className="button-sm">Check a hash you were given</span>
                <input
                  value={expected}
                  onChange={(e) => void checkExpected(e.target.value)}
                  placeholder="Paste a SHA-256 or SHA-1 hash here"
                  className={`${fieldClass} font-mono`}
                />
              </label>
              {match === 'SHA-256' || match === 'SHA-1' ? (
                <p className="body-6" role="status">That matches this file's {match} hash. The file is exactly the one that hash belongs to.</p>
              ) : match === 'none' ? (
                <p className="body-6" role="status">That does not match either of this file's hashes. The file differs from the one that hash belongs to — or the hash was copied incompletely.</p>
              ) : (
                <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Letter case does not matter, and spaces are ignored.</p>
              )}
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Step 3 saves both hashes as a small text file, for keeping or sending.</p>
            </>
          )}
        </div>
      )}
    </ToolWorkspace>
  )
}
