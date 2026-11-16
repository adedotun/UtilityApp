import { expect, test } from '@playwright/test'
import { ALPHA, ALPHA_WIDTHS, BETA, BETA_WIDTHS } from './fixtures'
import { addFiles, downloadVia, pdfPageWidths, runJob } from './helpers'

test('merge combines two PDFs into one download with every page in order', async ({ page }) => {
  await page.goto('/tools/merge-pdf')
  await addFiles(page, [ALPHA, BETA])

  // Step 2 reports the combined document before anything runs.
  await expect(page.getByText('5 pages in total')).toBeVisible()

  await runJob(page, 'Merge 2 PDFs')

  const downloadButton = page.getByRole('button', { name: 'Download', exact: true })
  await expect(downloadButton).toBeVisible()
  await expect(page.getByText('2 PDFs merged into 5 pages')).toBeVisible()

  const { path, name } = await downloadVia(page, () => downloadButton.click())
  expect(name).toBe('merged.pdf')
  // Page count and order, proven by the fixtures' distinct page widths.
  expect(await pdfPageWidths(path)).toEqual([...ALPHA_WIDTHS, ...BETA_WIDTHS])
})
