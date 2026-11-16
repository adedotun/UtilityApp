import { expect, test } from '@playwright/test'
import { ALPHA, BETA } from './fixtures'
import { addFiles, runJob } from './helpers'

/**
 * The product's core promise, pinned as a test: while a real job runs,
 * no request may leave the app's own origin. Fonts, engines and OCR assets
 * are all self-hosted, so a single external request fails this spec.
 */
test('no request leaves the origin during a merge run', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin
  const external: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return
    if (new URL(url).origin !== origin) external.push(url)
  })

  await page.goto('/tools/merge-pdf')
  await addFiles(page, [ALPHA, BETA])
  await runJob(page, 'Merge 2 PDFs')
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible()

  // Let anything lazy (analytics beacons, late fetches) have its chance to fire.
  await page.waitForTimeout(1_000)
  expect(external).toEqual([])
})
