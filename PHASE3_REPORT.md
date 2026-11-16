# Phase 3 — Organise and preview tools report

Date: November 16, 2026

## Tools delivered
- Reorder Pages: thumbnail grid with HTML5 drag and drop plus keyboard accessible move earlier/later buttons on every page; the process module validates the order is a true permutation before saving.
- Add Watermark: text (centre, diagonal, top, bottom) or image/logo, opacity slider, and a live preview of the text watermark over the real first page at the chosen opacity and rotation.
- View Word and Word to PDF: one shared Word workspace. View Word renders a Mammoth HTML preview of the document on device, with Convert to PDF as the step 3 action. Word to PDF converts one or more documents (combined into one PDF when several) from extracted text with paragraph structure.
- Compress PDF: three labelled levels (Smaller for email at 100 dpi, Balanced at 150 dpi, Keep quality at 200 dpi) that re render pages as JPEG images and rebuild the PDF, which is what actually shrinks image heavy PDFs. The UI states plainly that pages become images and text will not stay selectable. Before and after sizes are shown, and the not larger guarantee is enforced in the process module: if a candidate output is larger than the input, the original bytes are returned and the result panel says so.

## Honest limits
- Word conversion fidelity: the UI carries a plain warning before processing that complex Word layout, tables, headers and styling will not carry across exactly. This was decision 3 in the plan; the default (warn plainly, keep the simple engine) was applied under the user's build without my opinion authorization.
- Compress falls back to a pdf-lib resave if page rendering fails in a given browser; the not larger guarantee applies either way and is unit tested.

## Tests
Reorder order and validation, watermark text and image embedding, compress not larger guarantee (unit tested directly, including a deliberately larger candidate), rasterized PDF builder, Word text wrapping and pagination.
