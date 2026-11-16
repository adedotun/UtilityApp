import { pdfjsLib } from '../../../lib/pdfjs'

/**
 * Under Vitest/Node the bundled worker URL is a root relative /node_modules
 * path; resolve it as a file URL against the cwd, the same fix pdf-to-text
 * uses. In the browser the URL Vite emits is used untouched.
 */
function resolveWorkerForNode(): void {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (!proc?.versions?.node || !proc.cwd) return
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${proc.cwd()}${src}`
  }
}

export interface TextLine { text: string; size: number; y: number }
export interface WordParagraph { text: string; level: 0 | 1 | 2 | 3 }

interface ItemLike {
  str?: unknown
  transform?: unknown
  width?: unknown
}

/**
 * Groups PDF.js text items into lines. Items on the same baseline (within a
 * fraction of the font size) belong to one line; items are ordered left to
 * right and joined with a space only where there is a real horizontal gap.
 */
export function linesFromItems(items: unknown[]): TextLine[] {
  const placed: { str: string; x: number; y: number; size: number; width: number }[] = []
  for (const item of items) {
    const it = item as ItemLike
    if (typeof it.str !== 'string' || !it.str) continue
    const t = it.transform as number[] | undefined
    if (!Array.isArray(t) || t.length < 6) continue
    const size = Math.abs(t[3]) || Math.abs(t[0]) || 12
    placed.push({ str: it.str, x: t[4], y: t[5], size, width: typeof it.width === 'number' ? it.width : 0 })
  }
  placed.sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TextLine[] = []
  let current: typeof placed = []
  const flush = () => {
    if (!current.length) return
    current.sort((a, b) => a.x - b.x)
    let text = ''
    for (let i = 0; i < current.length; i++) {
      if (i > 0) {
        const prev = current[i - 1]
        const gap = current[i].x - (prev.x + prev.width)
        if (gap > 1.5 && !text.endsWith(' ') && !current[i].str.startsWith(' ')) text += ' '
      }
      text += current[i].str
    }
    const size = Math.max(...current.map((c) => c.size))
    lines.push({ text: text.replace(/\s+/g, ' ').trim(), size, y: current[0].y })
    current = []
  }
  for (const p of placed) {
    if (current.length && Math.abs(p.y - current[0].y) > Math.max(2, current[0].size * 0.35)) flush()
    current.push(p)
  }
  flush()
  return lines.filter((l) => l.text.length > 0)
}

/**
 * Turns lines into paragraphs. A vertical gap well beyond the line height
 * starts a new paragraph. Heading levels come from font size relative to the
 * most common (body) size on the page set: 1.6x is a heading 1, 1.3x a
 * heading 2, 1.15x a heading 3.
 */
export function paragraphsFromLines(lines: TextLine[]): WordParagraph[] {
  if (!lines.length) return []
  const counts = new Map<number, number>()
  for (const l of lines) counts.set(Math.round(l.size), (counts.get(Math.round(l.size)) ?? 0) + 1)
  const bodySize = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const levelFor = (size: number): WordParagraph['level'] => {
    if (size >= bodySize * 1.6) return 1
    if (size >= bodySize * 1.3) return 2
    if (size >= bodySize * 1.15) return 3
    return 0
  }
  const paragraphs: WordParagraph[] = []
  let buffer: string[] = []
  let prev: TextLine | null = null
  const flush = () => {
    if (!buffer.length) return
    paragraphs.push({ text: buffer.join(' '), level: 0 })
    buffer = []
  }
  for (const line of lines) {
    const level = levelFor(line.size)
    if (level > 0) {
      flush()
      paragraphs.push({ text: line.text, level })
      prev = null
      continue
    }
    if (prev && prev.y - line.y > line.size * 2.2) flush()
    buffer.push(line.text)
    prev = line
  }
  flush()
  return paragraphs
}

export interface ExtractedParagraphs { paragraphs: WordParagraph[]; pageCount: number }

export async function extractParagraphs(buffer: ArrayBuffer): Promise<ExtractedParagraphs> {
  resolveWorkerForNode()
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const all: WordParagraph[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    all.push(...paragraphsFromLines(linesFromItems(content.items as unknown[])))
  }
  if (!all.length) {
    throw new Error('This PDF has no readable text to rebuild from. It may be made of scanned images — the OCR tool can read those.')
  }
  return { paragraphs: all, pageCount: doc.numPages }
}

/** Builds the .docx. The docx library is loaded on demand, only for this tool. */
export async function buildDocx(paragraphs: WordParagraph[]): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const levels = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const
  const doc = new Document({
    sections: [{
      children: paragraphs.map((p) => new Paragraph({
        heading: p.level === 0 ? undefined : levels[p.level],
        children: [new TextRun(p.text)],
      })),
    }],
  })
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

export async function pdfToWord(buffer: ArrayBuffer): Promise<{ data: Uint8Array; pageCount: number; paragraphCount: number }> {
  const { paragraphs, pageCount } = await extractParagraphs(buffer)
  const data = await buildDocx(paragraphs)
  return { data, pageCount, paragraphCount: paragraphs.length }
}
