import * as pdfjsLib from 'pdfjs-dist'
// Locally bundled worker — never a CDN. Vite emits it as a separate asset.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite url import
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl as string
export { pdfjsLib }
export type PdfDocProxy = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>

export async function loadPdfJs(data: ArrayBuffer): Promise<PdfDocProxy> {
  return pdfjsLib.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
}

/** Renders one page (1-based) into the canvas at the given CSS width. Returns the canvas scale used. */
export async function renderPage(doc: PdfDocProxy, pageNum: number, canvas: HTMLCanvasElement, targetWidth: number): Promise<number> {
  const page = await doc.getPage(pageNum)
  const base = page.getViewport({ scale: 1 })
  const scale = targetWidth / base.width
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return scale
}
