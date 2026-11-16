import { expect, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const downloadDir = mkdtempSync(join(tmpdir(), 'pdf-tweaks-e2e-'))

/** Feeds files to the tool page's (single, hidden) file input — the Dropzone's browse path. */
export async function addFiles(page: Page, paths: string[]): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(paths)
}

/**
 * Clicks the Step 3 primary action button (its label names the outcome, e.g. "Merge 2 PDFs").
 * String labels match exactly: the Dropzone is also a role=button whose name
 * ("Add files for Fill form") would otherwise substring-match labels like "Fill form".
 */
export async function runJob(page: Page, label: string | RegExp): Promise<void> {
  const button = typeof label === 'string'
    ? page.getByRole('button', { name: label, exact: true })
    : page.getByRole('button', { name: label })
  await expect(button).toBeEnabled()
  await button.click()
}

/**
 * Clicks a button and captures the browser download it triggers, saving it
 * under downloads/ for inspection. Returns the saved path and suggested name.
 */
export async function downloadVia(page: Page, click: () => Promise<void>): Promise<{ path: string; name: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), click()])
  const name = download.suggestedFilename()
  const path = join(downloadDir, `${Date.now()}-${name}`)
  await download.saveAs(path)
  return { path, name }
}

/** Loads a saved file as a PDF and returns its page widths, rounded — the fixture identity check. */
export async function pdfPageWidths(path: string): Promise<number[]> {
  const doc = await PDFDocument.load(readFileSync(path))
  return doc.getPages().map((p) => Math.round(p.getSize().width))
}

export async function pdfPageCount(path: string): Promise<number> {
  const doc = await PDFDocument.load(readFileSync(path))
  return doc.getPageCount()
}
