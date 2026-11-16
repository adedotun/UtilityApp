# Wave 7a Report — PDF Tweaks → FileTweaks rebrand (code only)

Date: November 16, 2026
Scope: the product rename approved by the user — **PDF Tweaks → FileTweaks**, canonical domain **pdftweaks.adedotun.dev → filetweaks.adedotun.dev**. Code and copy only: **nothing deployed, no git commit, no DNS change, no redirect repo created** (those are the separate Wave 7b steps). PDF tools are unchanged as tools; only the product identity around them moved.
Result: **59 tools, 327 unit tests, 8 of 8 e2e specs, build and lint all green on the renamed code.** Sitemap verified on the new domain: **61 URLs (home + privacy + 59 tools), all `https://filetweaks.adedotun.dev`, zero old-domain references.**

---

## What changed, per file/area

### Domain and crawl surface
- `public/CNAME` — now `filetweaks.adedotun.dev`. This is the file GitHub Pages reads at deploy time, so the custom-domain switch happens with the Wave 7b deploy, not before.
- `scripts/generate-sitemap.mjs` — the sitemap base constant changed to `https://filetweaks.adedotun.dev`. Regenerated `public/sitemap.xml` and `public/robots.txt` from it: 61 URLs, all on the new domain; the robots sitemap line points at the new domain.

### `index.html`
- `<title>` — "FileTweaks — free file tools that never upload your files".
- Meta description — rewritten to cover the real breadth: "FileTweaks is a free toolkit for PDFs, images, documents and other files that runs entirely in your browser…"
- Canonical link and `og:url` — `https://filetweaks.adedotun.dev/`.
- `og:title` — "FileTweaks — file tools that never upload your files"; `og:description` broadened the same way.
- JSON-LD — `name` FileTweaks, `url` on the new domain, description broadened across all four tool families, and `featureList` extended from the original 18 PDF-era entries to 36, adding the headline tools from the image, document and file suites (OCR PDF, PDF to Word, Redact PDF, Convert image, Photo data (EXIF), EPUB viewer, CSV to Excel, ZIP files, File hash, Generate/Read QR code, and others) using their exact registry names. Still honest: no ratings, no review counts, price 0 as before.

### PWA manifest (`vite.config.ts`, VitePWA manifest block)
- `name` — "FileTweaks — PDF, image, document and file tools"; `short_name` — "FileTweaks"; description broadened to match. Theme and background colours unchanged (`#4f46e5` / `#f8fafc`), icons unchanged. Verified in the built `dist/manifest.webmanifest`.

### App chrome and pages (`src`)
- `src/components/Layout.tsx` — header wordmark "FileTweaks"; footer line "FileTweaks runs entirely in your browser. Your files never leave your device."
- `src/features/home/PrivacyPage.tsx` — opening line now names FileTweaks; the rest of the page was already format-neutral and accurate.
- `src/features/shared/ToolWorkspace.tsx` — per-tool page title is now "`<tool name>` — FileTweaks".
- `src/features/tools/split-pdf/prompt.ts` — a code comment ("FileTweaks never uploads files"); not user-visible, updated so the sweep stays clean.

### Home page copy (`src/features/home/HomePage.tsx`)
- H1 — "PDF tools that never upload your files" → **"File tools that never upload your files"**. The privacy promise itself is word-for-word unchanged.
- Intro paragraph — "Merge, split, convert, sign, edit and compress PDFs and Word documents" → "…PDFs, images, documents and other files, entirely in your browser. No sign up, and nothing to install."
- No tool counts were hardcoded anywhere in the home copy before, so none were added.

### `e2e/home.e2e.ts`
- The home spec's H1 assertion updated to the new heading text ("File tools that never upload your files"). No other spec referenced the brand.

### `README.md`
- Title, opening line and live-target URL updated to FileTweaks / filetweaks.adedotun.dev.
- The status section was stale beyond the rename (it still claimed 18 tools, 50 tests and "not deployed"), so it was refreshed to the current reality: 59 tools, 327 unit tests plus the e2e suite, deployed via GitHub Pages at filetweaks.adedotun.dev, with a pointer to the WAVE reports.

---

## FAQ correctness pass (HomePage)

All six answers were checked against the current 59-tool product. Two needed changes:

1. **"Is redact safe for sensitive information?" — rewritten (was stale and wrong).** The old answer described only the draw-over behaviour ("Redact draws a solid box over the page. It does not remove the underlying text layer…") as the product's redaction story. That has not been the whole truth since Wave 2 shipped Redact PDF. The new answer: yes, with the Redact PDF tool — it rebuilds each marked page as an image with the boxes burned in as solid black, so the text underneath is removed entirely and cannot be selected, copied or recovered; the trade-off (a redacted page becomes an image and loses its whole text layer, including text outside the boxes) is stated; and Edit PDF's internal redact is explicitly distinguished as draw-over only, pointing users to Redact PDF for truly sensitive information. The wording mirrors both tools' own in-product notices.
2. **"Do I need an account or to pay?" — brand only.** "PDF Tweaks is free…" → "FileTweaks is free, with no sign up and no daily limits." The claim itself was and remains true.

