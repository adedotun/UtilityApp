/**
 * First-page PDF thumbnails for the file list.
 *
 * Rendering a page with PDF.js is the most expensive thing the file list
 * does, so renders go through a store with two guards:
 * - a cache keyed by workspace-file id, so re-renders, reorders and repeat
 *   mounts reuse the finished data URL instead of rendering again;
 * - a sequential queue, so a list of many PDFs renders one page at a time
 *   instead of parsing every document at once and janking the page.
 *
 * A file that cannot be rendered (damaged, encrypted, not really a PDF)
 * resolves to null and the row keeps its generic icon — the row's own
 * error text already explains the problem, so the thumbnail stays silent.
 */
export class PdfThumbnailStore {
  private cache = new Map<string, Promise<string | null>>()
  private tail: Promise<unknown> = Promise.resolve()
  private render: (buffer: ArrayBuffer) => Promise<string | null>

  constructor(render: (buffer: ArrayBuffer) => Promise<string | null>) {
    this.render = render
  }

  get(id: string, buffer: ArrayBuffer): Promise<string | null> {
    const hit = this.cache.get(id)
    if (hit) return hit
    const job = this.tail.then(() => this.render(buffer)).catch(() => null)
    // The queue itself must never reject, or one bad file would stall the rest.
    this.tail = job.then(
      () => undefined,
      () => undefined,
    )
    this.cache.set(id, job)
    return job
  }

  /** Forget one thumbnail (its file was removed or its list unmounted). */
  release(id: string): void {
    this.cache.delete(id)
  }
}

/** Width of the rendered first page, in CSS pixels, before it is boxed into the row. */
export const THUMBNAIL_WIDTH = 96

async function renderFirstPage(buffer: ArrayBuffer): Promise<string | null> {
  // Dynamic import: PDF.js stays in its own lazy chunk, loaded only when a
  // PDF row actually needs a thumbnail — the same pattern the tools use.
  const { pdfjsLib, renderPage } = await import('../../lib/pdfjs')
  const task = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) })
  const doc = await task.promise
  try {
    const canvas = document.createElement('canvas')
    await renderPage(doc, 1, canvas, THUMBNAIL_WIDTH)
    return canvas.toDataURL('image/png')
  } finally {
    // The data URL is the cacheable result; the parsed document can go.
    void task.destroy().catch(() => {})
  }
}

export const pdfThumbnails = new PdfThumbnailStore(renderFirstPage)
