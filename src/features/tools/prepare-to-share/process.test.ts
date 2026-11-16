import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { prepareToShare } from './process'
import { scrubPdf } from '../scrub-pdf/process'
import { buf, makePdf, pageWidths } from '../test-fixtures'

// PDF.js (used inside Scrub) uses Uint8Array.prototype.toHex and Map upsert
// helpers, which this Node runtime does not provide (current browsers do).
// Polyfill for tests only, the same block the Scrub tests carry.
const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string }
if (typeof u8proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array) { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('') },
  })
}
type UpsertProto = Record<string, unknown>
const upsertImpl = function (this: Map<unknown, unknown>, key: unknown, fn: (k: unknown) => unknown) { if (!this.has(key)) this.set(key, fn(key)); return this.get(key) }
const mapProto = Map.prototype as unknown as UpsertProto
if (typeof mapProto.getOrInsertComputed !== 'function') {
  mapProto.getOrInsertComputed = upsertImpl
  ;(WeakMap.prototype as unknown as UpsertProto).getOrInsertComputed = upsertImpl
}

describe('prepareToShare', () => {
  it('scrubs first, then compresses, and reports both steps', async () => {
    const source = await makePdf(2, { title: 'Quarterly secrets', author: 'Ada' })
    const steps: string[] = []
    const result = await prepareToShare(buf(source), undefined, (s) => steps.push(s))
    expect(steps).toEqual(['scrub', 'compress'])
    expect(result.removed.some((r) => r.includes('Title metadata'))).toBe(true)
    expect(result.removed.some((r) => r.includes('Author metadata'))).toBe(true)
    expect(result.originalSize).toBe(source.length)
    expect(result.scrubbedSize).toBeLessThanOrEqual(result.originalSize + 1024)
    expect(result.outputSize).toBe(result.data.length)
    // The final file is a valid PDF with the same pages, and the metadata is gone.
    expect(await pageWidths(result.data)).toEqual([400, 420])
    const out = await PDFDocument.load(result.data.slice(), { updateMetadata: false })
    expect(out.getTitle() ?? '').toBe('')
    expect(out.getAuthor() ?? '').toBe('')
  })

  it('completes the chain and says so when the file has nothing to scrub', async () => {
    const source = await makePdf(1, { title: 'Clean me first' })
    const once = await scrubPdf(buf(source))
    const result = await prepareToShare(buf(once.data))
    expect(result.removed).toEqual([])
    expect(await pageWidths(result.data)).toEqual([400])
  })

  it('names step 1 when scrubbing fails and produces no file', async () => {
    const corrupt = new TextEncoder().encode('definitely not a pdf').buffer as ArrayBuffer
    await expect(prepareToShare(corrupt)).rejects.toThrow(/Step 1 of 2, scrub/)
  })

  it('hands the scrubbed file, not the original, to the candidate builder', async () => {
    const source = await makePdf(1, { title: 'Candidate path' })
    let titleSeenByCandidate: string | null = null
    const result = await prepareToShare(buf(source), async (scrubbed) => {
      const doc = await PDFDocument.load(new Uint8Array(scrubbed.slice(0)), { updateMetadata: false })
      titleSeenByCandidate = doc.getTitle() ?? ''
      return undefined
    })
    // By the time compression runs, step 1 has already taken the title out.
    expect(titleSeenByCandidate).toBe('')
    expect(await pageWidths(result.data)).toEqual([400])
  })
})
