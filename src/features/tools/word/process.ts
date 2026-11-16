import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/** Wraps plain text into lines that fit the page width at the given font size. */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = []
  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) { lines.push(''); continue }
    let line = ''
    for (const word of para.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > maxChars) { lines.push(line.trim()); line = word }
      else line = line ? `${line} ${word}` : word
    }
    if (line.trim()) lines.push(line.trim())
  }
  return lines
}

/**
 * Builds a clean, text based PDF from extracted Word text.
 * This is the honest v1 conversion: text and paragraph structure are kept,
 * complex Word layout, tables and styling are not. The UI says so before processing.
 */
export async function textToPdf(text: string, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const size = 11, leading = 16, margin = 56
  const pageW = 595.28, pageH = 841.89
  const maxChars = 92
  const lines = wrapText(text, maxChars)
  let page = doc.addPage([pageW, pageH])
  let y = pageH - margin
  page.drawText(title.slice(0, 80), { x: margin, y, size: 16, font: bold, color: rgb(0.05, 0.05, 0.1) })
  y -= 28
  for (const line of lines) {
    if (y < margin) { page = doc.addPage([pageW, pageH]); y = pageH - margin }
    if (line) page.drawText(line.replace(/[^\x20-\x7E]/g, ''), { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.12) })
    y -= leading
  }
  return doc.save()
}

/* ------------------------------------------------------------------ */
/* Structured blocks -> PDF. The renderer Markdown to PDF uses; it     */
/* shares this module's page geometry, fonts and sanitising rules      */
/* with textToPdf above rather than inventing a second renderer.       */
/* ------------------------------------------------------------------ */

export interface PdfRun { text: string; bold?: boolean; italic?: boolean; mono?: boolean }

export type PdfBlock =
  | { type: 'heading'; level: number; runs: PdfRun[] }
  | { type: 'paragraph'; runs: PdfRun[] }
  | { type: 'listItem'; runs: PdfRun[]; ordered: boolean; index: number; depth: number }
  | { type: 'quote'; runs: PdfRun[] }
  | { type: 'code'; text: string }
  | { type: 'rule' }

const SMART: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u2022': '-',
  '\u00A0': ' ', '\u2192': '->', '\u2713': 'x', '\u2717': 'x',
}

/** Standard fonts only carry basic Latin; map common punctuation, drop the rest. */
export function sanitizeForPdf(text: string): string {
  let out = ''
  for (const ch of text) out += SMART[ch] ?? ch
  return out.replace(/[^\x20-\x7E]/g, '')
}

interface BlockFonts {
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>
  italic: Awaited<ReturnType<PDFDocument['embedFont']>>
  boldItalic: Awaited<ReturnType<PDFDocument['embedFont']>>
  mono: Awaited<ReturnType<PDFDocument['embedFont']>>
  monoBold: Awaited<ReturnType<PDFDocument['embedFont']>>
}

type EmbeddedFont = BlockFonts['regular']

function fontFor(run: PdfRun, fonts: BlockFonts): EmbeddedFont {
  if (run.mono) return run.bold ? fonts.monoBold : fonts.mono
  if (run.bold && run.italic) return fonts.boldItalic
  if (run.bold) return fonts.bold
  if (run.italic) return fonts.italic
  return fonts.regular
}

interface Token { text: string; run: PdfRun }

/** Splits runs into words, keeping each word's style, ready for wrapping. */
function tokenize(runs: PdfRun[]): Token[] {
  const tokens: Token[] = []
  for (const run of runs) {
    for (const word of sanitizeForPdf(run.text).split(/\s+/)) {
      if (word) tokens.push({ text: word, run })
    }
  }
  return tokens
}

/** Greedy word wrap measured in points with each token's own font. */
function wrapTokens(tokens: Token[], maxWidth: number, size: number, fonts: BlockFonts): Token[][] {
  const lines: Token[][] = []
  let line: Token[] = []
  let width = 0
  const pushLine = () => { if (line.length) { lines.push(line); line = []; width = 0 } }
  for (const token of tokens) {
    const font = fontFor(token.run, fonts)
    let rest = token.text
    // A single word wider than the line is split by characters.
    while (font.widthOfTextAtSize(rest, size) > maxWidth) {
      let cut = rest.length - 1
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--
      pushLine()
      lines.push([{ text: rest.slice(0, cut), run: token.run }])
      rest = rest.slice(cut)
    }
    const wordWidth = font.widthOfTextAtSize(rest, size)
    const spaceWidth = line.length ? font.widthOfTextAtSize(' ', size) : 0
    if (line.length && width + spaceWidth + wordWidth > maxWidth) pushLine()
    line.push({ text: rest, run: token.run })
    width += (line.length > 1 ? font.widthOfTextAtSize(' ', size) : 0) + wordWidth
  }
  pushLine()
  return lines
}

