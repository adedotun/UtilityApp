# Wave 4a Report — PDF Tweaks Expansion (Ring 2: batch mode and workflows)

Date: November 16, 2026
Scope: roadmap §5, the platform wave — batch mode for single-file tools, and the two workflow presets (Prepare to Share, Prepare to Archive) chaining existing process functions. Built in `~/workspace/pdf-tweaks` on the existing shared workspace (ToolWorkspace / useWorkspace) and per-tool pattern.
Result: **everything in scope built, nothing left out. Catalogue is now 41 tools (was 39); 11 tools have batch mode. Nothing deployed; no branding, CNAME, index.html or domain strings touched; no git commit.**

New dependencies: **none.** Batch ZIP uses JSZip, which already shipped (loaded lazily, only when a ZIP is requested). The workflows import the existing Scrub, Compress, OCR and Flatten process functions — no engine logic was copied.

---

## A. Batch mode

### The shared layer — `src/features/shared/batch.ts`
- `runBatch(inputs, processOne, options)` is the engine: it takes a `(buffer, sourceName) => Promise<{blob, filename, note?}>` process and walks the inputs in order, collecting successes and failures separately. A file that throws becomes a failure entry carrying its message; the batch continues. Aborting the supplied signal stops the run with the same `Cancelled` behaviour as single-file jobs.
- `deriveOutputName(sourceName, outputName, used)` names every output from its source: `invoice.pdf` through Rotate becomes `invoice-rotated.pdf`. A canonical name that already starts with the source base name (PDF to text produces `invoice.txt`) is kept. Reused names get `-2`, `-3` suffixes, so adding the same file twice never overwrites a result.
- `zipBatchResults(successes)` packs exactly the successful outputs into one ZIP under their derived names, via a dynamic `import('jszip')` so JSZip stays out of every chunk until a ZIP is actually requested (it remains its own 95.9 kB lazy chunk in `dist/`).

### Workspace integration
- `useWorkspace` gained `batchItems` (per-file state: waiting / working / done with its output / error with its reason) and `runBatch(fn)`, which drives the engine with the workspace's files, maps the single-file `ProcessOutput` shape onto the engine's (`summary` becomes the per-file note), folds within-file progress into overall progress, and toasts honestly at the end: full success, partial success ("N of M files processed"), or none ("None of the files could be processed"). A file that could not even be read fails with its load error; a file with a buffer is always attempted, so Repair batch still gets its chance at damaged files.
- `ToolWorkspace` gained one optional prop, `batchProcess` (process one file with the current options). When a tool supplies it **and** more than one file is added, the Step 3 button runs the batch; with exactly one file the original `onProcess` path runs untouched — same code, same result panel, same rename-and-download UI. The batch results block lists each file with its state while working, then each output with its note and its own Download button, failures with their reason in the alert style, and a "Download all as ZIP" button (FileZip icon) when at least two files succeeded, plus "Process another".
- Registry: `ToolDef` gained `batch?: boolean`. The 11 in-scope tools are flagged `batch: true` and switched to `multiple: true`; a new registry test asserts the flagged set is exactly those 11 and that every flagged tool is `multiple`. Every other tool is unchanged and stays single-file.

### The 11 tools wired — all of them, none left out
compress-pdf, grayscale-pdf, rotate-pdf, watermark, page-numbers, headers-footers, flatten-pdf, scrub-pdf, repair-pdf, pdf-to-text, pdf-to-word.

In each `Tool.tsx` the existing `onProcess` body was extracted verbatim into a `processOne(file, …)` adapter (same process functions, same summaries); `onProcess` now delegates for one file and `batchProcess` is that adapter. Options are captured from component state, so the batch applies exactly what Step 2 shows. Per-tool batch notes:
- **Rotate:** page selection is per-file and interactive, so batch always rotates all pages. With several files added, "Selected pages only" cannot run (canRun blocks it) and Step 2 says why, offering All pages for the batch; the thumbnail picker only appears for a single file.
- **Compress / Grayscale:** the canvas render loop moved into the adapter unchanged; the hook folds each file's page progress into the batch progress bar. Compress's Step 2 copy now reports the file count and total size in batch instead of the first file's size.
- **Watermark:** the same text or logo applies to every file (the logo is converted per file inside the adapter, as before); the page-1 preview is single-file only, replaced by a line saying the watermark applies to every file.
- **Page numbers:** numbering restarts at the chosen start in each file and any "of total" uses that file's own page count; Step 2 says so in batch, and the preview is single-file only.
- **Headers and footers:** placeholders are filled per file, so `{filename}` and `{total}` use each file's own name and count; Step 2 says so in batch, preview single-file only.
- **Flatten:** a file with no form fields becomes a per-file failure carrying Flatten's own honest message ("nothing to flatten"), while the rest of the batch still processes.
- **Scrub:** each file's note is its own removal report (or "nothing to remove").
- **Repair:** canRun was deliberately kept buffer-only (no load-error check), matching its single-file behaviour — damaged files are its purpose.
- **PDF to text / PDF to Word:** output names already derive from the source, and the derivation keeps them (`invoice.txt`, `invoice.docx`).

### Batch tests — `src/features/shared/batch.test.ts`, 9 tests
- Name derivation: prefixing, already-derived names kept, `-2`/`-3` collision suffixes.
- The required mixed run, using the real `rotatePdf` behind the adapter shape: good PDF, corrupt bytes, good PDF → exactly two successes (`first-rotated.pdf`, `second-rotated.pdf`, verified as real rotated PDFs) and one failure naming `broken.pdf`, with progress reported after each file.
- Same file twice → two distinct output names. All-fail batch completes with two failures and no successes. Aborted signal rejects as cancelled.
- ZIP: the archive of the mixed run contains exactly the two successes under their derived names; an empty success list zips to an empty archive.

