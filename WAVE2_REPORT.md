# Wave 2 Report — PDF Tweaks Expansion

Date: November 16, 2026
Scope: four Ring 1 headline tools from `PDF_Tweaks_Expansion_Roadmap.md` §4 (Phase C), built in `~/workspace/pdf-tweaks` following the existing per-tool pattern (folder with `process.ts`, `Tool.tsx`, `process.test.ts`; one registry entry; one lazy route in `ToolPage.tsx`).
Result: **all four tools built, including OCR with the local-only spike passed. Catalogue is now 27 tools (was 23). Nothing deployed; no branding, CNAME, index.html or domain strings touched; no git commit (VM copy is not a repo).**

New dependencies, all bundled locally and lazy-loaded per tool route: `tesseract.js` 7.0.0, `tesseract.js-core` 7.0.0, `@tesseract.js-data/eng` 1.0.0, `docx` 9.15.4.

---

## What was built

### 1. OCR PDF — `ocr-pdf`, Convert, icon Scan — SPIKE PASSED, local-only

- **Spike result:** tesseract.js v7 runs fully offline in this codebase. Two findings shaped the build. (a) The worker loads its core and language data from **directory** paths (it appends the SIMD-variant filename itself), and its defaults point at jsDelivr — so a Vite plugin (`ocrAssetsPlugin` in `vite.config.ts`) serves `/tess-core` (the three LSTM core variants from `tesseract.js-core`) and `/tess-data` (`eng.traineddata.gz` from `@tesseract.js-data/eng`, the 4.0.0_best_int set, 2.9 MB) from `node_modules` in dev and copies them into `dist/` at build time. The worker script itself is a Vite `?url` asset. Every asset is same-origin; there are no runtime network calls to any third party. (b) PDF.js renders pages under Node using its optional `@napi-rs/canvas` dependency, with two small test-only polyfills (the `Uint8Array.prototype.toHex` one pdf-to-text already uses, plus `Map`/`WeakMap.getOrInsertComputed`) — so the OCR test is genuinely end-to-end.
- `process.ts`: `createRecognizer(options)` wraps `createWorker('eng', …)` with caller-supplied asset paths (never the CDN defaults) and returns positioned lines from the block tree. `ocrPdf(buffer, deps)` orchestrates injected `renderPage`/`recognize` functions (the compress tool's injection pattern): pages are rendered at 300 DPI, recognised, then rebuilt by `buildSearchablePdf` — each page is its image with the recognised lines drawn over it as invisible (opacity 0) text at the found position and size, sanitised through `toDrawableText` so Helvetica can encode it. Outputs: searchable PDF, recognised text (`.txt`, one section per page, reusing pdf-to-text's `assembleText`), or both. A PDF where nothing is recognised is rejected with an honest explanation, never an empty success.
- `Tool.tsx`: output-choice radio group (PDF / text / both), per-page progress (the workspace bar advances page by page, refined within a page by tesseract's own progress), a live "Reading page N of M" line, and copy stating the engine and English data load from this site (about 6 MB on first run, then cached). English only, per the wave scope.
- Tests: 4 (drawable-text mapping; block-tree line extraction; searchable-PDF layer extractable via pdf-to-text; **end-to-end**: a 2-page fixture whose pages are canvas-drawn text images is rendered by PDF.js, OCRed by the real local engine, and both the `.txt` result and the searchable PDF's extracted text contain the fixture's words).

### 2. PDF to Word — `pdf-to-word`, Convert, icon FileDoc

- `process.ts`: `linesFromItems` groups PDF.js text items into lines by baseline proximity, ordering left to right and joining with a space only across a real gap. `paragraphsFromLines` splits paragraphs on vertical gaps beyond ~2.2 line heights and assigns heading levels from font size relative to the most common (body) size (1.6x/1.3x/1.15x → Heading 1/2/3). `buildDocx` writes the `.docx` with the `docx` package (lazy chunk, 213.66 kB). A PDF with no text layer is rejected with a pointer to the OCR tool.
- `Tool.tsx`: carries the fidelity notice in the same plain-words form as Word to PDF ("the layout is reconstructed, not identical… columns, tables, images and exact positioning do not [carry across]"). Output is `<original name>.docx`; the summary reports pages and paragraph count.
- Tests: 8 (line grouping and ordering, junk-item filtering, heading detection, paragraph splitting, full extraction from a pdf-lib fixture, docx round-trip — the generated file is unzipped with JSZip and `word/document.xml` is asserted to contain the fixture's text in order with a Heading1 style — plus a no-text rejection).

### 3. Redact PDF — `redact-pdf`, Security, icon EyeSlash — true redaction

- `process.ts`: `burnRedactionBoxes(pixels, boxes)` blacks out page-fraction boxes in rendered RGBA pixels (flipping the bottom-left convention the Edit tool uses). `buildRedactedPdf(buffer, boxes, rendered)` rebuilds the document with pdf-lib: redacted pages are replaced by their burned-in JPEG renders at original page size; all other pages are copied across untouched, text layer intact. Validates non-empty boxes, page range, and that every marked page was rendered.
- `Tool.tsx`: reuses the Edit tool's canvas pattern (shared `PdfCanvas`, drag to draw, per-page boxes, undo/clear per page) with solid black boxes. The notice states the trade plainly before the user starts: redacted pages become images and lose their whole text layer, which is what makes the removal permanent — unlike Edit's draw-over redact, whose warning this tool is the answer to.
- Tests: 4 (pixel-exact burn geometry including the origin flip; box grouping; validation rejections; **the security test**: a fixture page reading "The secret code is 481516" is rendered with PDF.js on the Node canvas, burned, and rebuilt — text extraction of the result contains neither the code nor the sentence, nor any other text from that page, while the untouched second page still extracts in full).

### 4. Scrub PDF — `scrub-pdf`, Security, icon Broom

- `process.ts`: `detectScrubFindings` reads metadata (all six fields), attachment names (walking the EmbeddedFiles name tree, including nested Kids) and JavaScript (OpenAction / additional-actions containing a JavaScript action, named scripts in the JavaScript name tree) via pdf-lib, then merges PDF.js `getJSActions()`/`getAttachments()` as a second detector. Two findings from spiking are baked in:
  - **PDF.js v7's `getAttachments()` misses attachments in pdf-lib-written name trees** (verified against qpdf, which sees them) — hence the union of detectors rather than trusting either alone.
  - **pdf-lib stamps its own Creator/Producer into the info dict on load and save** unless loaded with `updateMetadata: false`. Without that flag, detection reports stamps that are not in the file and scrubbing re-stamps the output. Both the detection and the working load use it; this is also why the report can name the file's real values.
- `scrubPdf` deletes the six info-dict keys, the catalog XMP `/Metadata` stream, the EmbeddedFiles and JavaScript name trees (and `/Names` if emptied), `/AF`, and any JavaScript-bearing OpenAction/AA entries — then runs the result through the shipped qpdf engine (plain rewrite, exit 0/3 accepted, same as Repair) so unreferenced attachment streams are dropped from the bytes, not merely unlinked. If qpdf cannot rewrite a file, the pdf-lib result is returned; the catalogue removals stand either way.
- `Tool.tsx`: notice explains exactly what is removed; the result summary is the report — e.g. "Removed 9 items — Title metadata: "Secret Title"; …; Attachment: notes.txt; JavaScript that runs when the document opens". An already-clean file returns its content unchanged with "Nothing to remove" stated, following the Compress precedent rather than erroring.
- Tests: 3 (detection finds all six metadata fields, the attachment and the open-action script in a fixture built with pdf-lib's `attach` plus a low-level JavaScript OpenAction; the scrubbed output verifies clean on re-detection — metadata undefined with `updateMetadata: false`, no Names/OpenAction in the catalog — with the report naming the title value, the attachment and the script; a stamp-stripped clean fixture reports zero removals and keeps its pages).

### Registry and routing
- Four entries added to `registry.ts` with sentence-case outcome strings; four lazy components added to `ToolPage.tsx`. Home, search and sitemap derive automatically — the build's sitemap step now reports **29 URLs (27 tools)**.
- `registry.test.ts` updated: catalogue count 23 → 27 and presence assertions for the four new slugs.

---

## Verification (all run on the final code)

- `npm test` — **120 passed, 0 failed, 27 test files** (was 101 tests / 23 files after Wave 1; +19 new tests).
- `npm run build` — **pass** (`tsc -b` clean after fixing three test-file type issues and swapping the OCR icon: this Phosphor version has no `ScanText`, so `Scan` is used). Sitemap regenerated at 29 URLs. PWA precache 82 entries (1,255.87 KiB). The only build warning is the pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` for page-numbers.
- `npm run lint` — **0 warnings, 0 errors on 107 files**.
- Design gate spot-check on the four new tool folders: 0 real matches for `alert(`/`prompt(`/`confirm(`, italics, background gradients, `rounded-full` (the single grep hit is the scrub test's fixture payload string `app.alert("boo")` — the script being scrubbed, not a UI call). Phosphor icons only; sentence case; empty, working, error and done states flow through the shared workspace; OCR adds per-page progress.
- **Bundle and PWA impact, verified in `dist/`:** `dist/tess-core/` (3 LSTM variant pairs, 20 MB in dist; one pair, ~2.8 MB wasm, downloads per device) and `dist/tess-data/eng.traineddata.gz` (2.9 MB) are present; the generated service worker's precache manifest contains **no** tess-core, tess-data or worker.min entries (grep-verified), and both are covered by CacheFirst runtime rules under the `pdf-tweaks-ocr` cache, alongside the existing wasm rule. The tesseract library code sits only in the lazy OCR process chunk; the home/entry chunk (440.84 kB) contains no tesseract code (grep-verified) — its growth from the original 409 kB spans the Wave 1 and 2 registry/icon additions, not OCR. `docx` lands in its own 213.66 kB lazy chunk.

## Left unresolved / notes for later waves

- **Browser runtime of the OCR worker was verified by build, asset layout and the Node end-to-end test, not by a live browser run** (this VM has no browser pass in this wave). The worker script, core directory and data directory resolve exactly as tesseract v7's loader expects, and the same engine code ran in Node; a live smoke check of /tools/ocr-pdf after the next deploy is still worth doing, like the password-tools live check in the rebuild.
- The two Node-canvas test files (redact, OCR) import `@napi-rs/canvas`, which is present as pdfjs-dist's optional dependency in the lockfile. If a future dependency change drops it, those tests fail loudly at import rather than silently skipping.
- Scrub covers document-level JavaScript (open action, additional actions, named scripts) and catalogue attachments. Page-level annotation actions and `/AF` entries beyond the catalogue array are out of scope for this pass; the UI copy says "JavaScript set to run when the document opens or is used", which matches what is removed.
- OCR is English-only and LSTM-only by design this wave; extra languages are a data-path change (more `@tesseract.js-data/*` directories behind the same plugin), not a code change.
- Playwright end-to-end tests remain outstanding from the rebuild plan (Ring 2), unchanged by this wave.
