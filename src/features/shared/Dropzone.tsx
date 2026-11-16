import { useRef, useState } from 'react'
import { UploadSimple } from '@phosphor-icons/react'

interface Props {
  accept: string[]
  multiple: boolean
  onFiles: (files: File[]) => void
  label: string
}

export default function Dropzone({ accept, multiple, onFiles, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.99] ${dragging ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] dark:bg-[var(--color-dark-panel)]' : 'border-[var(--color-line)] bg-white dark:border-[var(--color-dark-line)] dark:bg-[var(--color-dark-raised)]'}`}
    >
      <UploadSimple size={32} aria-hidden />
      <p className="title-3">Drop files here, or click to browse</p>
      <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        You can also paste a file copied to your clipboard anywhere on this page. Accepts {accept.join(', ')}.
      </p>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept.join(',')}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(multiple ? files : files.slice(0, 1))
          e.target.value = ''
        }}
      />
    </div>
  )
}
