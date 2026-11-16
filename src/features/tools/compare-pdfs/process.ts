import { pdfjsLib } from '../../../lib/pdfjs'
import { pageTextFromItems } from '../pdf-to-text/process'

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

/** The text of one PDF as lines per page: trimmed, blank lines dropped. */
export async function extractPageLines(buffer: ArrayBuffer, label: string): Promise<string[][]> {
  resolveWorkerForNode()
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch {
    throw new Error(`${label} could not be read as a PDF. It may be damaged or password protected.`)
  }
  const pages: string[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = pageTextFromItems(content.items as unknown[])
    pages.push(text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0))
  }
  if (pages.every((lines) => lines.length === 0)) {
    throw new Error(`${label} has no readable text, so there is nothing to compare. It may be made of scanned images — the OCR tool can read those first.`)
  }
  return pages
}

export type DiffKind = 'same' | 'removed' | 'added'
export interface DiffLine { kind: DiffKind; text: string }

/**
 * Line-level diff via a longest-common-subsequence table. Pages hold at
 * most a few hundred lines, so the table stays small; past a million cells
 * it falls back to trimming the common head and tail and treating the
 * differing middle as removed-then-added, which stays truthful.
 */
export function diffLines(a: string[], b: string[]): DiffLine[] {
  if (a.length * b.length > 1_000_000) return coarseDiff(a, b)
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ kind: 'removed', text: a[i] }); i++ }
    else { out.push({ kind: 'added', text: b[j] }); j++ }
  }
  while (i < a.length) { out.push({ kind: 'removed', text: a[i] }); i++ }
  while (j < b.length) { out.push({ kind: 'added', text: b[j] }); j++ }
  return out
}

function coarseDiff(a: string[], b: string[]): DiffLine[] {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB-- }
  return [
    ...a.slice(0, start).map((text) => ({ kind: 'same' as const, text })),
    ...a.slice(start, endA + 1).map((text) => ({ kind: 'removed' as const, text })),
    ...b.slice(start, endB + 1).map((text) => ({ kind: 'added' as const, text })),
    ...a.slice(endA + 1).map((text) => ({ kind: 'same' as const, text })),
  ]
}

export type PageStatus = 'same' | 'changed' | 'only-in-a' | 'only-in-b'
export interface PageComparison { page: number; status: PageStatus; diff?: DiffLine[] }

function linesEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i])
}

/** Compares two documents page by page, position for position. */
export function comparePageTexts(aPages: string[][], bPages: string[][]): PageComparison[] {
  const total = Math.max(aPages.length, bPages.length)
  const out: PageComparison[] = []
  for (let i = 0; i < total; i++) {
    const page = i + 1
    if (i >= aPages.length) { out.push({ page, status: 'only-in-b' }); continue }
    if (i >= bPages.length) { out.push({ page, status: 'only-in-a' }); continue }
    if (linesEqual(aPages[i], bPages[i])) { out.push({ page, status: 'same' }); continue }
    out.push({ page, status: 'changed', diff: diffLines(aPages[i], bPages[i]) })
  }
  return out
}

export interface ComparisonResult {
  pages: PageComparison[]
  aPageCount: number
  bPageCount: number
  counts: Record<PageStatus, number>
}

export async function comparePdfs(bufferA: ArrayBuffer, bufferB: ArrayBuffer): Promise<ComparisonResult> {
  const aPages = await extractPageLines(bufferA, 'The first PDF')
  const bPages = await extractPageLines(bufferB, 'The second PDF')
  const pages = comparePageTexts(aPages, bPages)
  const counts: Record<PageStatus, number> = { same: 0, changed: 0, 'only-in-a': 0, 'only-in-b': 0 }
  for (const p of pages) counts[p.status]++
  return { pages, aPageCount: aPages.length, bPageCount: bPages.length, counts }
}

/** A plain-text version of the comparison, for downloading and keeping. */
export function comparisonReport(result: ComparisonResult, nameA: string, nameB: string): string {
  const lines: string[] = [
    `Comparison of ${nameA} (A) and ${nameB} (B)`,
    'Compared on text only — layout, fonts and images were not compared.',
    '',
    `A has ${result.aPageCount} pages, B has ${result.bPageCount} pages.`,
    `Same: ${result.counts.same} · Text changed: ${result.counts.changed} · Only in A: ${result.counts['only-in-a']} · Only in B: ${result.counts['only-in-b']}`,
    '',
  ]
  for (const page of result.pages) {
    if (page.status === 'same') lines.push(`Page ${page.page}: same`)
    else if (page.status === 'only-in-a') lines.push(`Page ${page.page}: only in A`)
    else if (page.status === 'only-in-b') lines.push(`Page ${page.page}: only in B`)
    else {
      lines.push(`Page ${page.page}: text changed`)
      for (const d of page.diff ?? []) {
        if (d.kind === 'removed') lines.push(`  - ${d.text}`)
        else if (d.kind === 'added') lines.push(`  + ${d.text}`)
      }
    }
  }
  return lines.join('\n')
}
