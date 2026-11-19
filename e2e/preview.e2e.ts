import { expect, test } from '@playwright/test'
import { ALPHA } from './fixtures'
import { addFiles } from './helpers'

/** The smallest valid PNG (1×1), fed to the file input as an in-memory file. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

test('an added PDF shows a rendered first-page thumbnail in the file list', async ({ page }) => {
  await page.goto('/tools/merge-pdf')
  await addFiles(page, [ALPHA])

  const thumb = page.locator('li', { hasText: 'alpha.pdf' }).locator('img')
  await expect(thumb).toBeVisible()
  // The thumbnail is a real rendered page, not a placeholder: it decoded.
  await expect.poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
})

test('an added image shows a thumbnail of the photo itself in the file list', async ({ page }) => {
  await page.goto('/tools/convert-image')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'dot.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  })

  const thumb = page.locator('li', { hasText: 'dot.png' }).locator('img')
  await expect(thumb).toBeVisible()
  await expect.poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1)
})
