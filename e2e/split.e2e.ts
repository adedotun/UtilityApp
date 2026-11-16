import { expect, test } from '@playwright/test'
import { ALPHA } from './fixtures'
import { addFiles, downloadVia, pdfPageWidths, runJob } from './helpers'

test('split hybrid: a plain-words description produces the two expected files', async ({ page }) => {
  await page.goto('/tools/split-pdf')
  await addFiles(page, [ALPHA])

  await page.getByLabel('Describe your split').fill('split after page 1')
  await page.getByRole('button', { name: 'Apply description' }).click()
  await expect(page.getByText(/Here is what I understood/)).toBeVisible()

  await runJob(page, 'Split into 2 files')

  const firstRow = page.locator('li', { hasText: 'page-1.pdf' })
  const secondRow = page.locator('li', { hasText: 'pages-2-3.pdf' })
  await expect(firstRow).toBeVisible()
  await expect(secondRow).toBeVisible()

  const first = await downloadVia(page, () => firstRow.getByRole('button', { name: 'Download' }).click())
  expect(first.name).toBe('page-1.pdf')
  expect(await pdfPageWidths(first.path)).toEqual([500])

  const second = await downloadVia(page, () => secondRow.getByRole('button', { name: 'Download' }).click())
  expect(second.name).toBe('pages-2-3.pdf')
  expect(await pdfPageWidths(second.path)).toEqual([520, 540])
})
