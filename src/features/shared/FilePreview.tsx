import { useEffect, useState } from 'react'
import { File as FileIcon } from '@phosphor-icons/react'
import type { WorkspaceFile } from './useWorkspace'
import { previewKindFor } from './preview'
import { pdfThumbnails } from './pdfThumbnail'

const boxClass =
  'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-line)] dark:border-[var(--color-dark-line)]'

/**
 * The visual at the start of a file-list row: a thumbnail of the file
 * itself where we can render one (the photo for image files, the first
 * page for PDFs), the generic file icon otherwise. Formats we do not
 * render — Word, CSV, EPUB, ZIP, Markdown — keep the icon; no preview is
 * ever faked. A preview that fails (an undecodable HEIC, a damaged or
 * encrypted PDF) also falls back to the icon, silently: the row's own
 * error text is where problems are explained.
 */
export default function FilePreview({ entry }: { entry: WorkspaceFile }) {
  const kind = previewKindFor(entry.file)

  // Image thumbnails come straight from the file via an object URL,
  // created once per row (rows are keyed by file id, so the file behind a
  // mounted row never changes). The effect below only revokes it — object
  // URLs pin the file's bytes in memory until they are revoked.
  const [imageUrl] = useState<string | null>(() =>
    kind === 'image' ? URL.createObjectURL(entry.file) : null,
  )
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => {
    if (!imageUrl) return
    return () => URL.revokeObjectURL(imageUrl)
  }, [imageUrl])

  // PDF thumbnails render through the shared store (cached per file id,
  // one render at a time) and are released when the row goes away.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  useEffect(() => {
    if (kind !== 'pdf' || !entry.buffer) return
    let alive = true
    void pdfThumbnails.get(entry.id, entry.buffer).then((url) => {
      if (alive) setPdfUrl(url)
    })
    return () => {
      alive = false
      pdfThumbnails.release(entry.id)
    }
  }, [kind, entry.id, entry.buffer])

  if (kind === 'none') {
    return <FileIcon size={20} aria-hidden className="shrink-0" />
  }

  const src = kind === 'image' ? (imageFailed ? null : imageUrl) : pdfUrl
  return (
    <span className={boxClass} aria-hidden>
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={kind === 'image' ? () => setImageFailed(true) : undefined}
        />
      ) : (
        <FileIcon size={20} aria-hidden />
      )}
    </span>
  )
}
