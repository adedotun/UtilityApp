import { baseName } from '../../lib/files'

/**
 * Batch mode: the same options applied to many files, one output per input.
 * This module is the engine only — it knows nothing about any tool. A tool
 * supplies a process function for one file (its existing process function
 * behind a thin adapter) and the runner walks the inputs in order, keeping
 * successes and failures apart so one bad file never kills the batch.
 */

export interface BatchInput {
  /** The source file name, used to derive the output name and to label failures. */
  name: string
  buffer: ArrayBuffer
}

export interface BatchOutput {
  blob: Blob
  /** The tool's canonical output name for one file, for example "rotated.pdf". */
  filename: string
  /** Optional per-file note shown next to the result, for example a scrub report. */
  note?: string
}

export type BatchProcessOne = (buffer: ArrayBuffer, sourceName: string) => Promise<BatchOutput>

export interface BatchSuccess {
  sourceName: string
  /** Final output name, derived from the source name and unique within the batch. */
  name: string
  blob: Blob
  note?: string
}

export interface BatchFailure {
  sourceName: string
  error: string
}

export interface BatchOutcome {
  successes: BatchSuccess[]
  failures: BatchFailure[]
}

/**
 * Derives one output name from the source and the tool's canonical name:
 * "invoice.pdf" through Rotate becomes "invoice-rotated.pdf". A canonical
 * name that already starts with the source base name (PDF to text produces
 * "invoice.txt") is kept as it is. Names already used in this batch get a
 * numeric suffix, so adding the same file twice never overwrites a result.
 */
export function deriveOutputName(sourceName: string, outputName: string, used: Set<string>): string {
  const srcBase = baseName(sourceName)
  const dot = outputName.lastIndexOf('.')
  const ext = dot > 0 ? outputName.slice(dot) : ''
  const outBase = dot > 0 ? outputName.slice(0, dot) : outputName
  let candidate = outBase.toLowerCase().startsWith(srcBase.toLowerCase()) && srcBase.length > 0
    ? outputName
    : `${srcBase}-${outBase}${ext}`
  if (!used.has(candidate.toLowerCase())) {
    used.add(candidate.toLowerCase())
    return candidate
  }
  let n = 2
  while (used.has(`${baseName(candidate)}-${n}${ext}`.toLowerCase())) n++
  candidate = `${baseName(candidate)}-${n}${ext}`
  used.add(candidate.toLowerCase())
  return candidate
}

export interface RunBatchOptions {
  signal?: AbortSignal
  /** Called after each file finishes, with the count done and the total. */
  onProgress?: (done: number, total: number) => void
  /** Called as each file settles, so the UI can show per-file state live. */
  onFileDone?: (index: number, result: BatchSuccess | BatchFailure) => void
}

/**
 * Runs processOne over every input, in order. A file that throws becomes a
 * failure entry carrying the error's message; the batch continues with the
 * next file. Throws only when the run is aborted, matching the single-file
 * cancel behaviour.
 */
export async function runBatch(inputs: BatchInput[], processOne: BatchProcessOne, options: RunBatchOptions = {}): Promise<BatchOutcome> {
  const successes: BatchSuccess[] = []
  const failures: BatchFailure[] = []
  const used = new Set<string>()
  for (let i = 0; i < inputs.length; i++) {
    if (options.signal?.aborted) throw new Error('Cancelled')
    const input = inputs[i]
    try {
      const out = await processOne(input.buffer, input.name)
      const success: BatchSuccess = { sourceName: input.name, name: deriveOutputName(input.name, out.filename, used), blob: out.blob, note: out.note }
      successes.push(success)
      options.onFileDone?.(i, success)
    } catch (err) {
      const failure: BatchFailure = { sourceName: input.name, error: err instanceof Error ? err.message : 'Something went wrong while processing this file.' }
      failures.push(failure)
      options.onFileDone?.(i, failure)
    }
    options.onProgress?.(i + 1, inputs.length)
  }
  return { successes, failures }
}

/** Packs every successful output into one ZIP, under its derived name. */
export async function zipBatchResults(successes: BatchSuccess[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const s of successes) zip.file(s.name, s.blob)
  return zip.generateAsync({ type: 'blob' })
}
