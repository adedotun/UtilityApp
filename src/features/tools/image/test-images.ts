import { createCanvas } from '@napi-rs/canvas'

/** Deterministic pseudo-random source, so fixtures are stable between runs. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/**
 * A textured test image: blocks of varied colour over a gradient, busy
 * enough that lossy re-encoding behaves realistically (unlike a flat fill,
 * which compresses to almost nothing in every format).
 */
export function makeTestImage(width: number, height: number, format: 'png' | 'jpeg' | 'webp', seed = 42): Uint8Array {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const rand = lcg(seed)
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const r = Math.floor(120 + 120 * Math.sin(x * 0.05) * rand())
      const g = Math.floor(200 * rand())
      const b = Math.floor(200 * ((x + y) / (width + height)))
      ctx.fillStyle = `rgb(${Math.abs(r)},${g},${b})`
      ctx.fillRect(x, y, 8, 8)
    }
  }
  ctx.fillStyle = '#102030'
  ctx.font = '28px sans-serif'
  ctx.fillText('Test image', 24, 48)
  if (format === 'jpeg') return new Uint8Array(canvas.toBuffer('image/jpeg', 90))
  if (format === 'webp') return new Uint8Array(canvas.toBuffer('image/webp'))
  return new Uint8Array(canvas.toBuffer('image/png'))
}

/** A white image with large dark text — the OCR fixture recipe the PDF OCR tests use. */
export function makeTextImage(lines: string[]): Uint8Array {
  const canvas = createCanvas(1200, 400)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1200, 400)
  ctx.fillStyle = '#000000'
  ctx.font = '64px sans-serif'
  ctx.fillText(lines[0] ?? '', 60, 140)
  ctx.font = '44px sans-serif'
  ctx.fillText(lines[1] ?? '', 60, 260)
  return new Uint8Array(canvas.toBuffer('image/png'))
}
