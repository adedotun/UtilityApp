# Wave 5 Report — PDF Tweaks Expansion (Images suite, roadmap §6.1)

Date: November 16, 2026
Scope: the first step beyond PDF — a new **Images** registry category with six image tools, all running on the same local canvas model as everything else. The category is placed after Convert on the home page.
Result: **all six tools built, tested and green. 47 tools in the registry (was 41), 263 unit tests (was 236), 8 of 8 e2e specs still passing. Nothing deployed; no branding, CNAME or domain strings touched; no git commit.**

New dependencies: `exifr` 7.1.3 and `heic2any` 0.0.4 (runtime, both lazy-loaded per tool and runtime-cached, never precached), `piexifjs` 1.0.6 (devDependency, used only by the EXIF tests to plant known metadata).

Shared groundwork: `src/features/tools/image/engine.ts` — a small canvas-engine interface (decode / createCanvas / encode) with a browser implementation (DOM canvas + `createImageBitmap`) and a Node implementation for tests (`node-engine.ts`, @napi-rs/canvas — the pattern the OCR tests already use). Every image process function takes the engine as a dependency, so all six tools are unit-tested against real encode/decode in Node. Test fixtures come from `image/test-images.ts` (deterministic textured images and the drawn-text OCR fixture recipe).

---

## Per tool

### 1. Convert Image (`convert-image`)
PNG / JPEG / WebP conversion through the canvas engine, multiple files via the shared batch mode (one output per input, ZIP download from the workspace). JPEG output paints a white background first, and the UI says transparent areas become white. Tests (4): format magic bytes and dimensions for PNG→JPEG, JPEG→PNG and JPEG→WebP, HEIC detection, undecodable bytes rejected.

**HEIC spike outcome — partial, gated, exactly as the brief allowed.** heic2any 0.0.4 bundles locally (chunk `heic2any-*.js`, 1,352 kB / 345 kB gzip, lazy and runtime-cached), but it is a browser-only UMD library: importing it in Node throws `window is not defined`, so no Node-side decode test is possible and no real HEIC fixture could be decoded in this environment. HEIC therefore ships behind the runtime path only: the decoder is imported only when a HEIC/HEIF file is added, it decodes to JPEG on the device and then flows through the tested conversion path, and any failure (library load, browser refusal, undecodable file) becomes an explicit per-file error naming the problem and the workaround — never a silent failure or a wrong output. The tool notice and the registry outcome both carry the "where your browser can decode them" caveat. **Not verified in a live browser in this wave** — see Unresolved.

### 2. Compress Image (`compress-image`)
Quality slider, optional maximum dimension, output format (keep / JPEG / WebP), batch mode with per-file before/after sizes in each result's summary. The Compress PDF honesty rule is applied literally — the same `enforceNotLarger` function is imported from compress-pdf: when re-encoding is not smaller, the original bytes are returned and the summary says the original was kept unchanged. Tests (4): textured PNG shrinks as JPEG, the 1×1 PNG returns the original flagged, the dimension cap produces exactly 400×300 from 800×600, format keeping and WebP output verified by magic bytes.

### 3. Resize Image (`resize-image`)
Percentage mode (slider) or pixel mode (width, height, or both), with an aspect lock that derives the missing side per file — including in batch, where each image keeps its own proportions. `targetSize` is a pure function with its own unit tests (6 across the file, including the invalid-spec errors). The step-2 panel shows the single added image's current dimensions, read locally with `createImageBitmap`. Output keeps the source format.

