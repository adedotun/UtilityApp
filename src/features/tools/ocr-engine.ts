/**
 * Shared local OCR recogniser (tesseract.js), used by OCR PDF and Image to
 * Text. Moved out of ocr-pdf/process.ts in Wave 5 so both tools drive the
 * same engine setup; ocr-pdf re-exports these names for its existing tests.
 */

export interface OcrLine { text: string; x0: number; y0: number; x1: number; y1: number }
export interface OcrPageResult { text: string; lines: OcrLine[] }

export interface RecognizerOptions {
  /** Browser: URL of the locally bundled worker script. Node: left unset, the package resolves its own script. */
  workerPath?: string
  /** Directory the core wasm builds are served from (the worker picks the SIMD variant). */
  corePath?: string
  /** Directory holding eng.traineddata.gz. */
  langPath?: string
  cachePath?: string
  gzip?: boolean
  onProgress?: (fraction: number) => void
}

export interface Recognizer {
  recognize: (image: Uint8Array) => Promise<OcrPageResult>
  terminate: () => Promise<void>
}

interface TessLine { text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }
interface TessBlock { paragraphs?: { lines?: TessLine[] }[] }

/** Extracts positioned lines from a tesseract result's block tree. */
export function linesFromBlocks(blocks: TessBlock[] | null | undefined): OcrLine[] {
  const lines: OcrLine[] = []
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        if (!line.bbox || !line.text?.trim()) continue
        lines.push({ text: line.text.trim(), x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 })
      }
    }
  }
  return lines
}

/**
 * Creates a tesseract worker. Every asset it loads — worker script, core
 * wasm, English traineddata — comes from paths the caller passes, which in
 * the browser are URLs served by this app itself. Nothing is fetched from
 * a CDN: that is the product's privacy rule, and tesseract's own defaults
 * point at jsDelivr, so the paths must always be set in the browser.
 */
export async function createRecognizer(options: RecognizerOptions = {}): Promise<Recognizer> {
  const { createWorker } = await import('tesseract.js')
  const workerOptions: Record<string, unknown> = {
    gzip: options.gzip ?? true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') options.onProgress?.(m.progress)
    },
  }
  if (options.workerPath) workerOptions.workerPath = options.workerPath
  if (options.corePath) workerOptions.corePath = options.corePath
  if (options.langPath) workerOptions.langPath = options.langPath
  if (options.cachePath) workerOptions.cachePath = options.cachePath
  const worker = await createWorker('eng', undefined, workerOptions as never)
  return {
    async recognize(image: Uint8Array): Promise<OcrPageResult> {
      const { data } = await worker.recognize(image as never, {}, { blocks: true, text: true } as never)
      const result = data as unknown as { text?: string; blocks?: TessBlock[] | null }
      return { text: (result.text ?? '').trim(), lines: linesFromBlocks(result.blocks) }
    },
    async terminate(): Promise<void> {
      await worker.terminate()
    },
  }
}
