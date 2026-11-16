import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { repairPdf } from './process'
import { PNG_1X1, buf, makePdf } from '../test-fixtures'

/**
 * Builds a minimal one-page PDF with a classic cross-reference table.
 * With insertComment set, a stray comment line is inserted before the first
 * object without updating the table, leaving every xref offset stale — the
 * classic structural damage a rewrite repairs.
 */
function buildClassicPdf(insertComment = false): Uint8Array {
  const content = 'BT /F1 18 Tf 40 520 Td (Hello page) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const comment = '% a stray comment line inserted by a broken tool\n'
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    if (i === 0 && insertComment) pdf += comment
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefAt = pdf.length
  pdf += 'xref\n0 6\n0000000000 65535 f \n'
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0))
}

describe('repairPdf', () => {
  it('rewrites a valid PDF into a loadable file with the same pages', async () => {
    const src = await makePdf(3)
    const result = await repairPdf(buf(src))
    const doc = await PDFDocument.load(result.data.slice())
    expect(doc.getPageCount()).toBe(3)
    expect(result.warnings).toBe(false)
  })
  it('repairs a PDF whose cross-reference offsets are stale', async () => {
    const damaged = buildClassicPdf(true)
    const result = await repairPdf(buf(damaged))
    const doc = await PDFDocument.load(result.data.slice())
    expect(doc.getPageCount()).toBe(1)
    expect(typeof result.warnings).toBe('boolean')
  })
  it('rejects a file that is not a PDF', async () => {
    await expect(repairPdf(buf(PNG_1X1))).rejects.toThrow('could not be rewritten')
  })
})