### 4. Photo Data (EXIF) (`exif-tools`) — the privacy flagship
Step 2 parses the added JPEG or PNG on the device (exifr, lazy chunk `full.esm-*.js`, 75 kB, runtime-cached) and lists what the photo reveals: camera make/model, lens, software, dates taken/created/modified, description/credits, GPS altitude, and GPS coordinates shown **as text only — no map is loaded and nothing is sent anywhere**, stated in the panel. PNG text chunks (tEXt/zTXt/iTXt) are read by a hand-written chunk parser in the process module, since editors hide data there too. A photo with no metadata says so plainly and step 3 stays disabled. Step 3 saves a scrubbed copy, re-encoded from the pixels through the canvas (stated plainly in the UI and the result summary), with a summary listing what was found and removed.
Tests (6) plant known values and assert them end to end: piexifjs writes Make "TestCam", Model "Spike 3000", Software "Unit Test Editor", DateTimeOriginal 2024-03-15 10:30:00 and GPS rationals for 51.5, −0.125 into a JPEG; the parser reports all of them (GPS to 6 decimal places); a hand-built PNG tEXt chunk ("Comment: Planted in a unit test", with a test-side CRC32) is found; and for both formats the scrubbed output **parses back with no metadata at all** while still decoding at the original dimensions. A non-photo file is rejected with a clear message.

### 5. Image to Text (`image-to-text`)
OCR for a single image, reusing the shared recogniser: the tesseract setup was refactored out of `ocr-pdf/process.ts` into `src/features/tools/ocr-engine.ts`, and ocr-pdf now re-exports it — its unit tests and the live-browser OCR e2e spec both still pass, so the refactor is behaviour-preserving. The tool saves a `.txt` download and also shows the recognised text in step 2 with a **Copy the text** button (clipboard, with a toast on success and an honest fallback message if the browser blocks copying). Empty recognition is an error with the reason, not an empty file. Tests (3): the empty and happy paths against a stub recogniser, plus a real local-tesseract run over the drawn-text fixture ("SECRET LEDGER") using the same recipe as the OCR PDF tests.

### 6. Watermark Image (`watermark-image`)
Text watermark drawn into the picture: centre / diagonal / top / bottom (mirroring the PDF watermark positions), opacity slider, text sized to the image width, re-encoded in the image's own format, batch mode with ZIP. The notice is honest about the limit: the mark is part of the image and cannot be peeled off, but cropping the marked area out is still possible. Tests (3): empty text rejected, a centre watermark measurably changes the centre pixel while keeping dimensions and PNG format, and diagonal/top/bottom all produce valid JPEGs.

## Registry and platform changes

