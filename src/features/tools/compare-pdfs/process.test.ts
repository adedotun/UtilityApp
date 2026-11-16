import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { comparePageTexts, comparePdfs, comparisonReport, diffLines } from './process'
import { buf } from '../test-fixtures'

// Test-environment polyfills (same set as the other PDF.js-in-Node tests).
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

describe('diffLines', () => {
  it('marks identical lines as the same', () => {
    expect(diffLines(['a', 'b'], ['a', 'b'])).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: 'b' },
    ])
  })

  it('shows a changed line as removed then added, in place', () => {
    expect(diffLines(['one', 'two', 'three'], ['one', 'TWO', 'three'])).toEqual([
      { kind: 'same', text: 'one' },
      { kind: 'removed', text: 'two' },
      { kind: 'added', text: 'TWO' },
      { kind: 'same', text: 'three' },
    ])
  })

  it('handles pure insertions and deletions', () => {
    expect(diffLines(['a', 'c'], ['a', 'b', 'c']).filter((d) => d.kind !== 'same')).toEqual([{ kind: 'added', text: 'b' }])
    expect(diffLines(['a', 'b', 'c'], ['a', 'c']).filter((d) => d.kind !== 'same')).toEqual([{ kind: 'removed', text: 'b' }])
  })
})

describe('comparePageTexts', () => {
  it('classifies pages as same, changed, or only on one side', () => {
    const result = comparePageTexts(
      [['alpha'], ['bravo'], ['charlie']],
      [['alpha'], ['bravo revised'], ['charlie'], ['delta']],
    )
    expect(result.map((p) => p.status)).toEqual(['same', 'changed', 'same', 'only-in-b'])
    const reversed = comparePageTexts([['a'], ['b']], [['a']])
    expect(reversed.map((p) => p.status)).toEqual(['same', 'only-in-a'])
  })
})

async function makeTextPdf(pageTexts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const text of pageTexts) {
    const page = doc.addPage([612, 792])
    if (text) page.drawText(text, { x: 60, y: 700, size: 16, font })
  }
  return doc.save()
}

describe('comparePdfs on fixtures', () => {
  it('finds exactly one changed page and shows the differing lines', async () => {
    const a = await makeTextPdf(['Alpha one', 'Bravo two', 'Charlie three'])
    const b = await makeTextPdf(['Alpha one', 'Bravo two revised', 'Charlie three'])
    const result = await comparePdfs(buf(a), buf(b))
    expect(result.counts).toEqual({ same: 2, changed: 1, 'only-in-a': 0, 'only-in-b': 0 })
    const changed = result.pages.filter((p) => p.status === 'changed')
    expect(changed).toHaveLength(1)
    expect(changed[0].page).toBe(2)
    const removed = changed[0].diff!.filter((d) => d.kind === 'removed').map((d) => d.text)
    const added = changed[0].diff!.filter((d) => d.kind === 'added').map((d) => d.text)
    expect(removed).toEqual(['Bravo two'])
    expect(added).toEqual(['Bravo two revised'])

    const report = comparisonReport(result, 'a.pdf', 'b.pdf')
    expect(report).toContain('Text changed: 1')
    expect(report).toContain('  - Bravo two')
    expect(report).toContain('  + Bravo two revised')
  })

  it('reports extra pages on either side', async () => {
    const a = await makeTextPdf(['One', 'Two'])
    const b = await makeTextPdf(['One', 'Two', 'Three'])
    const result = await comparePdfs(buf(a), buf(b))
    expect(result.counts['only-in-b']).toBe(1)
    expect(result.pages[2].status).toBe('only-in-b')
  })

  it('says plainly when a file has no readable text', async () => {
    const blank = await makeTextPdf(['', ''])
    const text = await makeTextPdf(['Words here'])
    await expect(comparePdfs(buf(blank), buf(text))).rejects.toThrow('The first PDF has no readable text')
    await expect(comparePdfs(buf(text), buf(blank))).rejects.toThrow('The second PDF has no readable text')
  })
})
