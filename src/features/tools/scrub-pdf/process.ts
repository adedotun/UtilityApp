import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
} from 'pdf-lib'
import { pdfjsLib } from '../../../lib/pdfjs'
// @ts-ignore - vite asset url import for the qpdf wasm binary (bundled locally, never a CDN)
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'
import createModule from '@neslinesli93/qpdf-wasm'

function resolveWorkerForNode(): void {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (!proc?.versions?.node || !proc.cwd) return
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${proc.cwd()}${src}`
  }
}

const METADATA_KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'] as const
const METADATA_LABELS: Record<(typeof METADATA_KEYS)[number], string> = {
  Title: 'Title', Author: 'Author', Subject: 'Subject', Keywords: 'Keywords', Creator: 'Creator', Producer: 'Producer',
}

export interface ScrubFindings {
  metadata: { label: string; value: string }[]
  attachments: string[]
  javascript: string[]
  xmpMetadata: boolean
}

function nameTreeKeys(tree: PDFDict | undefined, depth = 0): string[] {
  if (!tree || depth > 6) return []
  const keys: string[] = []
  const names = tree.lookup(PDFName.of('Names'))
  if (names instanceof PDFArray) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      const key = names.get(i)
      if (key instanceof PDFString || key instanceof PDFHexString) keys.push(key.decodeText())
    }
  }
  const kids = tree.lookup(PDFName.of('Kids'))
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookup(i)
      if (kid instanceof PDFDict) keys.push(...nameTreeKeys(kid, depth + 1))
    }
  }
  return keys
}

function namesDict(doc: PDFDocument): PDFDict | undefined {
  const names = doc.catalog.lookup(PDFName.of('Names'))
  return names instanceof PDFDict ? names : undefined
}

/** True when a dict is, or chains via Next to, a JavaScript action. */
function containsJavaScript(obj: unknown, depth = 0): boolean {
  if (depth > 4) return false
  if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) if (containsJavaScript(obj.lookup(i), depth + 1)) return true
    return false
  }
  if (!(obj instanceof PDFDict)) return false
  const s = obj.lookup(PDFName.of('S'))
  if (s instanceof PDFName && s.asString() === '/JavaScript') return true
  const next = obj.lookup(PDFName.of('Next'))
  return next !== undefined && containsJavaScript(next, depth + 1)
}

function catalogJavaScript(doc: PDFDocument): string[] {
  const found: string[] = []
  const catalog = doc.catalog
  if (containsJavaScript(catalog.lookup(PDFName.of('OpenAction')))) {
    found.push('JavaScript that runs when the document opens')
  }
  const aa = catalog.lookup(PDFName.of('AA'))
  if (aa instanceof PDFDict && containsJavaScript(aa)) {
    found.push('JavaScript in the document additional actions')
  }
  const names = namesDict(doc)
  const jsTree = names?.lookup(PDFName.of('JavaScript'))
  if (jsTree instanceof PDFDict) {
    for (const name of nameTreeKeys(jsTree)) found.push(`Saved JavaScript named "${name}"`)
    if (!nameTreeKeys(jsTree).length) found.push('Saved JavaScript in the document name tree')
  }
  return found
}

/**
 * Finds everything scrubbing would remove. Metadata, attachments and named
 * scripts are read from the document structure with pdf-lib; PDF.js
 * getJSActions and getAttachments are merged in as a second detector.
 * (PDF.js v7 misses attachments in some pdf-lib-written name trees, so
 * neither detector is trusted alone.)
 */
export async function detectScrubFindings(buffer: ArrayBuffer): Promise<ScrubFindings> {
  const findings: ScrubFindings = { metadata: [], attachments: [], javascript: [], xmpMetadata: false }
  // updateMetadata: false matters here: pdf-lib otherwise stamps its own
  // Creator and Producer into the in-memory info dict on load, and the
  // detection would report values that are not actually in the file.
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true, updateMetadata: false })
  const values: Record<string, string> = {
    Title: doc.getTitle() ?? '', Author: doc.getAuthor() ?? '', Subject: doc.getSubject() ?? '',
    Keywords: doc.getKeywords() ?? '', Creator: doc.getCreator() ?? '', Producer: doc.getProducer() ?? '',
  }
  for (const key of METADATA_KEYS) {
    if (values[key]) findings.metadata.push({ label: METADATA_LABELS[key], value: values[key] })
  }
  findings.xmpMetadata = doc.catalog.has(PDFName.of('Metadata'))
  const names = namesDict(doc)
  const efTree = names?.lookup(PDFName.of('EmbeddedFiles'))
  if (efTree instanceof PDFDict) findings.attachments.push(...nameTreeKeys(efTree))
  findings.javascript.push(...catalogJavaScript(doc))

  resolveWorkerForNode()
  try {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
    const attachments = await pdf.getAttachments().catch(() => null)
    if (attachments) {
      for (const name of Object.keys(attachments)) {
        if (!findings.attachments.includes(name)) findings.attachments.push(name)
      }
    }
    const actions = await pdf.getJSActions().catch(() => null)
    if (actions) {
      const keys = actions instanceof Map ? [...actions.keys()] : Object.keys(actions as object)
      for (const key of keys) {
        if (key === 'OpenAction' && findings.javascript.some((j) => j.includes('when the document opens'))) continue
        const label = `JavaScript action reported by the reader: ${key}`
        if (!findings.javascript.includes(label)) findings.javascript.push(label)
      }
    }
  } catch {
    // PDF.js could not read the file; the pdf-lib findings above still stand.
  }
  return findings
}

function resolveWasmLocation(): string {
  const url = wasmUrl as unknown as string
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (proc?.versions?.node && proc.cwd && url.startsWith('/node_modules/')) return proc.cwd() + url
  return url
}

/**
 * A qpdf rewrite after the structural removals, so objects that are no
 * longer referenced (the attachment streams themselves) are dropped from
 * the file rather than left unreachable inside it. If qpdf cannot rewrite
 * the file, the pdf-lib result is used — the catalogue entries are gone
 * either way, which is what readers act on.
 */
async function dropUnreferenced(data: Uint8Array): Promise<Uint8Array> {
  try {
    const qpdf = await createModule({ locateFile: () => resolveWasmLocation() })
    const fs = qpdf.FS as unknown as { writeFile: (p: string, d: Uint8Array) => void; readFile: (p: string) => Uint8Array }
    fs.writeFile('/in.pdf', data.slice())
    const code = qpdf.callMain(['/in.pdf', '/out.pdf'])
    if (code !== 0 && code !== 3) return data
    return fs.readFile('/out.pdf')
  } catch {
    return data
  }
}

export interface ScrubResult { data: Uint8Array; removed: string[]; findings: ScrubFindings }

export async function scrubPdf(buffer: ArrayBuffer): Promise<ScrubResult> {
  const findings = await detectScrubFindings(buffer)
  let doc: PDFDocument
  try {
    // updateMetadata: false, or pdf-lib would stamp its own Creator and
    // Producer back into the file on save, undoing the scrub.
    doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { updateMetadata: false })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const removed: string[] = findings.metadata.map((m) => `${m.label} metadata: "${m.value}"`)
  if (findings.xmpMetadata) removed.push('XMP metadata stream')
  removed.push(...findings.attachments.map((a) => `Attachment: ${a}`))
  removed.push(...findings.javascript)

  const context = doc.context as unknown as { trailerInfo: { Info?: unknown } }
  const info = context.trailerInfo.Info ? doc.context.lookup(context.trailerInfo.Info as never) : undefined
  if (info instanceof PDFDict) {
    for (const key of METADATA_KEYS) info.delete(PDFName.of(key))
  }
  const catalog = doc.catalog
  if (catalog.has(PDFName.of('Metadata'))) catalog.delete(PDFName.of('Metadata'))
  const names = namesDict(doc)
  if (names) {
    if (names.has(PDFName.of('EmbeddedFiles'))) names.delete(PDFName.of('EmbeddedFiles'))
    if (names.has(PDFName.of('JavaScript'))) names.delete(PDFName.of('JavaScript'))
    if (names.entries().length === 0) catalog.delete(PDFName.of('Names'))
  }
  if (catalog.has(PDFName.of('AF'))) catalog.delete(PDFName.of('AF'))
  if (containsJavaScript(catalog.lookup(PDFName.of('OpenAction')))) catalog.delete(PDFName.of('OpenAction'))
  const aa = catalog.lookup(PDFName.of('AA'))
  if (aa instanceof PDFDict) {
    for (const [key] of [...aa.entries()]) {
      if (containsJavaScript(aa.lookup(key))) aa.delete(key)
    }
    if (aa.entries().length === 0) catalog.delete(PDFName.of('AA'))
  }

  const saved = await doc.save()
  const data = removed.length ? await dropUnreferenced(saved) : saved
  return { data, removed, findings }
}
