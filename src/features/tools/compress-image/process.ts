import { fitWithin, type ImageEngine, type ImageFormat } from '../image/engine'
import { enforceNotLarger } from '../compress-pdf/process'

export type CompressFormatChoice = 'keep' | 'jpeg' | 'webp'

export interface CompressImageOptions {
  /** 0–1, applies to JPEG and WebP output. PNG is lossless and ignores it. */
  quality: number
  /** Longest side allowed in the output, or null for no resizing. */
  maxDimension: number | null
  format: CompressFormatChoice
}

export interface CompressImageResult {
  data: Uint8Array
  /** The format of the returned bytes (the source format when the original was kept). */
  format: ImageFormat
  originalSize: number
  outputSize: number
  /** True when re-encoding was not smaller and the original bytes were returned, as Compress PDF does. */
  returnedOriginal: boolean
  width: number
  height: number
  outWidth: number
  outHeight: number
}

export async function compressImage(
  data: Uint8Array,
  engine: ImageEngine,
  sourceMime: string,
  sourceFormat: ImageFormat,
  options: CompressImageOptions,
): Promise<CompressImageResult> {
  const decoded = await engine.decode(data, sourceMime)
  const target = options.maxDimension
    ? fitWithin(decoded.width, decoded.height, options.maxDimension)
    : { width: decoded.width, height: decoded.height }
  const format = options.format === 'keep' ? sourceFormat : options.format
  const canvas = engine.createCanvas(target.width, target.height)
  if (format === 'jpeg') {
    canvas.context.fillStyle = '#ffffff'
    canvas.context.fillRect(0, 0, target.width, target.height)
  }
  canvas.context.drawImage(decoded.source, 0, 0, target.width, target.height)
  const candidate = await canvas.encode(format, options.quality)
  const kept = enforceNotLarger(data, candidate)
  return {
    data: kept.data,
    format: kept.returnedOriginal ? sourceFormat : format,
    originalSize: data.length,
    outputSize: kept.data.length,
    returnedOriginal: kept.returnedOriginal,
    width: decoded.width,
    height: decoded.height,
    outWidth: target.width,
    outHeight: target.height,
  }
}
