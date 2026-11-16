# Phase 1 — Shared workspace report

Date: November 16, 2026

## Done
- Dropzone (src/features/shared/Dropzone.tsx): drag and drop, click to browse, keyboard operable, and paste from clipboard anywhere on the tool page (handled in useWorkspace). Inline validation names the file and the problem (unsupported type, empty file, over the 200 MB working limit) via toasts and per file error lines.
- FileList: name, formatted size, PDF page count (read with pdf-lib on add), remove, and move earlier/later buttons for reordering multi file tools.
- PageThumbnails: shared selectable thumbnail grid rendered with pdfjs-dist using the locally bundled worker (pdf.worker asset emitted by Vite, never a CDN). Supports multi select with aria-pressed and a per page transform (used for the rotate preview).
- ToolWorkspace: the shared 3 step shell (add files, choose options, process and download) with progress bar, cancel via AbortController, inline job errors, and a result panel (editable output file name for single outputs, final size, per file download for multi outputs, process another reset). It also sets per tool document title and meta description and records the tool in recent tools.
- Toast system (src/lib/toast.ts + components/Toaster.tsx, Zustand based, built in house instead of adding Sonner): success, error and info messages with dismiss. There is no window.alert, prompt or confirm anywhere in src (verified by grep, count 0).
- Home: favourites and recent tools (localStorage, slugs only) with star toggles, search, categories; the internal "Phase X" caption on cards was replaced with accepted file types.
- Preferences store (src/app/prefs.ts): favourites and recent, persisted. File names and contents are never stored.

## Decisions made without the user (per authorization)
- Built the toast system in house rather than adding Sonner, and used typed useState options instead of React Hook Form and Zod, and HTML5 drag plus keyboard buttons instead of dnd-kit. Reason: fewer dependencies, smaller bundle, same user visible behaviour. Recorded here and in the final report.
- Editors get page navigation inside the shared PdfCanvas component rather than a separate shell.

## Verified
- Build passes after the phase (with Phases 2 to 4 components present in the same working tree, the phases were built in one continuous pass and verified together at each gate).
- Lint: 0 warnings, 0 errors at the final gate (intermediate react hooks findings in the editors were fixed by restructuring state, see Phase 5 report).
