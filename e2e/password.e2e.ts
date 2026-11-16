import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { ALPHA } from './fixtures'
import { addFiles, downloadVia, runJob } from './helpers'

const PASSWORD = 'e2e-test-password'

test('password protect encrypts the download so pdf-lib cannot open it', async ({ page }) => {
  await page.goto('/tools/password-protect')
  await addFiles(page, [ALPHA])

  await page.getByLabel('Password to open the file').fill(PASSWORD)
  await runJob(page, 'Protect PDF')

  const downloadButton = page.getByRole('button', { name: 'Download', exact: true })
  await expect(downloadButton).toBeVisible()
  await expect(page.getByText('Protected with 256-bit AES encryption')).toBeVisible()

  const { path, name } = await downloadVia(page, () => downloadButton.click())
  expect(name).toBe('protected.pdf')

  const bytes = readFileSync(path)
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  // The whole point of the tool: the result must refuse to open without the password.
  await expect(PDFDocument.load(bytes)).rejects.toThrow(/encrypt/i)
  // Control: the unprotected source opens fine.
  await expect(PDFDocument.load(readFileSync(ALPHA))).resolves.toBeTruthy()
})