---

## B. Workflow presets (category Optimise, phase 5, lazy routes added)

Both are single-file tools whose `process.ts` **imports** the engines it chains. Both report per-step progress (a live step line in Step 2, following the OCR tool's pattern, with the progress bar mapped across the chain) and per-step outcomes in the Step 3 summary. A step that throws stops the chain with an error naming the step ("Step 1 of 2, scrub, could not be completed: … No file was produced, so nothing half-finished is presented as the result.").

### 1. Prepare to Share — `prepare-to-share`, icon ShareNetwork
- Chains `scrubPdf` → `compressPdf`, both imported. The candidate Compress prefers is built by the tool page exactly as the Compress page builds it (PDF.js page renders at the chosen level's DPI from `LEVEL_DPI`), except it renders the **scrubbed** bytes — a test asserts the candidate builder receives a file whose title is already gone. If rendering fails, the chain falls back to Compress's structural resave, as the Compress tool itself does.
- Step 2 offers the same three compression levels with the same descriptions as Compress.
- The summary reports both steps in their own words: what scrubbing removed (the Scrub tool's report verbatim) or that nothing was found and the chain carried on; then compression's before/after sizes against the scrubbed size (or that the scrubbed file could not be made smaller and is the result), plus the starting size.
- Tests: 4 (both steps run in order and the report lists the removed Title/Author; the final file parses with the metadata actually gone; an already-scrubbed file completes with `removed` empty; corrupt input fails naming step 1).

### 2. Prepare to Archive — `prepare-to-archive`, icon Archive
- Step 1 is OCR narrowed for archiving: `pagesLackingText` reads every page's text layer with PDF.js (reusing `pageTextFromItems` from PDF to text). Only pages with no text are rendered and recognised (the tool page builds the recogniser and renderer exactly as the OCR page does, same local `/tess-core` and `/tess-data` assets), and the recognised lines are drawn onto the **original** pages as invisible text using the OCR module's `toDrawableText` and the same positioning maths as its searchable output — pages that already had text are never rebuilt as images. If every page already has text, OCR is skipped and the summary says so. If pages needed OCR and none yielded a single word, step 1 fails honestly rather than archiving a silently still-unsearchable file.
- Step 2 imports `flattenPdf`: the workflow counts fields first (Flatten throws when there are none, which for a chain is a normal outcome, not a failure) and only calls it when fields exist; the summary reports the flattened count or that there was nothing to flatten.
- Tests: 6 (page detection finds exactly the blank page of a mixed fixture; only that page is rendered/recognised, its words become extractable, and the text page's words survive; an all-text document skips OCR with the recogniser never called; a form fixture flattens with the count reported and zero fields remaining; a recogniser failure and a no-words result both fail naming step 1).

### Registry and routing
- Two entries added with sentence-case outcome strings; two lazy components added to `ToolPage.tsx`. Home, search and sitemap derive automatically — the build's sitemap step now reports **43 URLs (41 tools)**.
- `registry.test.ts` updated: catalogue count 39 → 41, presence assertions for both workflow slugs, and the batch-flag integrity test described above.

---

## Verification (all run on the final code)

- `npm test` — **236 passed, 0 failed, 42 test files** (was 216 / 39; +20 new tests: 9 batch, 4 share, 6 archive, 1 registry).
- `npm run build` — **pass** (`tsc -b` clean; sitemap regenerated at 43 URLs; PWA precache 112 entries, 1,394.96 KiB). The only build warning is the pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` for page-numbers (its page statically imports `formatPageNumber` from the module it also lazy-loads — unchanged by this wave, which only added a dynamic import of the same module there); the wave adds no new warnings.
- `npm run lint` — **0 warnings, 0 errors on 151 files** (was 143).
- Design gate spot-check on the new/changed files: 0 matches for `alert(`/`prompt(`/`confirm(`, italics, background gradients; Phosphor icons only (FileZip, ShareNetwork, Archive); sentence case throughout; waiting, working, per-file error, partial-success, all-failed, done and ZIP-building states are all rendered.
- **Bundle impact, verified in `dist/`:** entry chunk 481.67 → 487.17 kB (+5.5 kB: two registry entries, their icons, the route map — the same per-tool cost as previous waves). JSZip stayed a separate lazy chunk (95.9 kB) and is not in the entry; the batch UI added ~3 kB to the shared ToolWorkspace chunk. Precache grew 1,366.50 → 1,394.96 KiB (the two workflow tool chunks and the batch code).

## Left unresolved / notes for later waves

- **Ring 2 remainder:** workers for heavy processing and the Playwright end-to-end suite are still outstanding from roadmap §5; this wave covered batch mode and workflows only, as scoped.
- **Batch and the workspace paste handler:** with a batch tool open, pasting several files adds them all (the shared paste path uses the tool's `multiple` flag, which is now true for these 11) — intended, and matches the dropzone.
- **Rotate in batch** cannot rotate selected pages (selection is a single-file interaction); the UI states this rather than silently applying the first file's selection to every file.
- **Prepare to Archive step-2 failure surface:** Flatten failing mid-chain (for example a form pdf-lib cannot flatten) names step 2 and produces no file, per the workflow honesty rule — the OCR work is discarded with it rather than presented as a finished archive copy.
- As with previous waves, everything was verified through the Node test path (the same engine code the browser runs); a live smoke check of the batch UI and the two workflow routes after the next deploy is still worth doing.
