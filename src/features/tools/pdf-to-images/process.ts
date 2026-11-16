import JSZip from 'jszip'

export interface PageImage { name: string; data: Blob }

export async function zipImages(images: PageImage[]): Promise<Blob> {
  const zip = new JSZip()
  for (const img of images) zip.file(img.name, img.data)
  return zip.generateAsync({ type: 'blob' })
}

export function pageImageName(index: number, total: number, format: 'png' | 'jpeg'): string {
  const pad = String(total).length
  return `page-${String(index + 1).padStart(pad, '0')}.${format === 'png' ? 'png' : 'jpg'}`
}