const HEADING_SIZES: Record<number, number> = { 1: 20, 2: 16, 3: 13.5, 4: 12, 5: 11.5, 6: 11 }

/**
 * Renders structured blocks (headings, paragraphs, lists, quotes, code,
 * rules) to a PDF with the same A4 geometry and Helvetica/Courier fonts
 * as textToPdf. The title is metadata only — the document's own first
 * heading is its visible title.
 */
export async function renderBlocksToPdf(blocks: PdfBlock[], title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  const fonts: BlockFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
    monoBold: await doc.embedFont(StandardFonts.CourierBold),
  }
  const ink = rgb(0.1, 0.1, 0.12)
  const margin = 56
  const pageW = 595.28, pageH = 841.89
  const contentW = pageW - margin * 2
  let page = doc.addPage([pageW, pageH])
  let y = pageH - margin

  const newPage = () => { page = doc.addPage([pageW, pageH]); y = pageH - margin }
  const ensure = (height: number) => { if (y - height < margin) newPage() }

  const drawLines = (lines: Token[][], size: number, leading: number, x: number) => {
    for (const lineTokens of lines) {
      ensure(leading)
      let cx = x
      lineTokens.forEach((token, i) => {
        const font = fontFor(token.run, fonts)
        const text = i > 0 ? ` ${token.text}` : token.text
        page.drawText(text, { x: cx, y, size, font, color: ink })
        cx += font.widthOfTextAtSize(text, size)
      })
      y -= leading
    }
  }

  for (const block of blocks) {
    if (block.type === 'rule') {
      ensure(18)
      y -= 6
      page.drawLine({ start: { x: margin, y: y + 3 }, end: { x: pageW - margin, y: y + 3 }, thickness: 0.75, color: rgb(0.75, 0.75, 0.8) })
      y -= 12
      continue
    }
    if (block.type === 'code') {
      const size = 9.5, leading = 13
      const charW = fonts.mono.widthOfTextAtSize('m', size)
      const maxChars = Math.max(10, Math.floor((contentW - 16) / charW))
      const rawLines = block.text.replace(/\r\n/g, '\n').split('\n').flatMap((l) => {
        if (l.length <= maxChars) return [l]
        const chunks: string[] = []
        for (let i = 0; i < l.length; i += maxChars) chunks.push(l.slice(i, i + maxChars))
        return chunks
      })
      const height = rawLines.length * leading + 12
      ensure(Math.min(height, pageH - margin * 2))
      const top = y
      page.drawRectangle({ x: margin, y: top - height + leading, width: contentW, height, color: rgb(0.95, 0.95, 0.97) })
      y -= 4
      for (const line of rawLines) {
        ensure(leading)
        page.drawText(sanitizeForPdf(line), { x: margin + 8, y, size, font: fonts.mono, color: ink })
        y -= leading
      }
      if (y > top - height) y = top - height
      y -= 8
      continue
    }
    if (block.type === 'heading') {
      const size = HEADING_SIZES[Math.min(6, Math.max(1, block.level))] ?? 11
      const runs = block.runs.map((r) => ({ ...r, bold: true }))
      const lines = wrapTokens(tokenize(runs), contentW, size, fonts)
      if (y < pageH - margin) y -= block.level <= 2 ? 12 : 8
      drawLines(lines, size, size * 1.3, margin)
      y -= 4
      continue
    }
    if (block.type === 'listItem') {
      const size = 11, leading = 16
      const indent = margin + block.depth * 18
      const textX = indent + 18
      const lines = wrapTokens(tokenize(block.runs), pageW - margin - textX, size, fonts)
      if (!lines.length) continue
      ensure(leading)
      const marker = block.ordered ? `${block.index}.` : '-'
      page.drawText(marker, { x: indent, y, size, font: fonts.regular, color: ink })
      drawLines(lines, size, leading, textX)
      y -= 2
      continue
    }
    if (block.type === 'quote') {
      const size = 11, leading = 16
      const runs = block.runs.map((r) => ({ ...r, italic: true }))
      const lines = wrapTokens(tokenize(runs), contentW - 20, size, fonts)
      if (!lines.length) continue
      const height = lines.length * leading
      ensure(height)
      const top = y
      drawLines(lines, size, leading, margin + 20)
      page.drawRectangle({ x: margin + 4, y: top - height + 4, width: 2.5, height: height - 2, color: rgb(0.7, 0.7, 0.75) })
      y -= 6
      continue
    }
    // paragraph
    const lines = wrapTokens(tokenize(block.runs), contentW, 11, fonts)
    drawLines(lines, 11, 16, margin)
    y -= 8
  }
  return doc.save()
}
