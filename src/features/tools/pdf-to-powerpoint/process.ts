export interface SlideImage {
  /** Full data URL of the rendered page image (PNG or JPEG). */
  dataUrl: string
  /** Page size in points, so the image can be fitted without distortion. */
  widthPt: number
  heightPt: number
}

/** Encodes raw image bytes as a data URL, in the browser and in tests. */
export function imageDataUrl(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg'): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

export interface FitRect { x: number; y: number; w: number; h: number }

/** Fits a page of one size inside a slide of another, centred, aspect kept. */
export function fitRect(pageW: number, pageH: number, slideW: number, slideH: number): FitRect {
  const scale = Math.min(slideW / pageW, slideH / pageH)
  const w = pageW * scale
  const h = pageH * scale
  return { x: (slideW - w) / 2, y: (slideH - h) / 2, w, h }
}

/**
 * Builds the .pptx: one slide per page image. The slide size follows the
 * first page, so a uniform document fills every slide exactly; a page of a
 * different size is fitted inside, centred on white. Slides are pictures —
 * the text on them is not editable, and the tool says so before it runs.
 * pptxgenjs loads on demand, only for this tool.
 */
export async function buildPptx(images: SlideImage[]): Promise<Uint8Array> {
  if (!images.length) throw new Error('There are no pages to turn into slides.')
  const PptxGenJS = (await import('pptxgenjs')).default
  const pres = new PptxGenJS()
  const slideW = Math.max(1, images[0].widthPt / 72)
  const slideH = Math.max(1, images[0].heightPt / 72)
  pres.defineLayout({ name: 'PDF_PAGE', width: slideW, height: slideH })
  pres.layout = 'PDF_PAGE'
  for (const image of images) {
    const slide = pres.addSlide()
    slide.background = { color: 'FFFFFF' }
    const rect = fitRect(image.widthPt, image.heightPt, slideW, slideH)
    slide.addImage({ data: image.dataUrl, x: rect.x, y: rect.y, w: rect.w, h: rect.h })
  }
  const out = await pres.write({ outputType: 'arraybuffer' })
  return new Uint8Array(out as ArrayBuffer)
}
