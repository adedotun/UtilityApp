import JSZip from 'jszip'

interface DocxMergerInstance {
  save: (type: string, callback: (data: unknown) => void) => void
}
type DocxMergerCtor = new (options: Record<string, unknown>, files: ArrayBuffer[]) => DocxMergerInstance

/** Checks one input really is a .docx before the merger sees it, so a bad file gets a named error. */
async function assertDocx(buffer: ArrayBuffer, index: number): Promise<void> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer.slice(0))
  } catch {
    throw new Error(`Document ${index + 1} could not be read. It may be damaged, or not a Word document at all.`)
  }
  if (!zip.file('word/document.xml')) {
    throw new Error(`Document ${index + 1} is not a .docx file — it has no document content. Older .doc files cannot be merged.`)
  }
}

/**
 * Merges .docx files at the document.xml level with docx-merger: bodies are
 * joined in order with a page break between documents, and styles, numbering
 * and media from every file are combined. Each document keeps its own
 * formatting; where two documents define the same style differently, the
 * combined style set decides, so a quick check of the result is wise.
 *
 * The spike behind this tool (November 2026) merged documents built with
 * headings, styled runs and bullet lists and read the result back with
 * Mammoth: all text present, in order, structure intact.
 */
export async function mergeWordDocs(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  if (buffers.length < 2) throw new Error('Add at least two Word documents to merge.')
  for (let i = 0; i < buffers.length; i++) await assertDocx(buffers[i], i)

  const mod = (await import('docx-merger')) as unknown as { default?: DocxMergerCtor }
  const DocxMerger = mod.default ?? (mod as unknown as DocxMergerCtor)
  const merger = new DocxMerger({}, buffers.map((b) => b.slice(0)))
  // docx-merger saves through JSZip 2: a Buffer under Node (the tests), a Blob in the browser.
  const nodeStyle = typeof (globalThis as { Buffer?: unknown }).Buffer === 'function'
  const data = await new Promise<unknown>((resolve, reject) => {
    try {
      merger.save(nodeStyle ? 'nodebuffer' : 'blob', (d) => {
        if (d) resolve(d)
        else reject(new Error('The merge produced no file.'))
      })
    } catch (err) {
      reject(err instanceof Error ? err : new Error('The merge failed.'))
    }
  }).catch(() => {
    throw new Error('These documents could not be merged. One of them may use features the merger cannot combine.')
  })
  if (data instanceof Uint8Array) return data
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer())
  throw new Error('These documents could not be merged. One of them may use features the merger cannot combine.')
}
