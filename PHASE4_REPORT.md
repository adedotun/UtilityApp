# Phase 4 — Editors report

Date: November 16, 2026

## Tools delivered
- Sign PDF: draw on a signature pad (pointer and touch), type a signature (rendered to a transparent PNG), or reuse signatures saved in localStorage only (key pdf-tweaks-signatures, data URLs of the user's own signatures; never uploaded). Click the rendered page to place, drag placed signatures to adjust, per page placement lists with remove, optional text placement, and an optional today date under the first signature. The process module embeds placements using page fraction coordinates, so placements are independent of render scale.
- Edit PDF: highlight, redact, draw (freehand), rectangle, ellipse, line, text (type then click to place), image (pick then click to place), and eraser (click an edit to remove it). Colour and opacity controls, per page undo, and clear page. Edits are stored per page in page fraction geometry and applied with pdf-lib. The workspace carries the honest redact note: redact draws a solid box over the page and does not remove the underlying text layer.
- Crop PDF: real cropping. A visual crop box overlays the rendered page (draggable to move), four edge sliders set each trim in percent, apply to all pages or selected pages via the thumbnail grid. The process module sets both crop box and media box with pdf-lib and validates that the crop leaves a usable page.

## Tests
Sign: signature and text embedding, empty placement rejection. Edit: one of every edit kind applied and re opened, hex colour parsing, empty edit rejection. Crop: crop and media box values verified in points against a known page size, selected pages only behaviour, excessive crop rejection.

## Known editor limits (honest)
- Editor previews are raster renderings via PDF.js; the saved output is generated independently with pdf-lib from the same fraction geometry, so placement matches the preview by construction, but freehand strokes are rendered as line segments in both.
- Touch drawing works via pointer events; multi touch gestures are not interpreted.
