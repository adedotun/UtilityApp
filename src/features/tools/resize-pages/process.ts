import { PDFDocument } from 'pdf-lib'

/** Standard page sizes in PDF points (1 point = 1/72 inch), portrait. */
export const PAGE_SIZES = {
  a4: { label: 'A4', widthPt: 595.28, heightPt: 841.89 },
  letter: { label: 'Letter', widthPt: 612, heightPt: 792 },
  legal: { label: 'Legal', widthPt: 612, heightPt: 1008 },
} as const

export type PageSizeName = keyof typeof PAGE_SIZES

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72
}

/** PDF pages must stay within these bounds; outside them readers misbehave. */
export const MIN_PAGE_PT = 36
export const MAX_PAGE_PT = 14400

export interface FitTransform { scale: number; x: number; y: number; drawnWidth: number; drawnHeight: number }

/**
 * The transform that fits a page of one size inside a target size:
 * scaled by the smaller ratio, centred, aspect ratio preserved.
 */
export function fitTransform(srcW: number, srcH: number, targetW: number, targetH: number): FitTransform {
  const scale = Math.min(targetW / srcW, targetH / srcH)
  const drawnWidth = srcW * scale
  const drawnHeight = srcH * scale
  return { scale, x: (targetW - drawnWidth) / 2, y: (targetH - drawnHeight) / 2, drawnWidth, drawnHeight }
}

/**
 * Rebuilds the document with every page at the target size. Each original
 * page is embedded and drawn scaled to fit, centred — content is never
 * cropped or stretched, so a page of a different shape gets even margins.
 */
export async function resizePdf(buffer: ArrayBuffer, targetWidthPt: number, targetHeightPt: number): Promise<Uint8Array> {
  if (
    !Number.isFinite(targetWidthPt) || !Number.isFinite(targetHeightPt) ||
    targetWidthPt < MIN_PAGE_PT || targetHeightPt < MIN_PAGE_PT ||
    targetWidthPt > MAX_PAGE_PT || targetHeightPt > MAX_PAGE_PT
  ) {
    throw new Error('That page size is outside the range a PDF can use. Choose a size between 13 mm and 5080 mm on each side.')
  }
  let src: PDFDocument
  try {
    src = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const out = await PDFDocument.create()
  for (const page of src.getPages()) {
    const { width, height } = page.getSize()
    const embedded = await out.embedPage(page)
    const target = out.addPage([targetWidthPt, targetHeightPt])
    const fit = fitTransform(width, height, targetWidthPt, targetHeightPt)
    target.drawPage(embedded, { x: fit.x, y: fit.y, width: fit.drawnWidth, height: fit.drawnHeight })
  }
  return out.save()
}
