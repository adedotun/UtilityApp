# Wave 6a Report — PDF Tweaks Expansion (Documents suite, roadmap §6.2)

Date: November 16, 2026
Scope: a new **Documents** registry category — Word, Markdown, EPUB and spreadsheet tools, placed after Images on the home page. All seven planned tools built, including Merge Word (its spike passed). Everything runs locally; no network calls, no runtime CDNs.
Result: **54 tools in the registry (was 47), 302 unit tests (was 263), 8 of 8 e2e specs still passing, plus a throwaway 6-test browser verification of the new tools (all passed, spec removed after the run). Nothing deployed; no branding, CNAME, index.html or domain strings touched; no git commit.**

New dependencies: `turndown` 7.2.5 and `marked` 12.0.2 (runtime, lazy per tool), `docx-merger` 1.2.2 (runtime, lazy, Merge Word only), `@types/turndown` 5.0.6 (dev). A local declaration file (`src/types/docx-merger.d.ts`) covers docx-merger's missing types.

Shared groundwork:
- `src/features/tools/word/mammoth-input.ts` — Mammoth ships two builds with different input shapes (browser: `{arrayBuffer}`, Node/tests: `{buffer}`); this hands it whichever the runtime understands. Word to Markdown and Merge Word's read-back use it.
- `src/features/tools/word/process.ts` gained `renderBlocksToPdf` — a structured-block renderer (headings, paragraphs, lists, quotes, code, rules, with bold/italic/monospace runs) sharing `textToPdf`'s page geometry, fonts and character sanitising, so Markdown to PDF renders through the same pdf-lib core as Word to PDF rather than a second renderer.
- `src/features/tools/spreadsheet/csv.ts` — a real RFC 4180 CSV parser (quoted fields, embedded delimiters/quotes/newlines), delimiter detection (comma/semicolon/tab, quote-aware), the RFC 4180 writer, and the cleaning rules — shared by all three CSV tools.
- `src/lib/entities.ts` — the HTML entity decoder, shared by the Markdown and EPUB parsers.

One correction to the brief, found in the code: Word to PDF has no HTML→PDF rendering path — it converts via Mammoth raw text into `textToPdf`. Markdown to PDF therefore shares that module's rendering core (extended with `renderBlocksToPdf`) instead of an HTML renderer that does not exist.

---

## Per tool

### 1. Word to Markdown (`word-to-markdown`)
Mammoth converts the .docx to clean HTML (the View Word conversion), Turndown writes it out as Markdown (ATX headings, `-` bullets, fenced code). Step 3 offers two downloads for a single document — the `.md` and the intermediate `.html`, so nothing the conversion dropped is unrecoverable — and batch mode converts several documents to one `.md` each. The notice and registry outcome state the limits: tables come out as plain text rows, images are not carried across. Tests (2): a `docx`-package fixture (Heading 1, bold run, two bullets) converts with `# ` heading, `**bold**` and list items present in order; a non-Word file is rejected with a named error.

### 2. Markdown to PDF (`markdown-to-pdf`)
Marked parses to HTML; a hand-rolled, DOM-free scanner (`htmlToBlocks`) structures it into blocks — the same code runs in browser and tests — and `renderBlocksToPdf` lays it out as an A4 document with real heading sizes, list markers, quote bars and code panels. Input is a `.md`/`.txt` file **or** pasted text: step 2 is an editor holding the loaded file's text (editable before converting), and pasting with no file at all enables step 3 — the workspace's `canRun` closure reads the editor state, so file-less operation works inside the standard workspace. Tests (3): block structure (heading level, 3 list items, quote, code) from Marked's HTML; a PDF whose pdfjs-extracted text contains the heading, list items, quote and code line; empty input rejected. (The test carries the codebase's existing `Uint8Array.prototype.toHex` polyfill for PDF.js under Node.)

