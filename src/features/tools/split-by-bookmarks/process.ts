import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, type PDFObject, type PDFPage } from 'pdf-lib'
import { pdfjsLib } from '../../../lib/pdfjs'
import { splitPdfGroups } from '../split-pdf/process'

/**
 * Under Vitest/Node the bundled worker URL is a root relative /node_modules
 * path; resolve it as a file URL against the cwd, the same fix the other
 * PDF.js tools use. In the browser the URL Vite emits is used untouched.
 */
function resolveWorkerForNode(): void {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (!proc?.versions?.node || !proc.cwd) return
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${proc.cwd()}${src}`
  }
}

// --- Bookmarks mode -------------------------------------------------------

export interface OutlineEntry { title: string; page: number }
export interface Chapter { title: string; startPage: number; endPage: number }

export const LEADING_TITLE = 'Pages before the first bookmark'

/**
 * Turns top-level outline entries into chapter spans. Entries are sorted
 * by start page and duplicates on one page collapse to the first. Pages
 * before the first bookmark become a leading chapter of their own, so no
 * page is silently dropped or silently merged into a chapter it does not
 * belong to.
 */
export function chaptersFromOutline(entries: OutlineEntry[], pageCount: number): Chapter[] {
  const valid = entries
    .filter((e) => Number.isInteger(e.page) && e.page >= 1 && e.page <= pageCount)
    .sort((a, b) => a.page - b.page)
  const chapters: Chapter[] = []
  for (const entry of valid) {
    if (chapters.length && chapters[chapters.length - 1].startPage === entry.page) continue
    chapters.push({ title: entry.title.trim() || 'Untitled bookmark', startPage: entry.page, endPage: pageCount })
  }
  for (let i = 0; i < chapters.length - 1; i++) chapters[i].endPage = chapters[i + 1].startPage - 1
  if (chapters.length && chapters[0].startPage > 1) {
    chapters.unshift({ title: LEADING_TITLE, startPage: 1, endPage: chapters[0].startPage - 1 })
  }
  return chapters
}

interface OutlineNodeLike { title?: unknown; dest?: unknown; url?: unknown; items?: unknown }

async function resolveDestPage(doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>, dest: unknown): Promise<number | null> {
  let resolved: unknown = dest
  if (typeof resolved === 'string') {
    resolved = await doc.getDestination(resolved)
  }
  if (!Array.isArray(resolved) || resolved.length === 0) return null
  const first: unknown = resolved[0]
  if (typeof first === 'number') return first + 1
  try {
    return (await doc.getPageIndex(first as never)) + 1
  } catch {
    return null
  }
}

/**
 * Reads the top-level bookmarks (the PDF outline) with PDF.js and resolves
 * each one to its 1-based start page. Returns null when the document has
 * no outline at all; entries that point outside the document or at a web
 * address are skipped.
 */
export async function readOutline(buffer: ArrayBuffer): Promise<OutlineEntry[] | null> {
  resolveWorkerForNode()
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const outline = (await doc.getOutline()) as OutlineNodeLike[] | null
  if (!outline) return null
  const entries: OutlineEntry[] = []
  for (const node of outline) {
    if (typeof node.title !== 'string' || node.url) continue
    const page = await resolveDestPage(doc, node.dest)
    if (page !== null) entries.push({ title: node.title, page })
  }
  return entries
}

/** File name for one chapter: numbered, with the title made file-safe. */
export function chapterFileName(title: string, index: number): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '')
  return `${String(index + 1).padStart(2, '0')}-${slug || 'chapter'}.pdf`
}

export interface BookmarkSplitFile { name: string; data: Uint8Array; title: string; pageCount: number }

export async function splitByBookmarks(buffer: ArrayBuffer): Promise<BookmarkSplitFile[]> {
  const probe = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true }).catch(() => null)
  if (!probe) throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  const entries = await readOutline(buffer)
  if (!entries || entries.length === 0) {
    throw new Error('This PDF has no bookmarks to split by. Bookmarks are the chapter list some PDFs show in a sidebar; without them, use Split PDF with page ranges instead.')
  }
  const chapters = chaptersFromOutline(entries, probe.getPageCount())
  const groups = chapters.map((c) => Array.from({ length: c.endPage - c.startPage + 1 }, (_, i) => c.startPage + i))
  const parts = await splitPdfGroups(buffer, groups)
  return parts.map((part, i) => ({
    name: chapterFileName(chapters[i].title, i),
    data: part.data,
    title: chapters[i].title,
    pageCount: groups[i].length,
  }))
}

// --- Size mode ------------------------------------------------------------

/**
 * Estimates each page's share of the file size without rendering: the
 * page's own content stream bytes, plus the image streams it references,
 * plus an even share of everything else in the file (fonts, structure,
 * shared resources). It is an estimate — images shared between pages are
 * counted once per page that uses them — and the split checks the real
 * output sizes afterwards and reports any file that came out over target.
 */
export function estimatePageSizes(doc: PDFDocument, totalBytes: number): number[] {
  const streamBytes = (obj: PDFObject | undefined): number => {
    const resolved = obj ? doc.context.lookup(obj) : undefined
    return resolved instanceof PDFRawStream ? resolved.contents.length : 0
  }
  const pages = doc.getPages()
  const own = pages.map((page: PDFPage) => {
    let bytes = 0
    const contents = page.node.Contents()
    if (contents) {
      const resolved = doc.context.lookup(contents)
      if (resolved instanceof PDFArray) {
        for (let i = 0; i < resolved.size(); i++) bytes += streamBytes(resolved.get(i))
      } else {
        bytes += streamBytes(contents)
      }
    }
    const resources = page.node.Resources()
    const xObjEntry = resources?.get(PDFName.of('XObject'))
    const xObjects = xObjEntry ? doc.context.lookup(xObjEntry) : undefined
    if (xObjects instanceof PDFDict) {
      for (const [, ref] of xObjects.entries()) bytes += streamBytes(ref)
    }
    return bytes
  })
  const ownTotal = own.reduce((a, b) => a + b, 0)
  const shared = Math.max(0, totalBytes - ownTotal) / Math.max(1, pages.length)
  return own.map((b) => b + shared)
}

/**
 * Groups pages (1-based, in order) so each group's estimated size stays
 * within the target. A single page larger than the target always forms a
 * group of its own — it cannot be split further — and is reported by the
 * caller after the real sizes are known.
 */
export function planSizeSplit(pageSizes: number[], targetBytes: number): number[][] {
  if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new Error('The target size must be more than zero.')
  const groups: number[][] = []
  let current: number[] = []
  let currentSize = 0
  pageSizes.forEach((size, i) => {
    if (current.length > 0 && currentSize + size > targetBytes) {
      groups.push(current)
      current = []
      currentSize = 0
    }
    current.push(i + 1)
    currentSize += size
  })
  if (current.length > 0) groups.push(current)
  return groups
}

export interface SizeSplitResult {
  files: { name: string; data: Uint8Array; pageCount: number }[]
  targetBytes: number
  /** Names of single-page files that came out over the target — unavoidable, but always reported. */
  oversizedSingles: string[]
  /** Names of any other files that came out over the target (estimate error). */
  oversizedFiles: string[]
}

export async function splitBySize(buffer: ArrayBuffer, targetMb: number): Promise<SizeSplitResult> {
  if (!Number.isFinite(targetMb) || targetMb < 0.05 || targetMb > 500) {
    throw new Error('Set a target size between 0.05 MB and 500 MB.')
  }
  const targetBytes = Math.round(targetMb * 1024 * 1024)
  const bytes = new Uint8Array(buffer.slice(0))
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const estimates = estimatePageSizes(doc, bytes.length)
  const groups = planSizeSplit(estimates, targetBytes)
  const parts = await splitPdfGroups(buffer, groups)
  const files = parts.map((part, i) => ({ name: part.name, data: part.data, pageCount: groups[i].length }))
  const oversizedSingles = files.filter((f) => f.pageCount === 1 && f.data.length > targetBytes).map((f) => f.name)
  const oversizedFiles = files.filter((f) => f.pageCount > 1 && f.data.length > targetBytes).map((f) => f.name)
  return { files, targetBytes, oversizedSingles, oversizedFiles }
}
