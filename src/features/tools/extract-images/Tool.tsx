import ToolWorkspace, { panelClass } from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
import type { ExtractedImage } from './process'
const tool = getTool('extract-images')!

const HONESTY = 'How this works, plainly: the images stored inside the PDF are decoded and saved as PNG files at their original pixel size — not screenshots of the pages. A JPEG stored in the PDF comes out as a PNG copy of the same picture. Some PDFs store images masked or in tiles; any image that cannot be extracted cleanly is counted and left out, never saved as a broken file. The same image used many times is saved once.'

async function encodePng(img: ExtractedImage): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  if (img.rgba) {
    const copy = new Uint8ClampedArray(img.rgba.length)
    copy.set(img.rgba)
    ctx.putImageData(new ImageData(copy, img.width, img.height), 0, 0)
  } else if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0)
  } else {
    throw new Error('An image had no picture data to save.')
  }
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('An image could not be saved as a PNG.')
  return blob
}

export default function ExtractImagesTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice={HONESTY}
      actionLabel={() => 'Extract images'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files, signal, onProgress) => {
        const { extractImages, extractedImageName } = await import('./process')
        const { zipImages } = await import('../pdf-to-images/process')
        const result = await extractImages(files[0].buffer!, (page, total) => onProgress(page / total))
        if (signal.aborted) throw new Error('Cancelled')
        const notes: string[] = []
        if (result.duplicates) notes.push(`${result.duplicates} repeated ${result.duplicates === 1 ? 'copy' : 'copies'} skipped`)
        if (result.failed) notes.push(`${result.failed} could not be extracted cleanly and ${result.failed === 1 ? 'was' : 'were'} left out`)
        const noteText = notes.length ? ` (${notes.join('; ')})` : ''
        const blobs: { name: string; data: Blob }[] = []
        for (let i = 0; i < result.images.length; i++) {
          blobs.push({ name: extractedImageName(i, result.images.length), data: await encodePng(result.images[i]) })
        }
        const summary = `${result.images.length} ${result.images.length === 1 ? 'image' : 'images'} extracted from ${result.found} found in the document${noteText}`
        if (blobs.length === 1) {
          return [{ name: `${baseName(files[0].file.name)}-${blobs[0].name}`, blob: blobs[0].data, summary }]
        }
        const zip = await zipImages(blobs)
        return [{ name: `${baseName(files[0].file.name)}-images.zip`, blob: zip, summary: `${summary}, delivered in one ZIP file` }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">There is nothing to choose: every stored image is extracted at its full stored size. One image downloads on its own; several arrive in a single ZIP file. Pictures that are part of a scanned page are the page itself, so a scanned document yields one image per page.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
