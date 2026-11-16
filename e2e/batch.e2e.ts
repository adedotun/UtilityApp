import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { ALPHA, BETA } from './fixtures'
import { addFiles, downloadVia, runJob } from './helpers'

test('batch rotate processes both files and the ZIP download contains both results', async ({ page }) => {
  await page.goto('/tools/rotate-pdf')
  await addFiles(page, [ALPHA, BETA])

  await runJob(page, 'Rotate 2 PDFs')

  await expect(page.getByText('Batch results · 2 of 2 files processed')).toBeVisible()
  await expect(page.getByText('alpha-rotated.pdf')).toBeVisible()
  await expect(page.getByText('beta-rotated.pdf')).toBeVisible()

  const { path, name } = await downloadVia(page, () =>
    page.getByRole('button', { name: 'Download all as ZIP' }).click(),
  )
  expect(name).toBe('rotate-pdf-batch.zip')

  const zip = await JSZip.loadAsync(readFileSync(path))
  const entries = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name).sort()
  expect(entries).toEqual(['alpha-rotated.pdf', 'beta-rotated.pdf'])

  const expectedPages: Record<string, number> = { 'alpha-rotated.pdf': 3, 'beta-rotated.pdf': 2 }
  for (const entry of entries) {
    const data = await zip.files[entry].async('nodebuffer')
    const doc = await PDFDocument.load(data)
    expect(doc.getPageCount()).toBe(expectedPages[entry])
    // The batch applied the tool's default 90-degree rotation to every page.
    expect(doc.getPages().every((p) => p.getRotation().angle === 90)).toBe(true)
  }
})
