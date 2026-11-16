import { PDFDocument } from 'pdf-lib'

export type BlankSensitivity = 'strict' | 'normal' | 'loose'

/**
 * How much of a page may be covered in "ink" before it stops counting as
 * blank, per sensitivity. A page with any extractable text is never blank,
 * whatever the pixels say — a single line of text is content.
 */
export const INK_LIMITS: Record<BlankSensitivity, number> = {
  strict: 0.0005,
  normal: 0.002,
  loose: 0.01,
}

export interface PixelImage { data: Uint8ClampedArray; width: number; height: number }

/** A channel must differ from the background by more than this to count as ink. */
const INK_CHANNEL_DELTA = 24
/** Pixels are subsampled so a high-resolution render costs no more than this many samples. */
const MAX_SAMPLES = 200_000

/**
 * The page background, estimated from small patches at the four corners.
 * Scans are rarely pure white, so comparing against white would mark every
 * scanned page as covered in ink.
 */
export function backgroundColour(image: PixelImage): { r: number; g: number; b: number } {
  const { data, width, height } = image
  const patch = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 4)))
  const corners: [number, number][] = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ]
  let r = 0; let g = 0; let b = 0; let n = 0
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + patch; y++) {
      for (let x = cx; x < cx + patch; x++) {
        const i = (y * width + x) * 4
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      }
    }
  }
  return { r: r / n, g: g / n, b: b / n }
}

/** Fraction of sampled pixels that differ meaningfully from the background. */
export function inkRatio(image: PixelImage): number {
  const { data, width, height } = image
  const bg = backgroundColour(image)
  const total = width * height
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES))
  let ink = 0
  let sampled = 0
  for (let p = 0; p < total; p += step) {
    const i = p * 4
    const diff = Math.max(
      Math.abs(data[i] - bg.r),
      Math.abs(data[i + 1] - bg.g),
      Math.abs(data[i + 2] - bg.b),
    )
    if (diff > INK_CHANNEL_DELTA) ink++
    sampled++
  }
  return sampled === 0 ? 0 : ink / sampled
}

export interface PageAnalysis { inkRatio: number; hasText: boolean; blank: boolean }

/**
 * A page is blank when it carries no extractable text and its rendered
 * pixels are (near-)uniform — nothing but background, within the
 * sensitivity's ink allowance.
 */
export function analyzePage(image: PixelImage, text: string, sensitivity: BlankSensitivity): PageAnalysis {
  const ratio = inkRatio(image)
  const hasText = text.trim().length > 0
  return { inkRatio: ratio, hasText, blank: !hasText && ratio <= INK_LIMITS[sensitivity] }
}

export interface BlankPageInfo extends PageAnalysis { page: number }

export interface BlankDeps {
  /** Renders one page (1-based) and returns its pixels plus its extractable text. The browser uses PDF.js and a canvas; tests use the Node canvas. */
  renderPage: (pageNum: number) => Promise<{ pixels: PixelImage; text: string }>
  onProgress?: (page: number, total: number) => void
}

export interface BlankDetection { pageCount: number; pages: BlankPageInfo[]; blankPages: number[] }

export async function detectBlankPages(buffer: ArrayBuffer, sensitivity: BlankSensitivity, deps: BlankDeps): Promise<BlankDetection> {
  let pageCount: number
  try {
    const probe = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
    pageCount = probe.getPageCount()
  } catch {
    throw new Error('This file could not be read as a PDF. It may be damaged or password protected.')
  }
  const pages: BlankPageInfo[] = []
  for (let i = 1; i <= pageCount; i++) {
    const { pixels, text } = await deps.renderPage(i)
    pages.push({ page: i, ...analyzePage(pixels, text, sensitivity) })
    deps.onProgress?.(i, pageCount)
  }
  return { pageCount, pages, blankPages: pages.filter((p) => p.blank).map((p) => p.page) }
}
