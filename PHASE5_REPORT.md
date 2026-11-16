# Phase 5 — Hardening, PWA, SEO and the password spike report

Date: November 16, 2026

## Password spike: GO
- Package tested: @neslinesli93/qpdf-wasm 0.3.1 (qpdf compiled to WASM, 1.33 MB binary).
- Standalone spike in /tmp/qpdf-spike proved: encrypt with 256-bit AES exits 0; pdf-lib refuses to open the encrypted file without a password; decrypt with the correct password restores a readable PDF; a wrong password exits with code 2.
- The same round trip was then added as automated tests in the app itself (password-protect/process.test.ts): encrypt, refusal without password, decrypt back to the same page count, and a specific wrong password error message. All pass.
- Decision: Password protect and Remove password were added to the registry as real tools (catalogue is now 18 tools, with a new Security category). Both run qpdf entirely on device; passwords are never stored. The WASM is a lazily loaded asset, not precached, and is runtime cached on first use.
- One fix was needed for tests: under Vitest the asset URL is a root relative /node_modules path, resolved against the cwd in resolveWasmLocation. Browser builds use the emitted asset URL unchanged.

## PWA and offline
- vite-plugin-pwa with autoUpdate, a generated manifest (name, icons, standalone display), and icons generated for this project (192, 512, maskable 512, apple touch 180, plus a matching SVG favicon). No placeholder icon files are referenced.
- Build output: service worker generated, precache 62 entries totalling 947 KiB. Large engines (pdfjs, its worker, mammoth, the qpdf WASM) are excluded from precache and cached at runtime on first use, so the first load stays lean and tools work offline after they have been opened once.
- Offline behaviour is therefore: app shell and home work offline after the first visit; a tool works offline after its first use. This is stated accurately in the home FAQ.

## SEO and metadata
- Sitemap generated from the registry by scripts/generate-sitemap.mjs on every build: 20 URLs (home, privacy, 18 tools) for https://pdftweaks.adedotun.dev, plus robots.txt pointing at it.
- Per tool title and meta description are set from the registry when a tool opens.
- JSON-LD in index.html is honest: WebApplication with the real feature list and a free offer. There is no aggregate rating or any invented number (the old app claimed a 4.9 rating from 1,250 reviews).
- A Content Security Policy meta tag restricts scripts, workers, images, fonts and connections to self (with wasm-unsafe-eval for the qpdf and PDF.js engines, blob and data for in browser file work). No analytics, no tracking, no runtime CDN scripts anywhere.

## Smoke check
- Preview server: /, /tools/merge-pdf, /tools/password-protect, /privacy, /sitemap.xml, /manifest.webmanifest and /sw.js all returned 200 with the correct document title.

## Lint fixes made during this phase
- Initial lint after the build: 1 error and 5 warnings (a hook named useTyped in Sign, ref mutation patterns in Edit, set state in effect in the PDF rendering components). All were fixed by restructuring (renamed function, editor drag state moved inside the canvas component, loaded for buffer tracking in the PDF components). Final lint: 0 warnings, 0 errors.

## Design delivery gate
- Full result with before and after counts is in FINAL_REPORT.md. Summary: zero fails after the fix round, one deferred pattern (the three column tool directory grid on the home page) with the reason recorded.
