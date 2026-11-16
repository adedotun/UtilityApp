import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type PageNumberFormat = 'plain' | 'page' | 'of-total' | 'page-of-total'
export type PageNumberPosition = 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'

export function formatPageNumber(format: PageNumberFormat, page: number, total: number): string {
  switch (format) {
    case 'plain': return `${page}`
    case 'page': return `Page ${page}`
    case 'of-total': return `${page} / ${total}`
    case 'page-of-total': return `Page ${page} of ${total}`
  }
}

export async function addPageNumbers(buffer: ArrayBuffer, format: PageNumberFormat, position: PageNumberPosition, start: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const size = 10
  const total = doc.getPageCount()
  doc.getPages().forEach((page, i) => {
    const text = formatPageNumber(format, start + i, start + total - 1)
    const { width, height } = page.getSize()
    const tw = font.widthOfTextAtSize(text, size)
    const margin = 24
    let x = (width - tw) / 2
    if (position.endsWith('left')) x = margin
    if (position.endsWith('right')) x = width - margin - tw
    const y = position.startsWith('top') ? height - margin : margin - 4
    page.drawText(text, { x, y, size, font, color: rgb(0.25, 0.25, 0.3) })
  })
  return doc.save()
}
