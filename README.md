# PDF Tweaks

Free PDF and Word tools that run entirely in your browser. Files never leave your device: there is no upload, no account, and no tracking.

Live target: https://pdftweaks.adedotun.dev
This is the React + Tailwind rebuild of UtilityApp. The full rebuild plan lives in the UtilityApp project files (UtilityApp_Rebuild_Plan.md).

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

## Rebuild status

All phases complete. See FINAL_REPORT.md for the full record, and PHASE1_REPORT.md to PHASE5_REPORT.md per phase.

- 18 working tools, including real password protection (qpdf WASM, 256-bit AES) after the Phase 5 spike passed.
- 50 automated tests, all passing. Build and lint clean.
- PWA with offline app shell; sitemap generated from the tool registry on every build.
- Not deployed and not pushed anywhere. Hosting the dist folder at pdftweaks.adedotun.dev is the remaining step, and it needs a DNS record at Porkbun plus a static host.
