# Wave 6b Report — PDF Tweaks Expansion (Files suite, roadmap §6.3)

Date: November 16, 2026
Scope: the last tool wave of the expansion — a new **Files** registry category (ZIP create and extract, file hashing, QR generate and read), placed after Documents on the home page. All five planned tools built. Everything runs locally; no network calls, no runtime CDNs.
Result: **59 tools in the registry (was 54), 327 unit tests (was 302), 8 of 8 e2e specs still passing, plus a throwaway 5-test browser verification of the new tools (all passed, spec removed after the run). Nothing deployed; no branding, CNAME, index.html or domain strings touched; no git commit.**

New dependencies: `qrcode` 1.5.4 and `jsqr` 1.4.0 (runtime, lazy per tool), `@types/qrcode` (dev; the qrcode package ships no types of its own, jsQR ships its own). JSZip was already a dependency and is shared by both archive tools.

Two small shared changes, both needed by the `*/*` tools:
- `src/lib/files.ts` — `validateFile` now treats the accept pattern `*/*` as accepting every type (the HTML accept semantics; previously the pattern silently rejected everything). The 200 MB limit and the empty-file refusal still apply to those tools.
- `src/features/shared/Dropzone.tsx` — when a tool accepts `*/*`, the helper line reads "Accepts any file type." instead of printing the pattern.

---

## Per tool

### 1. ZIP Files (`zip-files`)
Any files (multiple, accept `*/*`) packed into one `.zip` with JSZip, DEFLATE-compressed. Entries are stored flat — folder paths are stripped to the bare file name — and duplicate names get the batch engine's suffix convention (`report.txt`, `report-2.txt`, `report-3.txt`, case-insensitive comparison, original case preserved), implemented as `uniqueEntryName`/`flatName` in the process module and shared with Unzip. One input file downloads as `<name>.zip`; several download as `files.zip`, renameable in step 3 as usual. Tests (6): two known files re-open byte-equal through JSZip; the duplicate-name suffixing including a case-variant third copy; folder flattening; the empty-list refusal; the name helpers directly.

### 2. Unzip (`unzip-file`)
Viewer pattern, mirroring Photo Data (EXIF). Step 2 reads only the archive's directory — `listZipEntries` filters out folder entries and reports each file's path and uncompressed size without extracting anything — and lists them before the user commits. Step 3 extracts every file and offers each as its own download, flattened to its file name with the same suffix rule when two entries share one. An archive with no files says so plainly in step 2 and step 3 stays disabled; bytes that are not a ZIP get a named refusal, never a crash. One implementation note: JSZip does not publish entry sizes in its types, so the size is read defensively from the entry's internal data record (populated by the pinned JSZip 3.10 for every file entry; falls back to 0 if absent). Tests (6): the fixture (one root file, one in a subfolder) lists with exact sizes and extracts byte-equal under flattened names; same-name entries in different folders suffix correctly; the empty archive lists and extracts nothing; non-ZIP bytes are refused.

### 3. File Hash (`file-hash`)
Viewer pattern, mirroring Photo Data. On file add, step 2 computes SHA-256 and SHA-1 with WebCrypto (`crypto.subtle.digest`) and shows both in monospace panels with copy buttons (clipboard, toast on success, honest fallback message if the browser blocks copying). A compare field checks a pasted hash against both: normalisation ignores letter case, spaces and colons, and the verdict names which hash matched — or states plainly that neither did, with the likely reasons. Step 3 saves a small `.txt` report (file name, size, both hashes). The secure-context requirement is noted in the process module: `crypto.subtle` only exists in secure contexts, and the site is served over HTTPS (localhost while developing), so it is present wherever the tool can run. Tests (5): the published FIPS 180 vectors for "abc" (SHA-256 `ba7816bf…20015ad`, SHA-1 `a9993e36…cd0d89d`); a one-byte change changes both hashes; upper-case and space-padded pastes match; `findMatchingHash` identifies which hash a paste belongs to; the report text carries the file name and both hashes.

### 4. Generate QR Code (`qr-generate`)
Paste-only pattern, mirroring Markdown to PDF: step 2 is a text box (a `.txt` file from step 1 loads into it, editable) plus an image-size choice (256 / 512 / 1024). The code is built with the `qrcode` package's `create()` at error-correction level M, and — the design point — a single module grid (`qrModules`) drives both the live canvas preview and the saved PNG, which is rendered through the shared canvas image engine, so what the user sees is exactly what downloads. The preview updates as they type; empty text disables step 3 with a plain hint in the panel, and over-long text (past one code's capacity) produces a named error in both the preview area and step 3. Tests (4): the grid is square with a dark finder corner; empty and 5,000-character inputs are refused; generated PNGs decode back through jsQR to the exact payload, for a URL and for plain text.

