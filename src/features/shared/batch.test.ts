import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { deriveOutputName, runBatch, zipBatchResults, type BatchProcessOne } from './batch'
import { rotatePdf } from '../tools/rotate-pdf/process'
import { buf, makePdf } from '../tools/test-fixtures'

/** A real single-file process behind the thin adapter shape the tools use. */
const rotateOne: BatchProcessOne = async (buffer) => {
  const data = await rotatePdf(buffer, 90, [])
  return { blob: new Blob([data as BlobPart], { type: 'application/pdf' }), filename: 'rotated.pdf', note: 'Rotated by 90 degrees' }
}

describe('deriveOutputName', () => {
  it('prefixes the tool name with the source base name', () => {
    const used = new Set<string>()
    expect(deriveOutputName('invoice.pdf', 'rotated.pdf', used)).toBe('invoice-rotated.pdf')
    expect(deriveOutputName('report-final.pdf', 'compressed.pdf', used)).toBe('report-final-compressed.pdf')
  })

  it('keeps a canonical name that already starts with the source base name', () => {
    const used = new Set<string>()
    expect(deriveOutputName('invoice.pdf', 'invoice.txt', used)).toBe('invoice.txt')
    expect(deriveOutputName('invoice.pdf', 'invoice.docx', used)).toBe('invoice.docx')
  })

  it('suffixes duplicates so two results never share a name', () => {
    const used = new Set<string>()
    expect(deriveOutputName('invoice.pdf', 'rotated.pdf', used)).toBe('invoice-rotated.pdf')
    expect(deriveOutputName('invoice.pdf', 'rotated.pdf', used)).toBe('invoice-rotated-2.pdf')
    expect(deriveOutputName('invoice.pdf', 'rotated.pdf', used)).toBe('invoice-rotated-3.pdf')
  })
})

describe('runBatch', () => {
  it('processes good files around a corrupt one: two results and one error', async () => {
    const good1 = await makePdf(2)
    const good2 = await makePdf(3)
    const corrupt = new TextEncoder().encode('this is not a pdf at all').buffer as ArrayBuffer
    const progress: [number, number][] = []
    const outcome = await runBatch(
      [
        { name: 'first.pdf', buffer: buf(good1) },
        { name: 'broken.pdf', buffer: corrupt },
        { name: 'second.pdf', buffer: buf(good2) },
      ],
      rotateOne,
      { onProgress: (done, total) => progress.push([done, total]) },
    )
    expect(outcome.successes.map((s) => s.name)).toEqual(['first-rotated.pdf', 'second-rotated.pdf'])
    expect(outcome.successes.map((s) => s.sourceName)).toEqual(['first.pdf', 'second.pdf'])
    expect(outcome.successes[0].note).toBe('Rotated by 90 degrees')
    expect(outcome.failures).toHaveLength(1)
    expect(outcome.failures[0].sourceName).toBe('broken.pdf')
    expect(outcome.failures[0].error.length).toBeGreaterThan(0)
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]])
    // The successes are real rotated PDFs.
    const { pageWidths } = await import('../tools/test-fixtures')
    const rotated = new Uint8Array(await outcome.successes[0].blob.arrayBuffer())
    expect(await pageWidths(rotated)).toEqual([400, 420])
  })

  it('gives two copies of the same file different output names', async () => {
    const good = await makePdf(1)
    const outcome = await runBatch(
      [
        { name: 'same.pdf', buffer: buf(good) },
        { name: 'same.pdf', buffer: buf(good) },
      ],
      rotateOne,
    )
    expect(outcome.successes.map((s) => s.name)).toEqual(['same-rotated.pdf', 'same-rotated-2.pdf'])
    expect(outcome.failures).toHaveLength(0)
  })

  it('reports every file when all of them fail, and still completes', async () => {
    const corrupt = new TextEncoder().encode('nope').buffer as ArrayBuffer
    const outcome = await runBatch(
      [
        { name: 'a.pdf', buffer: corrupt },
        { name: 'b.pdf', buffer: corrupt.slice(0) },
      ],
      rotateOne,
    )
    expect(outcome.successes).toHaveLength(0)
    expect(outcome.failures.map((f) => f.sourceName)).toEqual(['a.pdf', 'b.pdf'])
  })

  it('stops when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const good = await makePdf(1)
    await expect(runBatch([{ name: 'x.pdf', buffer: buf(good) }], rotateOne, { signal: controller.signal })).rejects.toThrow('Cancelled')
  })
})

describe('zipBatchResults', () => {
  it('contains exactly the successful outputs, under their derived names', async () => {
    const good1 = await makePdf(2)
    const good2 = await makePdf(1)
    const corrupt = new TextEncoder().encode('junk').buffer as ArrayBuffer
    const outcome = await runBatch(
      [
        { name: 'first.pdf', buffer: buf(good1) },
        { name: 'broken.pdf', buffer: corrupt },
        { name: 'second.pdf', buffer: buf(good2) },
      ],
      rotateOne,
    )
    const zipBlob = await zipBatchResults(outcome.successes)
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual(['first-rotated.pdf', 'second-rotated.pdf'])
  })

  it('zips an empty success list to an empty archive', async () => {
    const zipBlob = await zipBatchResults([])
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
    expect(Object.keys(zip.files)).toEqual([])
  })
})
