# PDF Tweaks — final rebuild report

Date: November 16, 2026
Project: ~/workspace/pdf-tweaks · Target: https://pdftweaks.adedotun.dev (not deployed, not pushed — see "Not done")

## Per phase status

| Phase | Status | Report |
|---|---|---|
| 0 — Foundation | Done in the earlier session | PHASE0_REPORT.md |
| 1 — Shared workspace | Done | PHASE1_REPORT.md |
| 2 — Simple tools (8) | Done | PHASE2_REPORT.md |
| 3 — Reorder, watermark, Word, compress | Done | PHASE3_REPORT.md |
| 4 — Editors: sign, edit, crop | Done | PHASE4_REPORT.md |
| 5 — PWA, SEO, CSP, password spike | Done, spike GO | PHASE5_REPORT.md |

## What the app now is

18 working tools, every one a real implementation, no shells and no placeholder entries:
Convert: Images to PDF, PDF to images, Word to PDF, View Word.
Organise: Merge PDF, Split PDF, Rotate PDF, Extract pages, Reorder pages, Edit metadata.
Edit and sign: Sign PDF, Edit PDF, Add watermark, Add page numbers, Crop PDF.
Optimise: Compress PDF.
Security: Password protect, Remove password (added after the qpdf spike passed).

Every tool runs through the same 3 step workspace (add files with drag, browse or paste and inline validation naming the file and problem; options with previews where they help; process with progress and cancel, then a result panel with editable file name, final size, download and process another). There is no window.alert, prompt or confirm anywhere. All processing is client side; localStorage holds only the theme, favourite and recent tool slugs, and user saved signatures — never file contents or processed file names.

## Verification, with actual numbers

- Tests: 50 passed, 0 failed, across 17 test files (Vitest). Coverage by tool: merge order and page counts, split parsing/plans/counts/file names, rotation angles (including additive, selected pages), extract order, reorder permutation validation, metadata read and round trip, page number formats and application, watermark text and image, crop/media box values in points, compress not larger guarantee including a deliberately larger candidate, images to PDF page geometry, PDF to images ZIP contents and naming, sign placements, one of every edit kind, Word wrapping and pagination, registry integrity, and the full qpdf encrypt/decrypt round trip including wrong password rejection.
- Build: passes (TypeScript plus Vite). Lint (oxlint): 0 warnings, 0 errors on 78 files.
- Preview smoke check: /, /tools/merge-pdf, /tools/password-protect, /privacy, /sitemap.xml, /manifest.webmanifest and /sw.js all returned HTTP 200 with the correct title.
- PWA: service worker generated; precache 62 entries, 948.92 KiB; manifest and generated icons (192, 512, maskable 512, apple touch 180) are real files in dist.

## Bundle and code splitting

- Home entry chunk (index): 409.01 kB, 123.96 kB gzip. Verified to contain no pdf-lib code (grep for PDFDocument in the index chunk: 0 matches).
- Lazy chunks, loaded only when a tool or feature needs them: pdf-lib shared chunk 212.25 kB (67.40 gzip), pdfjs-dist 443.57 kB (133.54 gzip), PDF.js worker emitted as a local asset, Mammoth 510.17 kB (204.06 gzip), JSZip 95.93 kB, qpdf WASM 1,334.28 kB (453.06 gzip, runtime cached on first use of a password tool only). Each tool component is its own small chunk (roughly 1 to 9 kB).
- No runtime CDN scripts, no analytics, no tracking.

## Design delivery gate audit

Method: redesign audit applied to the fresh build, counts taken by grep over src before and after one fix round.

Before the fix round: alert/prompt/confirm 0, italics 0, background gradients 0, emoji characters 0, dead hash links 0, pill shapes (rounded-full) 1, lint findings 6 (1 error, 5 warnings, counted separately below).
Fix round: the single rounded-full (progress bar track) changed to rounded-lg; the lint findings were fixed by restructuring code (see Phase 5 report).
After: alert/prompt/confirm 0, italics 0, gradients 0, emoji 0, rounded-full 0, lint 0 warnings and 0 errors. Remaining arbitrary size utilities are the design system's own specified values: scale-[0.98] active state (28 uses, specified), the 680px content cap (4 uses, specified), the 300px editor rail grid (3 uses), and a 220px thumbnail preview width (2 uses). Colour utilities reference theme tokens via var(), which is the Tailwind v4 token mechanism, not ad hoc values.
Deferred: 1 pattern. The home tool directory uses a three column responsive grid (1 instance). It was kept deliberately: it is a functional directory of 18 tools grouped by category with a favourites/recent section and search, not a marketing feature row, and scanning speed matters more there than compositional variety. Headings are sentence case; tool names themselves are proper product labels. Result: gate passes with zero fails and one deferred item, named here as required.

## Password spike decision

GO. @neslinesli93/qpdf-wasm 0.3.1 genuinely encrypts (256-bit AES) and decrypts in automated tests inside this project, not just in a scratch spike: the encrypted output cannot be opened without the password, the correct password restores it, and a wrong password produces a specific error. Both tools were therefore added to the registry. One honest caveat: the encrypt/decrypt verification ran under Node/Vitest using the exact shipped process module and WASM binary, and the browser build compiles and emits the WASM correctly (Vite notes that the package's Node-only fs/path/crypto imports are externalized for the browser, which is that package's normal browser pattern). In-browser execution of the two password tools was not smoke tested in a live browser in this environment. Recommend a 2 minute manual check of Password protect after first deploy; every other tool family was verified through the same module level tests plus the preview smoke check.

## Decisions made without the user (authorized: build without my opinion)

- Tool count is 18, not 16: the password spike passed, so both password tools ship. Bookmarks stays deferred, as planned.
- Word to PDF uses the plain fidelity warning default from the plan.
- Toasts built in house instead of Sonner; typed useState options instead of React Hook Form/Zod; HTML5 drag plus keyboard buttons instead of dnd-kit; images embedded with pdf-lib instead of jsPDF for Images to PDF. Same user visible behaviour, fewer dependencies.
- Compress levels are labelled by outcome and disclose that pages become images.

## Deferred and not done, with reasons

- Bookmarks tool: deferred per plan (fragile low level outline work in pdf-lib). Not in the registry, not advertised.
- Playwright e2e: not run. The minimum bar set for this build (unit tests, build, preview smoke check) was met and exceeded; browser level e2e, including the password tools caveat above, is the main remaining verification gap.
- GitHub push, deployment and DNS: explicitly out of scope for this task. The dist folder is ready to host as a static site; pointing pdftweaks.adedotun.dev at it needs one CNAME at Porkbun and a static host, which the user or a later session must do.
- Phase 6 of the original plan (parity cutover against the old app and retiring it) belongs with deployment and was not part of this build.
