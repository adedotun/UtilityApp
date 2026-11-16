import { pdfjsLib } from '../../../lib/pdfjs'

/**
 * Under Vitest/Node the bundled worker URL is a root relative /node_modules
 * path; resolve it as a file URL against the cwd, the same fix pdf-to-text
 * uses. In the browser the URL Vite emits is used untouched.
 */
function resolveWorkerForNode(): void {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (!proc?.versions?.node || !proc.cwd) return
  const src = pdfjsLib.GlobalWorkerOptions.workerSrc as unknown as string
  if (typeof src === 'string' && src.startsWith('/node_modules/')) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${proc.cwd()}${src}`
  }
}

/** PDF.js image kinds: how the decoded pixel data is packed. */
export const ImageKind = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 } as const

export interface RawImageData {
  width: number
  height: number
  kind?: number
  data?: Uint8Array | Uint8ClampedArray
  bitmap?: ImageBitmap | null
}

/**
 * Converts decoded PDF.js pixels to RGBA, the one shape a canvas (and the
 * tests) can consume. Returns null when the data does not match the stated
 * dimensions — a corrupt or unsupported image is reported, never emitted.
 * Kind 1 is 1-bit grayscale, packed eight pixels to a byte, first pixel in
 * the most significant bit; a set bit is white.
 */
export function pixelsToRgba(img: RawImageData): Uint8ClampedArray | null {
  const { width, height } = img
  if (!img.data || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null
  const data = img.data
  const pixels = width * height
  const out = new Uint8ClampedArray(pixels * 4)

  if (img.kind === ImageKind.RGBA_32BPP) {
    if (data.length < pixels * 4) return null
    out.set(data.subarray(0, pixels * 4))
    return out
  }
  if (img.kind === ImageKind.RGB_24BPP) {
    if (data.length < pixels * 3) return null
    for (let i = 0; i < pixels; i++) {
      out[i * 4] = data[i * 3]
      out[i * 4 + 1] = data[i * 3 + 1]
      out[i * 4 + 2] = data[i * 3 + 2]
      out[i * 4 + 3] = 255
    }
    return out
  }
  if (img.kind === ImageKind.GRAYSCALE_1BPP) {
    const stride = Math.ceil(width / 8)
    if (data.length < stride * height) return null
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = data[y * stride + (x >> 3)]
        const bit = (byte >> (7 - (x & 7))) & 1
        const gray = bit ? 255 : 0
        const o = (y * width + x) * 4
        out[o] = gray
        out[o + 1] = gray
        out[o + 2] = gray
        out[o + 3] = 255
      }
    }
    return out
  }
  // No kind stated: infer the packing from the data length.
  if (data.length >= pixels * 4) {
    out.set(data.subarray(0, pixels * 4))
    return out
  }
  if (data.length >= pixels * 3) {
    for (let i = 0; i < pixels; i++) {
      out[i * 4] = data[i * 3]
      out[i * 4 + 1] = data[i * 3 + 1]
      out[i * 4 + 2] = data[i * 3 + 2]
      out[i * 4 + 3] = 255
    }
    return out
  }
  if (data.length >= pixels) {
    for (let i = 0; i < pixels; i++) {
      out[i * 4] = data[i]
      out[i * 4 + 1] = data[i]
      out[i * 4 + 2] = data[i]
      out[i * 4 + 3] = 255
    }
    return out
  }
  return null
}

export interface ExtractedImage {
  /** 1-based page the image was found on. */
  page: number
  width: number
  height: number
  /** Decoded pixels, ready for a canvas. Null when PDF.js supplied a bitmap instead. */
  rgba: Uint8ClampedArray | null
  bitmap: ImageBitmap | null
}

export interface ExtractResult {
  images: ExtractedImage[]
  /** Every image placement seen in the document. */
  found: number
  /** Placements whose image could not be decoded cleanly. */
  failed: number
  /** Placements skipped because the identical image was already extracted. */
  duplicates: number
  pageCount: number
}

/** Small FNV-1a hash, used only to spot identical image data. */
function dataHash(img: RawImageData): string {
  const data = img.data!
  let hash = 0x811c9dc5
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]
    hash = Math.imul(hash, 0x01000193)
  }
  return `${img.kind ?? 0}:${img.width}x${img.height}:${data.length}:${(hash >>> 0).toString(16)}`
}

interface ObjsLike {
  get: (id: string, callback: (data: unknown) => void, errorCallback?: (err: unknown) => void) => unknown
}

interface PageLike {
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>
  objs: ObjsLike
  commonObjs: ObjsLike
}

function getImageObject(page: PageLike, name: string): Promise<RawImageData> {
  return new Promise((resolve, reject) => {
    const onData = (data: unknown) => resolve(data as RawImageData)
    const onError = (err: unknown) => reject(err instanceof Error ? err : new Error('An image could not be read.'))
    try {
      page.objs.get(name, onData, onError)
    } catch {
      page.commonObjs.get(name, onData, onError)
    }
  })
}

/**
 * Pulls the images stored in a PDF out at their original pixel size.
 * PDF.js decodes each placed image while its operator list is built; the
 * decoded pixels are converted to RGBA for saving as PNG. Images stored
 * in ways that do not decode cleanly (some masked or tiled images) are
 * counted as failed rather than written out corrupt.
 */
export async function extractImages(buffer: ArrayBuffer, onProgress?: (page: number, total: number) => void): Promise<ExtractResult> {
  resolveWorkerForNode()
  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const OPS = pdfjsLib.OPS
  const images: ExtractedImage[] = []
  const seen = new Set<string>()
  let found = 0
  let failed = 0
  let duplicates = 0

  const accept = (img: RawImageData, pageNum: number) => {
    if (img.data) {
      const key = dataHash(img)
      if (seen.has(key)) { duplicates++; return }
      const rgba = pixelsToRgba(img)
      if (!rgba) { failed++; return }
      seen.add(key)
      images.push({ page: pageNum, width: img.width, height: img.height, rgba, bitmap: null })
    } else if (img.bitmap) {
      images.push({ page: pageNum, width: img.width, height: img.height, rgba: null, bitmap: img.bitmap })
    } else {
      failed++
    }
  }

  for (let p = 1; p <= doc.numPages; p++) {
    const page = (await doc.getPage(p)) as unknown as PageLike
    const ops = await page.getOperatorList()
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]
      if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
        found++
        try {
          const img = await getImageObject(page, ops.argsArray[i][0] as string)
          accept(img, p)
        } catch {
          failed++
        }
      } else if (fn === OPS.paintInlineImageXObject || fn === OPS.paintInlineImageXObjectGroup) {
        found++
        accept(ops.argsArray[i][0] as RawImageData, p)
      }
    }
    onProgress?.(p, doc.numPages)
  }

  if (found === 0) {
    throw new Error('No images were found in this PDF. Pages drawn as text or vector shapes hold no stored images to extract.')
  }
  if (!images.length) {
    throw new Error('Images were found in this PDF, but none could be extracted cleanly. Some PDFs store images masked or in tiles, and those do not come out as single pictures.')
  }
  return { images, found, failed, duplicates, pageCount: doc.numPages }
}

export function extractedImageName(index: number, total: number): string {
  const pad = String(total).length
  return `image-${String(index + 1).padStart(pad, '0')}.png`
}
