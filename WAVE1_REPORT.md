# Wave 1 Report — PDF Tweaks Expansion

Date: November 16, 2026
Scope: five Ring 1 tools from `PDF_Tweaks_Expansion_Roadmap.md` §4, built in `~/workspace/pdf-tweaks` following the existing per-tool pattern (folder with `process.ts`, `Tool.tsx`, `process.test.ts`; one registry entry; one lazy route in `ToolPage.tsx`).
Result: **all five tools built and shipped in code. Catalogue is now 23 tools (was 18). Nothing deployed; no branding, CNAME, index.html or domain strings touched; no git commit (VM copy is not a repo).**

---

## What was built

### 1. Delete Pages — `delete-pages`, Organise, icon Trash
- `process.ts`: `deletePages(buffer, selected)` on pdf-lib, mirroring Extract Pages inverted. Validates: empty selection rejected; page outside the document rejected; **deleting every page rejected** with "A PDF has to keep at least one page". Kept pages are copied in original order.
- `Tool.tsx`: same thumbnail picker as Extract Pages. Selecting every page disables the run button and shows an inline alert in Step 2 explaining at least one page must be kept. Output `pages-deleted.pdf`, summary states pages deleted and kept.
- Tests: 5 (order preserved via fixture page widths, single survivor, empty selection, delete-all rejection, out-of-range rejection).

