import type { ImageEngine, ImageFormat } from '../image/engine'

export type ResizeSpec =
  | { mode: 'percent'; percent: number }
  | { mode: 'pixels'; width: number | null; height: number | null }

/** The output size for a source of srcW × srcH under a resize spec. */
export function targetSize(srcW: number, srcH: number, spec: ResizeSpec): { width: number; height: number } {
  if (spec.mode === 'percent') {
    if (!Number.isFinite(spec.percent) || spec.percent <= 0) throw new Error('Enter a percentage above zero.')
    return {
      width: Math.max(1, Math.round((srcW * spec.percent) / 100)),
      height: Math.max(1, Math.round((srcH * spec.percent) / 100)),
    }
  }
  const { width, height } = spec
  if (width == null && height == null) throw new Error('Enter a width, a height, or both.')
  if (width != null && (!Number.isFinite(width) || width <= 0)) throw new Error('Enter a width above zero.')
  if (height != null && (!Number.isFinite(height) || height <= 0)) throw new Error('Enter a height above zero.')
  if (width != null && height != null) return { width: Math.round(width), height: Math.round(height) }
  if (width != null) return { width: Math.round(width), height: Math.max(1, Math.round((srcH * width) / srcW)) }
  return { width: Math.max(1, Math.round((srcW * height!) / srcH)), height: Math.round(height!) }
}

export interface ResizeImageResult {
  data: Uint8Array
  width: number
  height: number
  outWidth: number
  outHeight: number
}

/** Resamples an image to the spec size, keeping its format. */
export async function resizeImage(
  data: Uint8Array,
  engine: ImageEngine,
  sourceMime: string,
  sourceFormat: ImageFormat,
  spec: ResizeSpec,
  quality = 0.92,
): Promise<ResizeImageResult> {
  const decoded = await engine.decode(data, sourceMime)
  const target = targetSize(decoded.width, decoded.height, spec)
  const canvas = engine.createCanvas(target.width, target.height)
  if (sourceFormat === 'jpeg') {
    canvas.context.fillStyle = '#ffffff'
    canvas.context.fillRect(0, 0, target.width, target.height)
  }
  canvas.context.drawImage(decoded.source, 0, 0, target.width, target.height)
  const out = await canvas.encode(sourceFormat, quality)
  return { data: out, width: decoded.width, height: decoded.height, outWidth: target.width, outHeight: target.height }
}
