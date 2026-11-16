# Wave 3a Report — PDF Tweaks Expansion

Date: November 16, 2026
Scope: six Ring 1 tools from `PDF_Tweaks_Expansion_Roadmap.md` §4, built in `~/workspace/pdf-tweaks` following the existing per-tool pattern (folder with `process.ts`, `Tool.tsx`, `process.test.ts`; one registry entry; one lazy route in `ToolPage.tsx`).
Result: **all six tools built, no spikes failed, nothing left out. Catalogue is now 33 tools (was 27). Nothing deployed; no branding, CNAME, index.html or domain strings touched; no git commit (VM copy is not a repo).**

New dependencies, both bundled locally and lazy-loaded per tool route: `xlsx` (SheetJS) 0.18.5 and `pptxgenjs` 4.0.1.

---

## What was built

### 1. PDF to Excel — `pdf-to-excel`, Convert, icon FileXls
- `process.ts`: `rowsFromItems` clusters PDF.js text items into a table: rows group by baseline (the pdf-to-word rule); columns come from `columnBands`, which merges every cell's horizontal interval into column bands — intervals that overlap or nearly touch (≤ 8 pt) form one column, so a right-aligned number still lands under its wider header, and two items falling in one cell join with a space. `extractTables` walks every page; a PDF with no text layer is rejected with a pointer to the OCR tool. Output is CSV by hand (RFC 4180 escaping; every page's rows stacked in page order) or XLSX via SheetJS (one sheet per page that produced rows, named `Page N`).
- `Tool.tsx`: format select (XLSX / CSV) and a **live preview**: adding a file extracts its tables and renders the first table page as an HTML table (first 15 rows × 8 columns, with the truncation stated), so the user sees exactly what was detected before downloading. The notice states plainly that detection is positional and imperfect on complex layouts.
- SheetJS verdict: **it bundles cleanly as a lazy chunk** (`xlsx-*.js`, 423.63 kB / 141.18 kB gzip), so XLSX ships alongside CSV as the roadmap wanted. It is excluded from the PWA precache and runtime-cached on first use (see Bundle impact).
- Tests: 10 (row/column clustering on synthetic items, right-aligned value staying in its header's column, same-cell joining, CSV escaping and page stacking, plus the required fixture test: a pdf-lib PDF with a drawn 3×3 grid of known cell texts extracts those exact values into the right rows and columns, the CSV matches byte for byte, and the XLSX reads back through SheetJS with the same grid; no-text PDF rejected).

### 2. PDF to PowerPoint — `pdf-to-powerpoint`, Convert, icon FilePpt
- `process.ts`: `buildPptx(images)` takes rendered page images as data URLs plus their point sizes. The deck layout is defined from the first page's size, so a uniform document fills every slide exactly; `fitRect` fits any differently sized page inside, centred, aspect preserved, on a white slide. pptxgenjs loads on demand.
- `Tool.tsx`: renders pages with PDF.js on a canvas (the pdf-to-images approach) at a selectable 1x/2x/3x resolution, with per-page progress and cancel. The notice states plainly that slides are pictures of the pages and the text is not editable, and points anyone needing editable text at PDF to Word.
- Tests: 6 (data-URL encoding, fit geometry for exact and letterboxed pages, and the required structural test: a 3-image build unzips to exactly `ppt/slides/slide1..3.xml` with picture elements and media parts; the deck size in `presentation.xml` matches the first page's size in EMU; empty input rejected).

### 3. Insert Pages — `insert-pages`, Organise, icon FilePlus
- `process.ts`: `insertBlankPages(buffer, position, count)` and `insertPdfPages(buffer, sourceBuffer, position, pageList)` on pdf-lib `copyPages`. Position is start / end / after page N (validated against the document). Blank pages take the size of the page they follow (first page when inserting at the start), so the document keeps one page size. `parsePageList` accepts "1-3, 5" style lists (blank = every page) with plain-language errors.
- `Tool.tsx`: the main PDF uses the shared workspace; Step 2 offers blank pages (count) or pages from a second PDF — the second file is picked with a local file input inside the panel (read on-device like the main file, with its own type/read errors) plus an optional page list. Position controls include an after-page number input with inline range validation.
- Tests: 12 (position index mapping and rejection, page-list parsing, and order verification by the fixture's distinct page widths: blank inserted after page 1 appears at index 1 with the neighbour's width; a second PDF's pages land at the insertion point in sequence; listed-pages subset respected; non-PDF second file rejected).

### 4. Resize Pages — `resize-pages`, Organise, icon FrameCorners
- `process.ts`: `resizePdf(buffer, widthPt, heightPt)` embeds each page and draws it scaled to fit the target, centred, aspect preserved — never cropped or stretched. `PAGE_SIZES` holds A4 / Letter / Legal in points; `mmToPt` converts custom sizes. Targets outside 36–14400 pt per side are rejected with the range stated in millimetres.
- `Tool.tsx`: preset select (A4, Letter, Legal, Custom) with custom width/height inputs in mm and inline validation. Copy states the consequence up front: a page of a different shape gets even margins, and landscape pages are fitted inside the portrait target.
- Tests: 7 (fit-transform geometry, mm conversion matching the A4 constants, output page sizes equal the target for both a preset and a 100 × 150 mm custom size, the page text still extracts from the resized output via PDF to Text, out-of-range sizes and non-PDF input rejected).

### 5. Pages per Sheet (N-up) — `n-up`, Organise, icon GridFour
- `process.ts`: `nUpPdf(buffer, { perSheet, sheet, orientation, gapPt })` places 2, 4, 6 or 9 embedded pages per A4/Letter sheet. `gridFor` stacks 2 and 6 vertically on portrait sheets and runs them across on landscape; `cellRect` lays cells out in reading order inside a fixed half-inch margin with the chosen gap; each page is scaled to fit its cell and centred.
- `Tool.tsx`: selects for pages per sheet, sheet size, orientation and gap (Tight / Standard / Wide). Copy states pages run in reading order and the last sheet may have empty spaces.
- **Booklet: left out, deliberately.** Imposition reorders pages into printer's pairs (last with first, and so on, with duplex pairing) — that ordering logic does not fall out of the grid code, and a wrong imposition is worse than none. The tool copy says plainly that it does not reorder pages for booklet folding, so nothing is over-claimed. Booklet remains a candidate for a later wave as its own tool with its own ordering tests.
- Tests: 7 (grid shapes per orientation, cell geometry — first cell inside the margin, second cell one gap to the right — and the required count test: a 9-page fixture at 4-up on A4 yields exactly 3 sheets, each 595.28 × 841.89 pt; landscape swaps the sheet dimensions; a partial last sheet rounds up; an unsupported count is rejected).

### 6. Extract Images — `extract-images`, Convert, icon ImageSquare
- `process.ts`: `extractImages(buffer)` walks each page's PDF.js operator list; for `paintImageXObject` / `paintImageXObjectRepeat` it resolves the decoded image through `page.objs` (falling back to `commonObjs`), and takes inline-image data directly from the operator arguments. `pixelsToRgba` converts every PDF.js packing — RGBA (kind 3), RGB (kind 2), 1-bit grayscale (kind 1, bit-unpacked MSB-first), and unkinded data inferred from its length — and returns null when the data does not match the stated dimensions, so a bad image is counted as failed instead of written out corrupt. Identical image data (FNV-1a hash over kind, dimensions and bytes) is extracted once and counted as a duplicate.
- `Tool.tsx`: encodes each image to PNG on a canvas at its original pixel size (RGBA via `ImageData`; a PDF.js bitmap, if one is ever supplied, is drawn instead). One image downloads on its own; several arrive in one ZIP (reusing the PDF to Images zip helper). The summary reports extracted / found / duplicates skipped / failed left out. The notice states that a stored JPEG comes out as a PNG copy of the same picture, and that masked or tiled images may not extract cleanly.
- Tests: 9 (pixel conversion for all kinds including the 1-bit unpack order and the length-mismatch null; and the required fixture test: a PDF built with pdf-lib `embedPng` of a known 40 × 30 canvas PNG returns that image with matching dimensions and pixel-exact colours at the corner and inside a drawn block, a stored JPEG page extracts at 24 × 18, the same image drawn twice extracts once with one duplicate counted, and a text-only PDF is rejected with "No images were found").

### Registry and routing
- Six entries added to `src/features/tools/registry.ts` with sentence-case outcome strings; six lazy components added to `ToolPage.tsx`. Home, search and sitemap derive automatically — the build's sitemap step now reports **35 URLs (33 tools)**.
- `registry.test.ts` updated: catalogue count 27 → 33 and presence assertions for the six new slugs. All other integrity tests unchanged and passing.

---

## Verification (all run on the final code)

- `npm test` — **171 passed, 0 failed, 33 test files** (was 120 tests / 27 files; +51 new tests across the six tools).
- `npm run build` — **pass** (`tsc -b` clean; sitemap regenerated at 35 URLs; PWA precache 95 entries, 1,309.46 KiB). The only build warning is the pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` for page-numbers, which predates this wave; resize-pages initially added a second one via a static `PAGE_SIZES` import and was rewritten to import it dynamically, so the wave adds none.
- `npm run lint` — **0 warnings, 0 errors on 125 files** (an initial React hooks warning about synchronous setState in the Excel preview effect was fixed by keying the preview state to its buffer and deriving the loading state).
- Design gate spot-check on the six new tool folders: 0 matches for `alert(`/`prompt(`/`confirm(`, italics, background gradients, `rounded-full`; Phosphor icons only; sentence case throughout; empty, working, error and done states flow through the shared workspace, with the Excel preview and the Insert second-file picker handling their own loading and error states.
- **Bundle and PWA impact, verified in `dist/`:** SheetJS lands in its own lazy chunk (`xlsx-*.js`, 423.63 kB) and pptxgenjs in its own (`pptxgen.es-*.js`, 272.52 kB). Both are excluded from the service worker precache via `globIgnores` and covered by a CacheFirst runtime rule (cache name `pdf-tweaks-office`) — the same treatment Wave 2 gave the OCR assets. Precache grew only from 1,255.87 KiB (Wave 2) to 1,309.46 KiB, i.e. the six tools' own small chunks. The entry chunk (462.30 kB, from 440.84 kB after Wave 2) contains no SheetJS code (grep-verified); its growth is the six registry entries and icons.

## Left unresolved / notes for later waves

- **Booklet imposition** was not built (see the N-up section). It needs its own page-ordering logic and tests; the N-up tool copy does not claim it.
- **Extract Images and transparency:** PDF.js usually composites an image's mask into RGBA data, but an image whose mask does not composite comes out without its transparency. The count stays honest either way; the UI copy already frames output as a faithful picture copy, not a bit-for-bit file copy — the extracted file is a re-encoded PNG of the decoded pixels, which is also why stored JPEGs arrive as PNG.
- **Extract Images in the browser** was verified through the Node end-to-end test (the same engine code path and worker the browser uses, as with Waves 1–2); a live smoke check of /tools/extract-images after the next deploy is still worth doing, like the password-tools live check in the rebuild.
- **PDF to Excel** merges columns whose intervals nearly touch (≤ 8 pt) by design; densely set tables with very narrow gutters can merge two columns into one. The preview makes this visible before download, which is the roadmap's honesty standard for this tool.
- Playwright end-to-end tests remain outstanding from the rebuild plan (Ring 2), unchanged by this wave.