### 3. EPUB Viewer (`epub-viewer`)
JSZip plus hand-rolled parsing, no EPUB library: `META-INF/container.xml` → OPF manifest/spine → per-chapter XHTML stripped to readable text, in spine order. Chapter titles come from the NCX table of contents when present, else the chapter's own heading/title, else "Chapter N". UI mirrors View Word: chapter list beside a reading pane; step 3 saves the whole book as one text file. **DRM:** `META-INF/encryption.xml` is checked before anything is read — encrypted content files produce the plain-words refusal ("protected with DRM… a DRM-free copy will open normally"), never a cryptic failure. One deliberate refinement: books whose only encrypted entries are font files still open, because font obfuscation leaves the text fully readable — refusing them would be a false DRM claim. Tests (5): a minimal two-chapter EPUB built with JSZip in the test (manifest deliberately out of order) returns both chapters in spine order with NCX titles and entity-decoded text; the DRM fixture is refused with the exact message; the font-only fixture opens; path resolution and non-EPUB rejection covered.

### 4. CSV to Excel (`csv-to-excel`)
The shared parser reads the CSV; the delimiter is auto-detected with a manual override (comma/semicolon/tab). Step 2 previews the first 15 rows with the detected delimiter and row/column counts; SheetJS (already shipped for PDF to Excel) writes one `.xlsx` sheet. Tests (4, plus the 12 shared-parser tests): quoted fields with embedded commas and doubled quotes parse exactly; override beats detection; the workbook reads back with the known cell values intact.

### 5. Excel to CSV (`excel-to-csv`)
SheetJS reads `.xlsx`/`.xls`/`.csv`; step 2 shows a sheet picker when the workbook has several sheets, with a first-rows preview of the selected sheet. Output is written by the shared RFC 4180 writer — the same escaping PDF to Excel uses — not SheetJS's own CSV writer, so the two tools agree. The notice states formulas are saved as their results. Tests (5): sheet listing; a workbook fixture whose values contain a comma and a quote survives to CSV and parses back identically; the picker selects the second sheet; a broken file is refused by name. **Full round trip:** CSV → Excel → CSV preserves the known values exactly (asserted in the Excel to CSV tests). One finding: SheetJS legitimately reads plain text as CSV data, so the rejection test uses a truncated zip-signature file, which SheetJS truly cannot open.

