# Wave 4b Report — PDF Tweaks Expansion (Playwright end-to-end suite)

Date: November 16, 2026
Scope: the Playwright e2e suite owed since the rebuild plan (roadmap §5, Ring 2 remainder after Wave 4a). Tests run against the production build served by `vite preview` — never the dev server — so the service worker, precache and lazy engine chunks behave as they do for a real visitor.
Result: **suite built and fully green in this environment: 8 of 8 specs passed, including the live-browser OCR verification Wave 2 could not do in Node. No app code was changed; the only fixes during the run were to test locators. Nothing deployed; no branding, CNAME or domain strings touched; no git commit.**

New dependency: `@playwright/test` 1.65.1 (devDependency). Chromium 159 (playwright chromium v1255, full + headless shell) installed via `npx playwright install chromium` and runs in this VM without extra system packages.

---

## A. Setup — `playwright.config.ts`

- `webServer` runs `npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` (600s timeout; reuses an already-running server outside CI). `baseURL` is `http://127.0.0.1:4173`. Entry point: `npm run test:e2e` (new script; `npx playwright test` also works since the config builds first).
- One Chromium project (Desktop Chrome), `workers: 1` for determinism, per-test timeout 90s (OCR overrides to 300s), traces and screenshots retained on failure, HTML report generated (`open: never`).
- **Service worker, handled deliberately:** the preview build registers the auto-update SW. Playwright's fresh browser context per test means SW state and caches never leak between specs; within a spec the SW stays **enabled on purpose** — production behaviour is the thing under test. No workaround was needed: downloads are `blob:` object URLs (`src/lib/files` `downloadBlob`), which the SW does not intercept, and SPA routing works through the SW's navigate fallback. This reasoning is written into the config header so a future maintainer does not "fix" it by disabling the SW.
- **Kept out of the unit suite by naming:** specs are `*.e2e.ts` and `testMatch` is pinned to that suffix, so Vitest's default glob (`**/*.{test,spec}.*`) never collects them — verified below (unit suite still exactly 42 files / 236 tests).

## B. Fixtures — `e2e/fixtures.ts` + `e2e/global-setup.ts`

Generated fresh on every run by the global setup; no binary fixtures are committed (`e2e/.fixtures/` is gitignored, along with `playwright-report/` and `test-results/`). The generator verifies itself before any spec starts (page counts, form field presence) so a broken fixture fails loudly at setup, not mysteriously mid-spec.

- `alpha.pdf` — 3 text pages ("Alpha page one/two/three"), page widths 500/520/540.
- `beta.pdf` — 2 text pages, widths 600/620. All widths across both files are distinct, so pdf-lib alone (page count + width sequence) proves which source pages ended up in a download, in which order — no text extraction needed in assertions.
- `form.pdf` — one page with a single pdf-lib text field, `fullName`.
- `scan.pdf` — one image-only page built exactly as the OCR unit tests build theirs: text ("ZEBRA CROSSING" / "handle with care") rendered to a PNG with @napi-rs/canvas (an existing pdfjs-dist optional dependency, already in the lockfile) and embedded full-page with pdf-lib. No text layer.

Helpers (`e2e/helpers.ts`): file-input upload, exact-name Step 3 runner, download capture to a temp dir, and pdf-lib inspectors (page count, page widths).

## C. Specs — per-spec results from the final full run (`npm run test:e2e`, 8 passed in 41.9s)

