# Phase 2 — Simple tools report

Date: November 16, 2026

## Tools delivered (all with pure process modules and Vitest tests)
- Images to PDF: image reorder via the shared file list, page size A4/Letter/Legal/fit, orientation auto/portrait/landscape. PNG and JPEG embedded directly with pdf-lib; other formats converted to PNG via canvas first.
- PDF to Images: PNG or JPEG, 1x/2x/3x scale, JPEG quality slider, per page progress, cancel, all pages delivered in one ZIP (JSZip).
- Merge PDF: files reordered before merging, total files/pages/size shown before processing.
- Split PDF: all pages, ranges, and every N modes; live validation with the pure planner showing the exact output count or a specific error naming the bad range; each output downloadable individually.
- Rotate PDF: 90/180/270, all or selected pages, thumbnails preview selected pages rotated.
- Extract Pages: shared selectable thumbnail grid with selected count; output in document order.
- Edit Metadata: reads the existing title, author, subject and keywords on load and pre fills the form (the old app never showed existing values), then writes edits with a fresh modification date.
- Add Page Numbers: four formats, six positions, custom start number, and a live preview of the formatted number on the first page thumbnail.

## Tests (in the shared suite, 50 total)
Page counts, merge order verified by distinct page widths, split counts and file names, rotation angles including additive rotation on selected pages, extract order, reorder permutation validation, metadata round trip, page number formats.

## Verified
- npm test: all suites pass (see final report for the full count).
- Outputs open with pdf-lib in tests after every operation.
