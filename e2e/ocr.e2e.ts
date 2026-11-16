import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { SCAN, SCAN_WORD } from './fixtures'
import { addFiles, downloadVia, runJob } from './helpers'

/**
 * The live-browser OCR verification the Node test path could not give:
 * the real tesseract WASM engine, worker and language data, served from the
 * built site, reading a page that exists only as pixels.
 */
test('OCR reads the scanned page and returns its words as a text file', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/tools/ocr-pdf')
  await addFiles(page, [SCAN])

  // Ask for the plain text output so the recognised words can be asserted directly.
  // (Located by value: the "Both" label's description also mentions "the text file".)
  await page.locator('input[type="radio"][value="text"]').check()

  await runJob(page, 'Run OCR')

  const downloadButton = page.getByRole('button', { name: 'Download', exact: true })
  await expect(downloadButton).toBeVisible({ timeout: 240_000 })
  await expect(page.getByText(/Recognised text from 1 of 1 pages/)).toBeVisible()

  const { path, name } = await downloadVia(page, () => downloadButton.click())
  expect(name).toBe('scan.txt')
  const text = readFileSync(path, 'utf8')
  expect(text.toLowerCase()).toContain(SCAN_WORD.toLowerCase())
})
