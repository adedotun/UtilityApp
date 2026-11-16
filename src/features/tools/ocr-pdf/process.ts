import { PDFDocument, StandardFonts } from 'pdf-lib'
import { assembleText } from '../pdf-to-text/process'
import type { OcrPageResult } from '../ocr-engine'

export const OCR_DPI = 300

// The recogniser itself lives in ../ocr-engine (shared with Image to Text
// since Wave 5); these re-exports keep this module's original public surface.
export { createRecognizer, linesFromBlocks } from '../ocr-engine'
export type { OcrLine, OcrPageResult, Recognizer, RecognizerOptions } from '../ocr-engine'

export interface RenderedPage {
  image: Uint8Array
  format: 'png' | 'jpeg'
  widthPx: number
  heightPx: number
  widthPt: number
  heightPt: number
}

export interface OcrDeps {
  /** Renders one page (1-based) to an image at OCR quality. Supplied by the caller: the browser uses PDF.js and a canvas; tests use the Node canvas. */
  renderPage: (pageNum: number) => Promise<RenderedPage>
  /** Recognises the words in one rendered page image. */
  recognize: (image: Uint8Array) => Promise<OcrPageResult>
  onProgress?: (page: number, total: number) => void
}

/**
 * Keeps text drawable with pdf-lib's Helvetica (WinAnsi). Common typographic
 * characters OCR produces are mapped to plain equivalents; anything still
 * outside the encoding is dropped rather than failing the whole page.
 */
export function toDrawableText(raw: string): string {
  const mapped = raw
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    .replace(/\u00a0/g, ' ')
  let out = ''
  for (const ch of mapped) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0xff || '€ŒœŠšŸŽžƒˆ˜–—‘’“”†‡•…‰‹›™'.includes(ch)) out += ch
  }
  return out
}

/**
 * Builds the searchable PDF: each page is its rendered image, with the
 * recognised lines drawn over it in invisible text (opacity 0) at the
 * position and size they were found. The page looks like the scan; the
 * words can be searched and copied.
 */
export async function buildSearchablePdf(pages: { rendered: RenderedPage; ocr: OcrPageResult }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const { rendered, ocr } of pages) {
    const image = rendered.format === 'png' ? await doc.embedPng(rendered.image) : await doc.embedJpg(rendered.image)
    const page = doc.addPage([rendered.widthPt, rendered.heightPt])
    page.drawImage(image, { x: 0, y: 0, width: rendered.widthPt, height: rendered.heightPt })
    const scaleX = rendered.widthPt / rendered.widthPx
    const scaleY = rendered.heightPt / rendered.heightPx
    for (const line of ocr.lines) {
      const text = toDrawableText(line.text.trim())
      if (!text) continue
      page.drawText(text, {
        x: line.x0 * scaleX,
        y: rendered.heightPt - line.y1 * scaleY,
        size: Math.max(4, (line.y1 - line.y0) * scaleY),
        font,
        opacity: 0,
      })
    }
  }
  return doc.save()
}

export interface OcrResult { pdf: Uint8Array; text: string; pageCount: number; pagesWithText: number }

export async function ocrPdf(buffer: ArrayBuffer, deps: OcrDeps): Promise<OcrResult> {
  let pageCount: number
  try {
    const probe = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
    pageCount = probe.getPageCount()
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const pages: { rendered: RenderedPage; ocr: OcrPageResult }[] = []
  for (let i = 1; i <= pageCount; i++) {
    const rendered = await deps.renderPage(i)
    const ocr = await deps.recognize(rendered.image)
    pages.push({ rendered, ocr })
    deps.onProgress?.(i, pageCount)
  }
  const pagesWithText = pages.filter((p) => p.ocr.text.trim().length > 0).length
  if (!pagesWithText) {
    throw new Error('No words could be recognised in this PDF. OCR reads clear scans best; if the pages are blank, very faint or photographed at an angle, there may be nothing it can read.')
  }
  const pdf = await buildSearchablePdf(pages)
  const text = assembleText(pages.map((p) => p.ocr.text.trim()))
  return { pdf, text, pageCount, pagesWithText }
}