### 6. Clean CSV (`clean-csv`)
Trim every cell, drop fully empty rows, remove exact duplicate rows after trimming (first occurrence kept) — rows only, no column operations. Step 2 analyses the file on add and shows the four counts (rows in, rows out, duplicates removed, empty dropped) plus a preview of the cleaned result before anything is downloaded; step 3 downloads exactly what was previewed, keeping the original delimiter. A file that is already tidy says so; a file whose rows are all empty is an error, not an empty download. Tests (4, plus each cleaning rule separately in the shared module's 12): the combined counts on a mixed fixture, delimiter preservation, the tidy-file no-op, empty-file rejection.

### 7. Merge Word (`merge-word`) — **spike PASSED, tool shipped**
Spike (run before building, per the brief): two documents built with the `docx` package (Heading 1, styled runs, bullet list each) were merged with docx-merger 1.2.2, and the result read back with Mammoth — **all text present, in document order, bullets and structure intact, valid .docx zip layout**. No corruption or style breakage on the fixtures, so the tool ships as specified; no substitute was needed. The merge is at the document.xml level (styles, numbering and media combined), each document starts on a new page, and the file list is reorderable. Inputs are pre-validated with JSZip so a bad file is named ("Document 2 could not be read…") instead of crashing inside the merger. The notice is honest about the one real limit: where two documents define the same style name differently, the combined style set decides. Tests (3): the spike scenario as a unit test (both texts in order via Mammoth read-back, `word/document.xml` present), the two-document minimum, and the named bad-input error.

## Registry and platform changes

- `ToolCategory` gains `'documents'` (label "Documents"); `CATEGORY_LABELS` and the home page's `CATEGORIES` order updated — Documents renders directly after Images. Seven lazy routes added in `ToolPage.tsx`. Sitemap regenerates from the registry: **56 URLs / 54 tools**.
- `registry.test.ts` updated: 54 tools, the seven new slugs asserted, a new test pins the documents category membership, and the batch-flag list gains `word-to-markdown` (the only new batch tool — the CSV tools and EPUB viewer are preview/interactive, and Merge Word is a merge, so per the existing convention none of them is batch-flagged).
- PWA: the two Word-engine chunks are both named `dist-*.js` after their packages' dist entries — the docx library (213.66 kB, pre-existing, used by PDF to Word) and the new docx-merger bundle (109.64 kB; docx-merger + its nested JSZip 2 + xmldom). Both are now in `globIgnores` and join SheetJS/pptxgenjs in the `pdf-tweaks-office` CacheFirst runtime cache, following the established large-single-tool-chunk pattern. This also corrects the docx chunk having been precached unnoticed in earlier waves. Marked (33.99 kB) and Turndown (10.79 kB) are small and precached with the tool chunks, like other small engines.

## Verification (final code)

- `npm test` — **302 passed, 0 failed, 56 test files** (was 263 / 48; +39: Word to Markdown 2, Markdown to PDF 3, EPUB 5, shared CSV 12, CSV to Excel 4, Excel to CSV 5, Clean CSV 4, Merge Word 3, registry +1 net).
- `npm run build` — **pass** (`tsc -b` clean; sitemap 56 URLs / 54 tools; PWA precache **143 entries, 1,332.42 KiB** — entries up from Wave 5's 126 on the new tools' small chunks, total size **down** from 1,441.52 KiB because the two Word-engine chunks moved to runtime caching; the only warning is the pre-existing page-numbers `INEFFECTIVE_DYNAMIC_IMPORT`).
- `npm run lint` — **0 warnings, 0 errors on 212 files** (was 186).
- `npm run test:e2e` — **8 passed, 0 failed** (43.0s), the kept suite unchanged.
- **Throwaway browser verification (run, then deleted):** a temporary 6-test Playwright spec exercised the new tools in real Chromium — Word to Markdown download content, **Merge Word end-to-end through docx-merger's browser (`blob`) save path with both documents in order**, Markdown to PDF from pasted text with no file, EPUB chapter navigation, Clean CSV counts, CSV to Excel download. **6 passed.** Unlike Wave 5's HEIC path, nothing in this wave is left browser-unverified.
- Design audit on the new code: no `alert`/`prompt`/`confirm`, no italic styling, no CSS gradients, Phosphor icons only, sentence case throughout. (One lint warning during development — a set-state-in-effect in the Markdown editor — was fixed by loading the file through the asynchronous `File.text()` path every other tool uses.)

## Bundle impact

- Home (index) chunk: 521.05 kB (gzip 147.95 kB), up ~20 kB raw / ~3.7 kB gzip from the pre-wave build — the seven registry entries and their icons; no engine code.
- `dist-*.js` (docx-merger bundle): 109.64 kB (gzip 34.39 kB) — lazy to Merge Word; runtime-cached, not precached.
- `dist-*.js` (docx library): 213.66 kB (gzip 63.37 kB) — pre-existing chunk, now runtime-cached instead of precached (see above).
- `marked.esm-*.js`: 33.99 kB (gzip 10.47 kB) — lazy to Markdown to PDF, precached.
- `turndown.browser.es-*.js`: 10.79 kB (gzip 4.14 kB) — lazy to Word to Markdown, precached.
- SheetJS was already a lazy, runtime-cached chunk; the three spreadsheet tools share it and the small shared CSV module.

## Unresolved / notes

- **Markdown tables** are flattened by the block parser into one line per row with cells separated by " | " — readable, but not a drawn table. The tool's notice says tables come out as plain lines. A drawn-table renderer is a possible later refinement, not a silent gap.
- **EPUB chapter titles** fall back to the chapter's own heading or title when a book has no NCX (common in EPUB 3 books that only ship a nav document); parsing the EPUB 3 nav document for titles was left out rather than half-done — titles still resolve from the chapters themselves.
- **Merge Word with tracked changes, comments or section-specific headers/footers** was not part of the spike fixtures; docx-merger combines bodies, styles, numbering and media, and unusual section furniture is the area most likely to simplify. The pre-validation and the check-the-result notice cover the honest-failure side; broadening the spike fixtures is the natural follow-up if users hit it.
- docx-merger is an old, lightly maintained package (nested JSZip 2). It is pinned, bundled locally and isolated behind one dynamic import in one tool, so replacing it later touches only `merge-word/process.ts`.
