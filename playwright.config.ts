import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the PRODUCTION build served by `vite preview`,
 * never the dev server, so the service worker, precache and lazy engine
 * chunks behave exactly as they do for a real visitor.
 *
 * Service worker note: vite-plugin-pwa registers an auto-updating SW in the
 * preview build. Playwright gives every test a fresh browser context, so SW
 * registrations and caches never leak between tests; within one test the SW
 * is left enabled on purpose — production behaviour is the thing under test.
 * Downloads are blob: object URLs (see src/lib/files downloadBlob), which the
 * SW does not intercept, so no workaround is needed. If a future test needs a
 * pristine first-load, it should open its own context rather than disabling
 * the SW in the app.
 *
 * Entry point is `npm run test:e2e`. Running `npx playwright test` directly
 * also works: the webServer below builds first, then serves.
 *
 * Specs are named *.e2e.ts and testMatch is pinned to that suffix so Vitest's
 * default unit-test glob (**\/*.{test,spec}.*) never picks them up, and the
 * unit suite never picks up Playwright files.
 */
const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
})
