import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { FORM, FORM_FIELD } from './fixtures'
import { addFiles, downloadVia, runJob } from './helpers'

// Bonus spec beyond the required list: it puts the generated form fixture to
// work and covers the Fill form tool end to end.
test('fill form writes the typed value into the downloaded PDF', async ({ page }) => {
  await page.goto('/tools/fill-form')
  await addFiles(page, [FORM])

  const input = page.locator('label', { hasText: FORM_FIELD }).locator('input')
  await expect(input).toBeVisible()
  await input.fill('Ada Lovelace')

  await runJob(page, 'Fill form')

  const downloadButton = page.getByRole('button', { name: 'Download', exact: true })
  await expect(downloadButton).toBeVisible()

  const { path, name } = await downloadVia(page, () => downloadButton.click())
  expect(name).toBe('filled-form.pdf')

  const doc = await PDFDocument.load(readFileSync(path))
  expect(doc.getForm().getTextField(FORM_FIELD).getText()).toBe('Ada Lovelace')
})
