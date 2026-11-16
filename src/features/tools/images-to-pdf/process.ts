import { PDFDocument } from 'pdf-lib'

export type PageSizeChoice = 'a4' | 'letter' | 'legal' | 'fit'
export type OrientationChoice = 'auto' | 'portrait' | 'landscape'

const SIZES: Record<Exclude<PageSizeChoice, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
}

export interface ImageInput { data: Uint8Array; kind: 'png' | 'jpg' }

export function imageKind(fileName: string, type: string): 'png' | 'jpg' | null {
  if (type === 'image/png' || fileName.toLowerCase().endsWith('.png')) return 'png'
  if (type === 'image/jpeg' || /\.jpe?g$/i.test(fileName)) return 'jpg'
  return null
}

/** Converts other image formats to PNG bytes via canvas (browser only). */
export async function toPngBytes(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width; canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error(`"${file.name}" could not be converted.`)
  return new Uint8Array(await blob.arrayBuffer())
}

export async function imagesToPdf(images: ImageInput[], pageSize: PageSizeChoice, orientation: OrientationChoice): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('Add at least one image.')
  const doc = await PDFDocument.create()
  for (const img of images) {
    const embedded = img.kind === 'png' ? await doc.embedPng(img.data) : await doc.embedJpg(img.data)
    let pageW: number, pageH: number
    if (pageSize === 'fit') {
      pageW = embedded.width; pageH = embedded.height
    } else {
      ;[pageW, pageH] = SIZES[pageSize]
      const landscape = orientation === 'landscape' || (orientation === 'auto' && embedded.width > embedded.height)
      if (landscape && pageW < pageH) [pageW, pageH] = [pageH, pageW]
      if (!landscape && pageW > pageH) [pageW, pageH] = [pageH, pageW]
    }
    const page = doc.addPage([pageW, pageH])
    const margin = pageSize === 'fit' ? 0 : 36
    const availW = pageW - margin * 2, availH = pageH - margin * 2
    const scale = Math.min(availW / embedded.width, availH / embedded.height)
    const w = embedded.width * scale, h = embedded.height * scale
    page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h })
  }
  return doc.save()
}
