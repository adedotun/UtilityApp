# File List Previews — Report

Date: November 19, 2026
Scope: Step 1's shared file list (`FileList.tsx`) showed only an icon, name, size and page count for every added file — no visual confirmation of what was added, worst in the image tools, which showed nothing of the photo. This change adds real thumbnails to the shared list so all 59 tools (and batch mode, which uses the same list) benefit. **Code only: no deploy, no git commit, no CNAME/index.html/branding/domain changes.**

Result: **340 unit tests (was 327), 10 of 10 e2e specs (was 8), build pass, lint 0/0 — all green.**

---

## What was built

Four files changed/added, all under `src/features/shared/`:

- **`preview.ts`** (new) — the pure decision function `previewKindFor(file) → 'image' | 'pdf' | 'none'`. PDF wins when either signal says PDF (MIME `application/pdf` or `.pdf` extension — the same rule `useWorkspace` uses for page counting). Images are recognised by MIME type or extension (png, jpg, jpeg, webp, gif, heic, heif), case-insensitively, so a photo with a missing or generic MIME type still previews from its name. Everything else — Word, Excel, CSV, EPUB, ZIP, Markdown, SVG, TIFF — is `'none'`: no preview is faked for a format we do not render.
- **`FilePreview.tsx`** (new) — the per-row visual that replaces the bare icon in `FileList.tsx`:
  - Image files: an `<img>` fed by an object URL created from the file itself, 48×48 (`h-12 w-12`), `object-cover`, `rounded-lg`, with the existing line-border tokens. The URL is created once per row (rows are keyed by file id) and revoked by an effect cleanup when the row unmounts or the file is removed — no leaks.
  - PDF files: an `<img>` fed by the first-page data URL from the thumbnail store (below).
  - `'none'`, still-loading, and failed previews all show the existing Phosphor `File` icon; image/PDF rows reserve the 48×48 box from the start (icon centred as placeholder) so the row never jumps when the thumbnail arrives.
- **`pdfThumbnail.ts`** (new) — `PdfThumbnailStore` plus the shared `pdfThumbnails` instance (see Rendering/caching).
- **`FileList.tsx`** — the row's `<File size={20}>` became `<FilePreview entry={f} />`. Nothing else in the row changed: reorder buttons, remove button, page count, notes and error text all work as before, and batch-mode lists get previews identically since they render through the same component.

## Rendering and caching approach

- **Images** render via object URL + `<img>` — the browser's own decoder does the work, so no canvas pass and no extra engine. This is also what makes HEIC behave per the brief: a browser that can decode HEIC (Safari) shows the photo; one that cannot fires the img `onError`, and the row silently swaps back to the generic icon — never a broken-image glyph.
- **PDFs** render page 1 at 96 CSS px wide through the project's existing PDF.js setup in `src/lib/pdfjs.ts` — reached by dynamic `import()` (the pattern the tool components already use), rendered with the shared `renderPage` into an offscreen canvas, and captured as a PNG data URL. The loading task is destroyed after the render; the data URL is the only thing kept. No second PDF.js integration was added.
- **Caching:** the store caches the render promise per workspace-file id, so re-renders, reorders and repeat mounts reuse the finished data URL instead of rendering again. A failed render is cached as `null` (no retry storms). Rows release their entry on unmount, so removing a file frees its thumbnail; re-adding creates a new workspace id and renders fresh.
- **Performance:** renders run through a sequential queue inside the store — one page renders at a time, so a list of 20 PDFs parses 20 documents one after another instead of all at once. The queue can never reject, so one damaged file cannot stall the rows behind it. Image object URLs are effectively free by comparison.

## Fallback behaviour

- Damaged or encrypted PDF (PDF.js load/render rejects, or the workspace has no buffer for the file): the store resolves `null`, the row keeps the generic icon, and nothing is printed or toasted — the row's existing error text ("could not be read as a PDF…") is where the problem is explained.
- Undecodable image (notably HEIC in Chrome): `onError` swaps the thumbnail back to the generic icon, silently.
- Non-rendered formats: the icon, exactly as before this change.

