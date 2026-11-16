import { PDFDocument, StandardFonts, rgb, type RGB } from 'pdf-lib'

/** All geometry is in page fractions (0..1), origin bottom-left. */
export type EditKind = 'highlight' | 'redact' | 'draw' | 'rect' | 'ellipse' | 'line' | 'text' | 'image'
export interface EditItem {
  kind: EditKind
  page: number
  x: number; y: number; w: number; h: number
  color: string
  opacity: number
  points?: { x: number; y: number }[]
  text?: string
  size?: number
  png?: Uint8Array
}

export function hexToRgb(hex: string): RGB {
  const m = hex.replace('#', '')
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function applyEdits(buffer: ArrayBuffer, edits: EditItem[]): Promise<Uint8Array> {
  if (edits.length === 0) throw new Error('Make at least one edit first.')
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const pages = doc.getPages()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const e of edits) {
    const page = pages[e.page - 1]
    if (!page) continue
    const { width, height } = page.getSize()
    const X = (v: number) => v * width
    const Y = (v: number) => v * height
    const color = hexToRgb(e.color)
    if (e.kind === 'highlight' || e.kind === 'redact' || e.kind === 'rect') {
      page.drawRectangle({ x: X(e.x), y: Y(e.y), width: X(e.w), height: Y(e.h), color, opacity: e.kind === 'redact' ? 1 : e.opacity, borderColor: e.kind === 'rect' ? color : undefined, borderWidth: e.kind === 'rect' ? 1.5 : undefined })
    } else if (e.kind === 'ellipse') {
      page.drawEllipse({ x: X(e.x) + X(e.w) / 2, y: Y(e.y) + Y(e.h) / 2, xScale: X(e.w) / 2, yScale: Y(e.h) / 2, color, opacity: e.opacity })
    } else if (e.kind === 'line' || e.kind === 'draw') {
      const pts = e.points ?? [{ x: e.x, y: e.y }, { x: e.x + e.w, y: e.y + e.h }]
      for (let i = 1; i < pts.length; i++) {
        page.drawLine({ start: { x: X(pts[i - 1].x), y: Y(pts[i - 1].y) }, end: { x: X(pts[i].x), y: Y(pts[i].y) }, thickness: e.kind === 'draw' ? 2 : 1.5, color, opacity: e.opacity })
      }
    } else if (e.kind === 'text' && e.text) {
      page.drawText(e.text, { x: X(e.x), y: Y(e.y), size: e.size ?? 14, font, color, opacity: e.opacity })
    } else if (e.kind === 'image' && e.png) {
      const img = await doc.embedPng(e.png)
      const w = X(e.w)
      page.drawImage(img, { x: X(e.x), y: Y(e.y), width: w, height: (img.height / img.width) * w, opacity: e.opacity })
    }
  }
  return doc.save()
}