- `ToolCategory` gains `'images'` (label "Images"); `CATEGORY_LABELS` and the home page's hardcoded `CATEGORIES` order updated — Images renders directly after Convert. Six lazy routes added in `ToolPage.tsx`. Sitemap regenerates from the registry: **49 URLs / 47 tools**.
- `registry.test.ts` updated: 47 tools, the six new slugs asserted, a new test pins the images category membership, and the batch-flag list gains `convert-image`, `compress-image`, `resize-image`, `watermark-image` (the four file-independent tools; EXIF and Image to Text are single-file by design).
- PWA: `heic2any-*.js` and the exifr chunk (`full.esm-*.js` — named after exifr's ESM build, which the first build caught being precached) are in `globIgnores` and get a CacheFirst runtime cache (`pdf-tweaks-images`), following the OCR/office pattern.

## Verification (final code)

- `npm test` — **263 passed, 0 failed, 48 test files** (was 236 / 42; +27 tests across the six new tools and the registry).
- `npm run build` — **pass** (`tsc -b` clean; sitemap 49 URLs / 47 tools; PWA precache **126 entries, 1,441.52 KiB** — was 112 / 1,394.99 KiB; the increase is the new tools' own small chunks; the only warning is the pre-existing page-numbers `INEFFECTIVE_DYNAMIC_IMPORT`).
- `npm run lint` — **0 warnings, 0 errors on 186 files** (was 163).
- `npm run test:e2e` — **8 passed, 0 failed** (42.1s), including the OCR live-browser spec against the refactored recogniser.
- Design audit on the new code: no `alert`/`prompt`/`confirm`, no italics, no CSS gradients, Phosphor icons only, sentence case throughout.

## Bundle impact

- Home (index) chunk: 500.70 kB (gzip 144.30 kB), up ~13.5 kB from the pre-wave build — the registry entries and six icons; no engine code.
- `heic2any-*.js`: 1,352 kB (gzip 345 kB) — lazy, only fetched when a HEIC file is converted; runtime-cached, not precached.
- `full.esm-*.js` (exifr): 75 kB — lazy to the EXIF tool; runtime-cached, not precached.
- The shared image engine chunk is small and precached with the app shell, like other shared code.

## Unresolved / notes

- **HEIC live-browser verification is still owed.** The decode path is wired, bundled and error-honest, and the post-decode conversion is fully tested, but no real HEIC file was decoded in a browser in this wave (Node cannot run the library at all). A natural follow-up is an e2e spec with a real HEIC fixture in Chromium, or a manual check with an iPhone photo after deploy.
- AVIF output is not offered: the brief fixed the output set at PNG/JPEG/WebP, and canvas AVIF encoding support is still inconsistent across browsers. AVIF *input* to Convert Image generally works where the browser can decode it (the tool accepts `image/*`), but it is not advertised.
- Photo Data accepts JPEG and PNG only — HEIC photos often carry the most EXIF, but parsing them would depend on the same browser-only HEIC decoder; left out rather than half-done.
- Image to Text is English-only, matching OCR PDF; the copy-to-clipboard button appears in step 2 after a run (the shared workspace's result panel is download-only, so the text and copy action live in the options panel, which stays visible).

---

## Wave 5 fix — EXIF dates showed in the viewer's timezone (November 16, 2026)

**Symptom.** `exif-tools/process.test.ts` > "reports the planted camera, software, date and GPS values" failed on machines outside UTC: the planted DateTimeOriginal `2024-03-15 10:30:00` was reported as `2024-03-15 16:30:00` under America/Regina (a 6-hour shift; a different shift, or none, in other zones), so the unit suite stood at 262/263 depending on where it ran.

**Root cause.** EXIF date/times are naive wall-clock strings with no timezone — they mean "the time the camera's clock showed". exifr's default parse revives them into JS `Date` objects, and its reviver builds the Date from the recorded components in **local** time (verified in exifr's bundled source: `new Date(year, month-1, day)` plus `setHours/setMinutes/setSeconds`). The tool then formatted that Date with `toISOString()`, which renders the **UTC** instant — shifting the displayed time by the viewer's UTC offset. The recorded time was never wrong in the file; only the formatting converted it.

**Fix (`src/features/tools/exif-tools/process.ts` only; the test assertion is unchanged).** Dates are now taken from the recorded string, with no Date object anywhere in the display path:

- `parsePhotoData` runs a second exifr parse of the same buffer with `reviveValues: false`, used only for the three displayed date fields (DateTimeOriginal, CreateDate, ModifyDate). Verified by probe: that parse returns them as the raw strings (`"2024:03:15 10:30:00"`), while GPS latitude/longitude and all other values are identical between the two parses — every non-date field still comes from the main parse, unchanged.
- A new `recordedDateText` normaliser turns the raw string into display form by changing only separators: EXIF `"2024:03:15 10:30:00"` → `"2024-03-15 10:30:00"`, XMP ISO `"2024-03-15T10:30:00"` likewise; anything else is shown as recorded.
- The revived Date survives only as a fallback if the raw parse lacks a field, and is then formatted from its **local** components — which provably reproduce the recorded string, since exifr constructed the Date from exactly those components. `toISOString()` is gone from the tool.

**Proof.** The exif test file passes 6/6 under `TZ=UTC`, `TZ=America/Regina` and `TZ=Asia/Tokyo`. Full suite: **263 passed, 0 failed, 48 test files**. `npm run build` passes; `npm run lint` reports 0 warnings / 0 errors on 186 files. No other tool, registry, branding or CNAME files touched; nothing deployed; no git commit.
