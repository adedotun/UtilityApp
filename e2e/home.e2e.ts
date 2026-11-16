import { expect, test } from '@playwright/test'

test('home page loads, search finds Merge and navigates to the tool', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'File tools that never upload your files' }),
  ).toBeVisible()

  await page.getByPlaceholder(/Search tools/).fill('Merge')

  const card = page.getByRole('link', { name: /Merge PDF/ }).first()
  await expect(card).toBeVisible()
  await card.click()

  await expect(page).toHaveURL(/\/tools\/merge-pdf$/)
  await expect(page.getByRole('heading', { name: 'Merge PDF', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Step 1 · Add files' })).toBeVisible()
})