### 2. PDF to Text — `pdf-to-text`, Convert, icon FileTxt
- `process.ts`: `extractPdfText(buffer)` loads the file with PDF.js and walks every page's `getTextContent()`. `pageTextFromItems` joins items honouring `hasEOL`; `assembleText` emits one `--- Page N ---` section per page and marks pages with no text as "(no readable text on this page)" rather than leaving silent gaps. If **no** page has readable text it throws: "This PDF has no readable text. It may be made of scanned images, so there is no text layer to copy out." — no empty file is ever produced as a success.
- `Tool.tsx`: workspace notice states the scanned-file limitation up front. Output is `<original name>.txt` (text/plain), summary reports "Text copied from X of Y pages".
- Environment fix inside `process.ts`: under Vitest/Node the bundled PDF.js worker URL is a root-relative `/node_modules/...` path; `resolveWorkerForNode()` rewrites it to a `file://` URL against the cwd — the same fix pattern the qpdf loader already uses. Browser behaviour is untouched.
- Tests: 5 (item joining with EOL flags, non-text items ignored, section assembly with no-text marker, full extraction from a 3-page fixture, blank scanned-style PDF rejected). The test file polyfills `Uint8Array.prototype.toHex` for the Node runtime only (PDF.js 6 calls it; this VM's Node lacks it, current browsers have it).

### 3. Repair PDF — `repair-pdf`, Optimise, icon FirstAid
- `process.ts`: `repairPdf(buffer)` runs the already-shipped qpdf-WASM engine with a plain rewrite (`/in.pdf /out.pdf`). It uses its own module runner rather than `runQpdf` from the password tools, because repair must accept **qpdf exit code 3** (output written, warnings reported while fixing) as well as 0; the result carries `warnings: boolean`. Any other outcome throws an honest error (not a PDF / password protected / beyond structural repair).
- `Tool.tsx`: notice defines repair plainly — a clean structural rewrite that cannot bring back missing content. Deliberate exception: `canRun` does **not** require the workspace file to be error-free, because the workspace flags files pdf-lib cannot parse — exactly the files this tool exists for; the buffer is still present and qpdf gets its chance. Summary distinguishes a clean rewrite from one where qpdf reported warnings.
- Tests: 3 (valid PDF round-trips with same page count and `warnings: false`; a hand-built classic-xref PDF with stale offsets — a comment line inserted without updating the table — repairs into a loadable 1-page file; a PNG is rejected).
- Finding from spiking: this qpdf build returns exit code 2 with no output for a wrong `startxref` on xref-stream files (pdf-lib's own output format), so that damage class is **not** repairable by this engine and the tool's error message covers it honestly ("may be beyond a structural repair") rather than pretending otherwise.

### 4. Flatten PDF — `flatten-pdf`, Edit and sign, icon StackSimple
- `process.ts`: `flattenPdf(buffer)` uses pdf-lib `doc.getForm()`; if the field count is 0 it throws "This PDF has no form fields, so there is nothing to flatten. The file was not changed." Otherwise `form.flatten()` and save; returns `{ data, fieldCount }`.
- `Tool.tsx`: notice explains the consequence (values stay visible, fields stop being editable) before the user runs it. Output `flattened.pdf`, summary gives the flattened field count.
- Tests: 2 (a fixture form with a filled text field and a checked checkbox flattens to zero remaining fields with the page intact; a formless PDF gets the plain no-fields message).

### 5. Headers & Footers — `headers-footers`, Edit and sign, icon TextAa
- `process.ts`: modelled on Page Numbers. `expandPlaceholders(template, values)` replaces `{page}`, `{total}`, `{date}`, `{filename}` (all occurrences). `addHeaderFooter(buffer, options)` stamps every page with pdf-lib Helvetica at the chosen placement (header/footer), alignment (left/center/right), font size (validated 6–48) and opacity (validated 0.05–1), same margins and ink colour as Page Numbers.
- `Tool.tsx`: text input with a placeholder example, placement and alignment selects, font-size number input, opacity slider (watermark pattern), a written list of the four placeholders, and a page-1 preview with the expanded sample (page-numbers preview pattern). `{filename}` is the input file's base name; `{date}` is today's date in the visitor's locale, computed once per visit.
- Tests: 6 (all four placeholders, repeated placeholders, plain text untouched, stamping keeps page count and grows the file, header + right + 50% opacity variant, empty text rejected, out-of-range font size rejected).

### Registry and routing
- Five entries added to `src/features/tools/registry.ts` with sentence-case outcome strings; five lazy components added to `ToolPage.tsx`. Home, search and sitemap derive automatically — the build's sitemap step now reports **25 URLs (23 tools)**.
- `registry.test.ts` updated: catalogue count 18 → 23 and presence assertions for the five new slugs. All other integrity tests unchanged and passing.

---

## Verification (all run on the final code)

- `npm test` — **101 passed, 0 failed, 23 test files** (was 80 tests / 18 files; +21 new tests, all in the existing fixture style).
- `npm run build` — **pass** (`tsc -b` clean; sitemap regenerated at 25 URLs; PWA precache 72 entries). The only build warning is the pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` for page-numbers, which predates this wave; headers-footers was deliberately written to avoid adding a second one.
- `npm run lint` — **0 warnings, 0 errors on 95 files** (an initial React purity warning about calling `Date` during render in headers-footers was fixed by computing the date once in a state initializer).
- Design gate spot-check on the five new tool folders: 0 matches for `alert(`/`prompt(`/`confirm(`, italics, background gradients, `rounded-full`; Phosphor icons only; sentence case throughout; empty, working, error and done states all flow through the shared workspace.

## Left unresolved / notes for later waves

- Repair cannot fix every damage class with this qpdf build (see the startxref finding above). The tool is honest about that in its error copy; a future wave could add a pdf-lib-based salvage path (copy readable pages into a fresh document) as a second-chance fallback.
- PDF to Text output order is PDF.js reading order; multi-column layouts may interleave, as with every text-layer extractor. The roadmap's honesty standard is met by the per-page sections and no-text marking; column-aware reconstruction belongs with the PDF to Word wave if it is attempted.
- Flatten covers AcroForm fields via pdf-lib, per the task scope. Annotation flattening (the roadmap's "bake via renders" extension) was not attempted.
- Playwright end-to-end tests remain outstanding from the rebuild plan (Ring 2), unchanged by this wave.
