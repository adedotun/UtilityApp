import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type StampPlacement = 'header' | 'footer'
export type StampAlign = 'left' | 'center' | 'right'

export interface StampValues { page: number; total: number; date: string; filename: string }

/** Replaces {page}, {total}, {date} and {filename} in the stamp text. */
export function expandPlaceholders(template: string, values: StampValues): string {
  return template
    .replaceAll('{page}', String(values.page))
    .replaceAll('{total}', String(values.total))
    .replaceAll('{date}', values.date)
    .replaceAll('{filename}', values.filename)
}

export interface HeaderFooterOptions {
  text: string
  placement: StampPlacement
  align: StampAlign
  fontSize: number
  /** 0 to 1 */
  opacity: number
  filename: string
  date: string
}

export async function addHeaderFooter(buffer: ArrayBuffer, options: HeaderFooterOptions): Promise<Uint8Array> {
  if (!options.text.trim()) throw new Error('Enter the text to stamp.')
  if (options.fontSize < 6 || options.fontSize > 48) throw new Error('Choose a font size between 6 and 48.')
  if (options.opacity < 0.05 || options.opacity > 1) throw new Error('Choose an opacity between 5 and 100 percent.')
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const total = doc.getPageCount()
  const margin = 24
  doc.getPages().forEach((page, i) => {
    const text = expandPlaceholders(options.text, { page: i + 1, total, date: options.date, filename: options.filename })
    const { width, height } = page.getSize()
    const tw = font.widthOfTextAtSize(text, options.fontSize)
    let x = (width - tw) / 2
    if (options.align === 'left') x = margin
    if (options.align === 'right') x = width - margin - tw
    const y = options.placement === 'header' ? height - margin : margin - 4
    page.drawText(text, { x, y, size: options.fontSize, font, color: rgb(0.25, 0.25, 0.3), opacity: options.opacity })
  })
  return doc.save()
}
