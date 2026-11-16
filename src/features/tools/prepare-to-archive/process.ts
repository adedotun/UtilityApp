import { PDFDocument, StandardFonts } from 'pdf-lib'
import { pdfjsLib } from '../../../lib/pdfjs'
import { pageTextFromItems } from '../pdf-to-text/process'
import { flattenPdf } from '../flatten-pdf/process'
import { toDrawableText, type OcrPageResult, type RenderedPage } from '../ocr-pdf/process'

/**
 * Prepare to archive is a workflow, not a new engine: step 1 is OCR, step 2
 * is the Flatten tool's process, imported rather than copied.
 *
 * The OCR step is deliberately narrower than the OCR tool. The OCR tool
 * rebuilds every page as an image with a text layer; an archive copy should
 * keep its original pages wherever they are already searchable. So only
 * pages with no text layer are recognised, and their words are drawn onto
 * the original page as invisible text (the same technique the OCR tool's
 * searchable output uses), leaving every other page byte-identical in
 * structure. When every page already has text, OCR is skipped and the
 * workflow says so.
 */

function resolveWorkerForNode(): void {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (!proc?.versions?.node || !proc.cwd) return
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${proc.cwd()}${src}`
  }
}

export interface ArchiveDeps {
  /** Renders one page (1-based) of the original document. Supplied by the caller, as in the OCR tool. */
  renderPage: (pageNum: number) => Promise<RenderedPage>
  /** Recognises the words in one rendered page image. */
  recognize: (image: Uint8Array) => Promise<OcrPageResult>
  onStep?: (step: 'ocr' | 'flatten') => void
  /** Called after each page that needed OCR has been recognised. */
  onProgress?: (done: number, total: number) => void
}

export interface ArchiveResult {
  data: Uint8Array
  pageCount: number
  /** Pages that had no text layer and so needed OCR. */
  pagesNeedingOcr: number
  /** Of those, the pages where recognised words were actually added. */
  pagesOcrd: number
  /** True when every page already had text and step 1 had nothing to do. */
  ocrSkipped: boolean
  /** Form fields found for step 2 (0 when there were none to flatten). */
  fieldCount: number
  flattened: boolean
}

function stepFailure(step: 1 | 2, name: string, err: unknown): Error {
  const detail = err instanceof Error ? err.message : 'Something went wrong.'
  return new Error(`Step ${step} of 2, ${name}, could not be completed: ${detail} No file was produced, so nothing half-finished is presented as the result.`)
}

/** 1-based page numbers whose text layer is empty, read with PDF.js. */
export async function pagesLackingText(buffer: ArrayBuffer): Promise<{ pageCount: number; lacking: number[] }> {
  resolveWorkerForNode()
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const lacking: number[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    if (!pageTextFromItems(content.items as unknown[]).trim()) lacking.push(i)
  }
  return { pageCount: doc.numPages, lacking }
}

export async function prepareToArchive(buffer: ArrayBuffer, deps: ArchiveDeps): Promise<ArchiveResult> {
  // Step 1: OCR, only where a text layer is missing.
  deps.onStep?.('ocr')
  let pageCount: number
  let lacking: number[]
  let working: Uint8Array = new Uint8Array(buffer.slice(0))
  let pagesOcrd = 0
  try {
    const found = await pagesLackingText(buffer)
    pageCount = found.pageCount
    lacking = found.lacking
    if (lacking.length) {
      const doc = await PDFDocument.load(working.slice(), { ignoreEncryption: true })
      const font = await doc.embedFont(StandardFonts.Helvetica)
      let done = 0
      for (const pageNum of lacking) {
        const rendered = await deps.renderPage(pageNum)
        const ocr = await deps.recognize(rendered.image)
        done++
        deps.onProgress?.(done, lacking.length)
        if (!ocr.text.trim()) continue
        const page = doc.getPage(pageNum - 1)
        const { width, height } = page.getSize()
        const scaleX = width / rendered.widthPx
        const scaleY = height / rendered.heightPx
        for (const line of ocr.lines) {
          const text = toDrawableText(line.text.trim())
          if (!text) continue
          page.drawText(text, {
            x: line.x0 * scaleX,
            y: height - line.y1 * scaleY,
            size: Math.max(4, (line.y1 - line.y0) * scaleY),
            font,
            opacity: 0,
          })
        }
        pagesOcrd++
      }
      if (pagesOcrd === 0) {
        throw new Error('No words could be recognised on the pages that have no text layer. OCR reads clear scans best; if those pages are blank, very faint or photographed at an angle, there may be nothing it can read.')
      }
      working = await doc.save()
    }
  } catch (err) {
    throw stepFailure(1, 'OCR', err)
  }

  // Step 2: flatten, when there are form fields to flatten.
  deps.onStep?.('flatten')
  let fieldCount = 0
  let flattened = false
  try {
    const probe = await PDFDocument.load(working.slice(), { ignoreEncryption: true })
    fieldCount = probe.getForm().getFields().length
    if (fieldCount > 0) {
      const flat = await flattenPdf(working.slice().buffer as ArrayBuffer)
      working = flat.data
      flattened = true
    }
  } catch (err) {
    throw stepFailure(2, 'flatten', err)
  }

  return {
    data: working,
    pageCount,
    pagesNeedingOcr: lacking.length,
    pagesOcrd,
    ocrSkipped: lacking.length === 0,
    fieldCount,
    flattened,
  }
}