| # | Spec | What it proves | Result |
|---|---|---|---|
| 1 | `home.e2e.ts` | Home loads (H1), search "Merge" filters to the Merge PDF card, clicking it routes to `/tools/merge-pdf` with the workspace rendered | **Passed** (1.7s) |
| 2 | `merge.e2e.ts` | Both fixtures added (Step 2 reports "5 pages in total"), merge runs, downloaded `merged.pdf` has page widths [500, 520, 540, 600, 620] — all 5 pages, in order | **Passed** (1.9s) |
| 3 | `split.e2e.ts` | Hybrid split: typing "split after page 1" and applying shows "Here is what I understood", run produces `page-1.pdf` (width [500]) and `pages-2-3.pdf` (widths [520, 540]), each downloaded and verified | **Passed** (3.4s) |
| 4 | `password.e2e.ts` | Password set, `protected.pdf` downloaded, starts `%PDF-`, and **pdf-lib refuses to load it** (`/encrypt/i` error); control assertion: the source fixture loads fine | **Passed** (2.4s) |
| 5 | `batch.e2e.ts` | Rotate with both fixtures runs as a batch ("Batch results · 2 of 2 files processed", `alpha-rotated.pdf` + `beta-rotated.pdf` listed); "Download all as ZIP" yields `rotate-pdf-batch.zip` containing exactly those two PDFs, with 3 and 2 pages and every page rotated 90° | **Passed** (3.6s) |
| 6 | `ocr.e2e.ts` | **Live-browser OCR:** scan fixture uploaded, Text output chosen, real tesseract WASM + worker + `/tess-data` served from the built site; downloaded `scan.txt` contains "zebra" | **Passed** (6.1s) |
| 7 | `privacy.e2e.ts` | Request interception across a full merge run (load, upload, process, result): **zero requests left the origin** | **Passed** (2.4s) |
| 8 | `form.e2e.ts` (bonus, beyond the required list) | The generated form fixture in Fill form: field renders, typing "Ada Lovelace" enables the job ("1 field changed"), downloaded `filled-form.pdf` carries the value in the `fullName` field per pdf-lib | **Passed** (2.0s) |

### The OCR finding (the point of the wave)

OCR works end to end in a real browser against the production build — engine, worker script and language data all same-origin from `dist/`, recognition completing in ~6 seconds for the one-page scan. Wave 2's caveat ("verified through the Node path only") is now closed for the text-output path. (The searchable-PDF output path shares the same recogniser and was not separately re-verified here.)

### Failures during development — both test bugs, no app bugs

Two specs failed on first run; both were locator problems in the tests, fixed in the tests, with the app behaving correctly throughout (confirmed from Playwright's failure snapshots):

1. `form.e2e.ts` — `getByRole('button', { name: 'Fill form' })` substring-matched two buttons: the Dropzone (`role="button"`, aria-label "Add files for **Fill form**") and the real submit button. The snapshot showed the field loaded, the value typed and "1 field changed, ready to save" — the app was right. Fix: `runJob` now matches string labels with `exact: true`.
2. `ocr.e2e.ts` — `label` with text "Text file" matched two radio labels because the "Both" option's description also says "the text file". Fix: the spec now selects the radio by its `value="text"`.

No spec exposed an app bug, so no app behaviour was changed, per the wave rules.

## D. CI — `.github/workflows/ci.yml`

The existing `build` job (npm ci, build, unit tests) is **untouched**. A new `e2e` job runs alongside it: checkout, Node 24 with npm cache, `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e` (the config builds and serves the production build itself), and on failure uploads `playwright-report/` + `test-results/` as a 14-day artifact. The CI job itself was not executed here (no GitHub run); the identical command sequence was run locally end to end.

## E. Regression verification (final code)

- `npm run test:e2e` — **8 passed, 0 failed** (41.9s, 1 worker).
- `npm test` — **236 passed, 0 failed, 42 test files** — identical to Wave 4a; e2e files are not collected.
- `npm run build` — **pass** (`tsc -b` clean; sitemap 43 URLs / 41 tools; PWA precache 112 entries, 1,394.99 KiB; only the pre-existing page-numbers `INEFFECTIVE_DYNAMIC_IMPORT` warning).
- `npm run lint` — **0 warnings, 0 errors on 163 files** (was 151; +12 = playwright.config.ts and the 11 files under `e2e/`).

## Left unresolved / notes

- CI's e2e job is written but unverified on GitHub (nothing is pushed in this wave). First real CI run may surface runner-specific issues (browser system deps are handled by `--with-deps`; the build inside the webServer step takes ~30–60s of the job).
- The suite runs serially (1 worker, ~42s locally). Parallelising is safe for these specs (fresh contexts, distinct downloads) if CI time ever matters.
- Coverage is happy-path by design, per the brief: no error-path specs (corrupt file, wrong password on Remove password) and no visual/screenshot comparisons. The natural next additions, if wanted: Remove password round-trip against the password spec's output, and a Split content-search case ("pages that mention…").
