# FileTweaks

Free file tools for PDFs, images, documents and everyday files that run entirely in your browser. Files never leave your device: there is no upload, no account, and no tracking.

Live target: https://filetweaks.adedotun.dev
This is the React + Tailwind rebuild of UtilityApp, launched as PDF Tweaks and renamed to FileTweaks once the toolkit grew beyond PDFs. The full rebuild plan lives in the UtilityApp project files (UtilityApp_Rebuild_Plan.md).

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4, tokens in `src/index.css`
- React Router (one route per tool, driven by `src/features/tools/registry.ts`)
- Zustand for small persisted preferences (theme, favourites, recent)
- pdf-lib, pdfjs-dist, jsPDF, Mammoth, JSZip — bundled locally, never loaded from a CDN

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build
npm test         # vitest
```

## Privacy model

All processing happens in browser APIs and local libraries. The only localStorage keys are theme, favourite/recent tools, and saved signatures. File contents and processed file names are never persisted or sent anywhere.

## Status

The rebuild and the expansion beyond PDF tools are complete. See FINAL_REPORT.md for the rebuild record, and the WAVE*_REPORT.md files per expansion wave.

- 59 working tools across PDF, image, document and file categories, including real password protection (qpdf WASM, 256-bit AES), OCR and true redaction.
- 327 automated unit tests plus a Playwright e2e suite, all passing. Build and lint clean.
- PWA with offline app shell; sitemap generated from the tool registry on every build.
- Deployed via GitHub Pages at filetweaks.adedotun.dev.
