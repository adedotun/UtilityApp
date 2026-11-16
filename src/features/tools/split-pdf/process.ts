import { PDFDocument } from 'pdf-lib'

export type SplitMode = 'all' | 'ranges' | 'every-n'

/** Parses "1-3, 5, 7-9" into sorted unique 1-based page numbers. Throws with a specific message. */
export function parsePageRanges(input: string, maxPages: number): number[] {
  const pages = new Set<number>()
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) throw new Error('Enter at least one page or range, for example 1-3, 5.')
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) throw new Error(`"${part}" is not a valid page or range. Use numbers like 2 or ranges like 1-3.`)
    const start = parseInt(m[1], 10)
    const end = m[2] ? parseInt(m[2], 10) : start
    if (start < 1 || end < start) throw new Error(`"${part}" is not a valid range. The first page must come before the last.`)
    if (end > maxPages) throw new Error(`"${part}" goes past the last page, which is page ${maxPages}.`)
    for (let p = start; p <= end; p++) pages.add(p)
  }
  return [...pages].sort((a, b) => a - b)
}

/** Groups of 1-based pages the split will produce. Used for the live output count preview. */
export function planSplit(mode: SplitMode, pageCount: number, rangesInput: string, everyN: number): number[][] {
  if (pageCount < 1) return []
  if (mode === 'all') return Array.from({ length: pageCount }, (_, i) => [i + 1])
  if (mode === 'every-n') {
    const n = Math.max(1, Math.floor(everyN) || 1)
    const groups: number[][] = []
    for (let i = 0; i < pageCount; i += n) groups.push(Array.from({ length: Math.min(n, pageCount - i) }, (_, j) => i + j + 1))
    return groups
  }
  // ranges: each comma part becomes one output file
  const groups: number[][] = []
  for (const part of rangesInput.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) throw new Error(`"${part}" is not a valid page or range.`)
    const start = parseInt(m[1], 10); const end = m[2] ? parseInt(m[2], 10) : start
    if (start < 1 || end < start || end > pageCount) throw new Error(`"${part}" is outside this document, which has ${pageCount} pages.`)
    groups.push(Array.from({ length: end - start + 1 }, (_, j) => start + j))
  }
  if (groups.length === 0) throw new Error('Enter at least one range, for example 1-3, 5-7.')
  return groups
}

export async function splitPdf(buffer: ArrayBuffer, mode: SplitMode, rangesInput: string, everyN: number): Promise<{ name: string; data: Uint8Array }[]> {
  const src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const groups = planSplit(mode, src.getPageCount(), rangesInput, everyN)
  const out: { name: string; data: Uint8Array }[] = []
  for (let i = 0; i < groups.length; i++) {
    const doc = await PDFDocument.create()
    const pages = await doc.copyPages(src, groups[i].map((p) => p - 1))
    pages.forEach((p) => doc.addPage(p))
    const label = groups[i].length === 1 ? `page-${groups[i][0]}` : `pages-${groups[i][0]}-${groups[i][groups[i].length - 1]}`
    out.push({ name: `${label}.pdf`, data: await doc.save() })
  }
  return out
}
