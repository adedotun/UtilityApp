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