### 5. Read QR Code (`qr-read`)
Image-to-Text pattern. The image (PNG / JPEG / WebP) is decoded through the shared Wave 5 image engine, drawn to a canvas at natural size, and jsQR reads the pixels — jsQR itself is dynamically imported inside the process function, so its chunk loads only when a read actually runs. A found code is shown in step 2 as text with a copy button; when the content is a single http(s) address it is also offered as an "Open the link" link, with a caution to read the address first. Step 3 saves the content as a `.txt`. No code in the image is a plain outcome, not a crash: step 3 reports "No QR code was found in this image. Try a clearer, closer or straighter picture of the code." Tests (3): a generated QR image decodes back to its payload with `isUrl` set; a plain-text payload decodes with `isUrl` unset; the textured non-QR fixture image returns null.

## Registry and platform changes

- `ToolCategory` gains `'files'` (label "Files"); `CATEGORY_LABELS` and the home page's `CATEGORIES` order updated — Files renders directly after Documents. Five lazy routes added in `ToolPage.tsx`. Sitemap regenerates from the registry: **61 URLs / 59 tools**.
- `registry.test.ts` updated: 59 tools, the five new slugs asserted, a new test pins the files category membership. The batch-flag list is unchanged — none of the five is a batch tool (ZIP Files is a merge, Unzip and File Hash are viewers, the QR tools are single-purpose), matching the convention from earlier waves.
- PWA: the jsQR chunk (`jsQR-*.js`, 129.99 kB) was initially precached; it is now in `globIgnores` with a CacheFirst runtime cache (`pdf-tweaks-files`), following the established large-single-tool-chunk pattern (OCR, office, images). The `qrcode` package lands inside the Generate QR Code tool chunk (27.55 kB including the tool itself) — small, lazy per route, and precached like Marked and Turndown.

## Verification (final code)

- `npm test` — **327 passed, 0 failed, 61 test files** (was 302 / 56; +25: ZIP Files 6, Unzip 6, File Hash 5, QR Generate 4, QR Read 3, registry +1).
- `npm run build` — **pass** (`tsc -b` clean; sitemap 61 URLs / 59 tools; PWA precache **153 entries, 1,393.91 KiB** — entries up 10 on the new tools' small chunks, size up ~61 KiB from Wave 6a's 1,332.42 KiB, with jsQR's 130 kB held out of precache; the only warning is the pre-existing page-numbers `INEFFECTIVE_DYNAMIC_IMPORT`).
- `npm run lint` — **0 warnings, 0 errors on 227 files** (was 212).
- `npm run test:e2e` — **8 passed, 0 failed** (42.3s), the kept suite unchanged.
- **Throwaway browser verification (run, then deleted):** a temporary 5-test Playwright spec exercised all five tools in real Chromium against the production build — ZIP download re-opened and byte-checked; Unzip listing and per-file download; File Hash's browser-computed SHA-256 matching the known value, with an upper-case paste reported as a match; Generate QR Code's downloaded PNG decoded back to the payload with jsQR in Node; and that same PNG uploaded to Read QR Code and read back in the browser, link shown. **5 passed.** Nothing in this wave is left browser-unverified — including the qrcode package's browser build of `create()` and WebCrypto under the site's own serving conditions.
- Design audit on the new code: no `alert`/`prompt`/`confirm`, no italic styling, no CSS gradients, Phosphor icons only, sentence case throughout.

## Bundle impact

- Home (index) chunk: 541.30 kB (gzip 152.87 kB), up ~20 kB raw / ~4.9 kB gzip from the Wave 6a build — the five registry entries and their icons; no engine code.
- `jsQR-*.js`: 129.99 kB (gzip ~47.7 kB) — lazy to Read QR Code, runtime-cached, not precached.
- Generate QR Code tool chunk (incl. the `qrcode` package): 27.55 kB (gzip 10.53 kB) — lazy per route, precached.
- JSZip (95.93 kB) was already a shared lazy chunk; both archive tools and the batch ZIP download use it, so the archive tools add no new engine weight.

## Unresolved / notes

- **Workspace PDF note quirk:** the shared workspace probes any added file with a `.pdf` name or PDF type for its page count, whatever the tool. Adding a damaged PDF to ZIP Files or File Hash can therefore show a "could not be read as a PDF" note in the file list even though both tools work on the raw bytes regardless (their run conditions deliberately key on the buffer, not the error flag, so the file still processes). Fixing it properly means teaching the workspace that the probe is tool-dependent — a platform change left for a later wave rather than hacked around here.
- **Unzip sizes** depend on JSZip's internal entry record (see the tool notes above). If a future JSZip major removes it, sizes would fall back to 0 and show as "0 B" in the listing — extraction does not depend on it. Pinned at 3.10.2 today.
- **QR reading at very large photo sizes** decodes at natural resolution, which is the most reliable for small codes in big photos but can take a moment on multi-megapixel images; the step 3 progress state covers the wait. No downscaling was added, deliberately — shrinking is the classic way to make a real code unreadable.
- **ZIP Files stores entries flat by design** (stated in the tool's notice). Recreating a folder tree from a multi-file add is not possible in any case, since the browser's file picker hands over files, not folders.