## Tests

- **Unit: 340 passed, 0 failed, 63 files** (was 327/61; +13 tests, +2 files):
  - `preview.test.ts` (7 tests) — the full mapping: PDF by MIME and by extension; all six image formats by MIME; images by extension with missing/generic MIME; uppercase extensions and MIME types; the PDF-wins tie-break; ten no-preview formats including SVG and TIFF; and near-miss names (`my.pdf.backup`, `png-notes.txt`) correctly returning `'none'`.
  - `pdfThumbnail.test.ts` (6 tests) — the store against injected fake renderers: renders once per id and serves repeats from cache; ids stay independent; a failed render resolves `null` and is cached; `release()` evicts so the next get re-renders; renders run strictly sequentially (a gated first render proves the second does not start early); and one failing render does not stall the queue behind it.
- **E2E: 10 passed, 0 failed** (was 8; +1 spec file, `e2e/preview.e2e.ts`, 2 specs): in a real Chromium, an added PDF (Merge PDF + alpha fixture) shows a thumbnail img that actually decoded (`naturalWidth > 0` — a rendered page, not a placeholder), and an added PNG (Convert Image, in-memory 1×1 PNG) shows its own thumbnail (`naturalWidth === 1`).
- **Build:** pass (`tsc -b` clean). Two type errors were caught and fixed during the build: the project's `erasableSyntaxOnly` mode forbids constructor parameter properties (the store now declares its field explicitly), and this pdfjs-dist version does not type `destroy()` on the document proxy, so the renderer destroys the loading task instead.
- **Lint: 0 warnings, 0 errors on 233 files** (was 227; +6 files). One React Compiler warning along the way (setState synchronously inside an effect) was fixed by creating the image object URL in a lazy state initializer and letting the effect only revoke it.
- **Design gate greps** over the changed files: no `alert(`/`prompt(`/`confirm(`, no italic classes, no gradient classes. Thumbnails use existing tokens only (`--color-line` / `--color-dark-line` borders, `rounded-lg`), and the fallback is the existing Phosphor icon.

## Bundle impact

- The new code (~7.5 KB of source across the three modules) landed in the existing shared **ToolWorkspace chunk: 31,374 bytes** after the change — the chunk every tool page already loads; no new chunk was created.
- The home/index chunk is unchanged at **541,645 bytes** (identical size to the pre-change build).
- **pdfjs stays in its own lazy chunk** and is not pulled into the shared chunk: the ToolWorkspace chunk references `pdfjs-*.js` as a separate chunk, loaded only when a PDF row needs a thumbnail. The pdfjs chunk itself grew slightly, 443,599 → **444,928 bytes (+1,329)**, because the thumbnail renderer's dynamic import joins its module graph.

## Left unverified

- **HEIC in a real browser:** the decode-or-fallback behaviour is implemented exactly as specified (object URL + `onError` → icon) but was not exercised live — the e2e image spec uses PNG, and this environment has no HEIC-decoding browser to prove the Safari path or the Chrome fallback with. This matches the product's existing HEIC caveat (Wave 5): support is browser-dependent and the failure mode is the honest icon, never a broken image.
- **A 20-PDF list under real load:** sequential rendering and per-id caching are unit-tested for ordering and reuse, but no browser load test with 20 real PDFs was run; the claim rests on the queue design, not a measurement.
- **Component rendering in unit tests:** the repo has no DOM/component test setup (all 340 unit tests are Node-environment logic tests), so `FilePreview`'s object-URL lifecycle is covered by the two new Chromium e2e specs and code review rather than a component test. The brief's optional Node-canvas rendered-image check was not needed — the e2e `naturalWidth` assertions prove real decoding in the browser, which is the stronger check.