Checked and left unchanged, because they are still accurate for all 59 tools: the uploads answer (no server in the design; closing the tab discards memory), the offline answer (app cached after first visit; large engines cached on first use — still exactly how the OCR/office/image/file chunks behave), the Word to PDF fidelity answer (the tool still keeps text and paragraph structure and still warns before converting), and the on-device storage answer (theme, favourites/recents, saved signatures only).

One roadmap note: §7 imagined "PDF Tweaks" surviving as the name of a PDF section. The built home page has no single PDF section — PDF tools are spread across Convert, Organise, Edit and sign, Optimise and Security alongside the newer categories — so there was no section label to preserve, and this wave did not restructure navigation for it (copy/identity change only, per the wave rules).

---

## Remaining "PDF Tweaks" / "pdftweaks" occurrences, with justification

User-visible occurrences: **none.** The domain string `pdftweaks` has **zero** occurrences left in `src`, `public`, `index.html`, `README.md`, `e2e`, `scripts`, `vite.config.ts`, `package.json`, `playwright.config.ts` and `.github`. What remains is internal or historical:

| Occurrence | Where | Why it stays |
|---|---|---|
| `pdf-tweaks-prefs`, `pdf-tweaks-theme` | `src/app/prefs.ts`, `src/app/theme.ts` (Zustand persist keys) | localStorage keys are invisible to users; renaming them would silently wipe every existing user's favourites, recents and theme choice. Deliberately unchanged. |
| `pdf-tweaks-signatures` | `src/features/tools/sign-pdf/Tool.tsx` | Same reason: it keys users' saved signatures in localStorage. |
| `pdf-tweaks-wasm`, `pdf-tweaks-office`, `pdf-tweaks-ocr`, `pdf-tweaks-images`, `pdf-tweaks-files` | `vite.config.ts` Workbox `runtimeCaching` | Cache Storage names are invisible to users. Renaming would orphan the old caches on users' devices and force re-downloads of the large engines for no benefit. Kept; the service worker builds and the e2e suite passes with them as-is. |
| `pdf-tweaks-ocr-assets` | `vite.config.ts` plugin `name` | Build-time plugin identifier; never shipped to the browser. |
| `"name": "pdf-tweaks"` | `package.json` | Internal npm package name (the project folder name); not rendered anywhere. |
| `pdf-tweaks-ocr-`, `pdf-tweaks-img-ocr-`, `pdf-tweaks-e2e-` | unit/e2e test temp-directory prefixes | Test-only filesystem scratch names. |
| "launched as PDF Tweaks and renamed to FileTweaks" | `README.md` | Deliberate historical note in the repo readme — accurate provenance, not branding. |
| "PDF Tweaks" throughout `FINAL_REPORT.md`, `PHASE*_REPORT.md`, `WAVE1–6B_REPORT.md` | project root | Historical records of the waves that built the product under its then-current name. Not user-visible, and rewriting them would falsify the record. Left untouched. |

---

## Verification (final code)

- `npm test` — **327 passed, 0 failed, 61 test files** (unchanged from Wave 6b; no test referenced the old brand).
- `npm run build` — **pass** (`tsc -b` clean; sitemap regenerated during the build: **61 URLs / 59 tools**; PWA precache **153 entries, 1,394.76 KiB** — identical count and size to Wave 6b, as expected for a copy-only change). Dist spot-checks: `dist/CNAME` is `filetweaks.adedotun.dev`; `dist/index.html` title is the new one with 4 FileTweaks mentions and 0 `pdftweaks`; `dist/sitemap.xml` has 61 new-domain URLs and 0 old-domain; `dist/manifest.webmanifest` carries the new name/short_name with theme colours unchanged.
- `npm run lint` — **0 warnings, 0 errors on 227 files**.
- `npm run test:e2e` — **8 passed, 0 failed** (44.4s), including the home spec asserting the new H1 and the privacy spec confirming no request leaves the origin.
- Design audit on the changed copy: no italics, no gradients, no alerts, sentence case, Phosphor icons untouched, no layout changes.

## Not done (by design — Wave 7b)

- No deploy and no git commit: the live site still serves as PDF Tweaks at pdftweaks.adedotun.dev until the renamed build is pushed.
- No DNS change (the filetweaks CNAME record was already added in an earlier step; it serves nothing until Pages switches).
- No redirect repo: pdftweaks.adedotun.dev → filetweaks.adedotun.dev path-for-path redirects are the remaining Wave 7 step, to land with the deploy so no saved link breaks.
