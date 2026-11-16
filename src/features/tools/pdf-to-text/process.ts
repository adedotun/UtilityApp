import { pdfjsLib } from '../../../lib/pdfjs'

interface TextItemLike { str?: unknown; hasEOL?: unknown }

/**
 * Under Vitest/Node the bundled worker URL is a root relative /node_modules
 * path; resolve it as a file URL against the cwd, the same fix the qpdf
 * loader uses. In the browser the URL Vite emits is used untouched.
 */
function resolveWorkerForNode(): void {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (!proc?.versions?.node || !proc.cwd) return
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${proc.cwd()}${src}`
  }
}

/** Joins one page of PDF.js text items into lines, honouring the items' end-of-line flags. */
export function pageTextFromItems(items: unknown[]): string {
  let raw = ''
  for (const item of items) {
    const it = item as TextItemLike
    if (typeof it.str !== 'string') continue
    raw += it.str
    raw += it.hasEOL ? '\n' : ' '
  }
  return raw
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim()
}

/** One clearly headed section per page; pages without text are marked, not hidden. */
export function assembleText(pages: string[]): string {
  return pages
    .map((text, i) => `--- Page ${i + 1} ---\n${text.trim() ? text : '(no readable text on this page)'}`)
    .join('\n\n')
}

export interface ExtractedText { text: string; pageCount: number; pagesWithText: number }

export async function extractPdfText(buffer: ArrayBuffer): Promise<ExtractedText> {
  resolveWorkerForNode()
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(pageTextFromItems(content.items as unknown[]))
  }
  const pagesWithText = pages.filter((t) => t.trim().length > 0).length
  if (pagesWithText === 0) {
    throw new Error('This PDF has no readable text. It may be made of scanned images, so there is no text layer to copy out.')
  }
  return { text: assembleText(pages), pageCount: doc.numPages, pagesWithText }
}
