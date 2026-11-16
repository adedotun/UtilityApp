import { compressPdf } from '../compress-pdf/process'
import { scrubPdf } from '../scrub-pdf/process'

/**
 * Prepare to share is a workflow, not a new engine: it chains the Scrub
 * tool's process and then the Compress tool's process, importing both.
 * Step 1 removes metadata, attachments and JavaScript and reports what it
 * found. Step 2 compresses the scrubbed file. The rasterised candidate
 * Compress prefers is built by the caller (the browser renders pages with
 * PDF.js and a canvas, exactly as the Compress tool does); without one,
 * compressPdf falls back to its structural resave.
 */

export type ShareStep = 'scrub' | 'compress'

export interface PrepareToShareResult {
  data: Uint8Array
  /** What step 1 removed, in the Scrub tool's own words. Empty when the file was already clean. */
  removed: string[]
  /** Size of the file the user added. */
  originalSize: number
  /** Size after step 1, before compression. */
  scrubbedSize: number
  /** Size of the final file. */
  outputSize: number
  /** True when compression could not shrink the scrubbed file and returned it unchanged. */
  returnedOriginal: boolean
}

function stepFailure(step: 1 | 2, name: string, err: unknown): Error {
  const detail = err instanceof Error ? err.message : 'Something went wrong.'
  return new Error(`Step ${step} of 2, ${name}, could not be completed: ${detail} No file was produced, so nothing half-finished is presented as the result.`)
}

export async function prepareToShare(
  buffer: ArrayBuffer,
  makeCandidate?: (scrubbed: ArrayBuffer) => Promise<Uint8Array | undefined>,
  onStep?: (step: ShareStep) => void,
): Promise<PrepareToShareResult> {
  onStep?.('scrub')
  let scrubbed
  try {
    scrubbed = await scrubPdf(buffer)
  } catch (err) {
    throw stepFailure(1, 'scrub', err)
  }

  onStep?.('compress')
  const scrubbedBuffer = Uint8Array.from(scrubbed.data).buffer as ArrayBuffer
  let candidate: Uint8Array | undefined
  if (makeCandidate) {
    try {
      candidate = await makeCandidate(scrubbedBuffer)
    } catch {
      // Rendering is an optimisation for Compress, not a requirement: with
      // no candidate it falls back to a structural resave, as its own tool
      // does when rendering fails.
      candidate = undefined
    }
  }
  let result
  try {
    result = await compressPdf(scrubbedBuffer, candidate)
  } catch (err) {
    throw stepFailure(2, 'compress', err)
  }

  return {
    data: result.data,
    removed: scrubbed.removed,
    originalSize: buffer.byteLength,
    scrubbedSize: scrubbed.data.length,
    outputSize: result.outputSize,
    returnedOriginal: result.returnedOriginal,
  }
}
