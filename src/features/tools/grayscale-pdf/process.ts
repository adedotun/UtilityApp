import { buildRasterizedPdf, LEVEL_DPI, type CompressLevel } from '../compress-pdf/process'

/** Same render levels as Compress: pages are rendered at a DPI and rebuilt as images. */
export type GrayscaleLevel = CompressLevel
export const GRAYSCALE_DPI = LEVEL_DPI

export interface PixelImage { data: Uint8ClampedArray; width: number; height: number }

/** Rec. 709 luma weights — the mix screens and printers use for grayscale. */
export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
}

/**
 * Converts an RGBA pixel buffer to grayscale in place: every pixel's red,
 * green and blue channels become its luminance, so R = G = B throughout.
 * Alpha is left untouched.
 */
export function grayscalePixels(image: PixelImage): PixelImage {
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const y = luminance(data[i], data[i + 1], data[i + 2])
    data[i] = y
    data[i + 1] = y
    data[i + 2] = y
  }
  return image
}

/**
 * Rebuilds the PDF from grayscaled page renders, at their original point
 * sizes. Unlike Compress there is no "return the original" guarantee here:
 * the point of the tool is the conversion, even when the file grows.
 */
export async function buildGrayscalePdf(pages: { jpeg: Uint8Array; widthPt: number; heightPt: number }[]): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('No pages were rendered, so there is nothing to convert.')
  return buildRasterizedPdf(pages)
}
