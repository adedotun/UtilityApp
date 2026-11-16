# Phase 0 — Foundation report

Date: November 16, 2026
Project: PDF Tweaks (https://pdftweaks.adedotun.dev)

## Done
- Vite 8 + React 19.3 + TypeScript scaffold in ~/workspace/pdf-tweaks
- Tailwind CSS v4 via @tailwindcss/vite, design tokens in src/index.css (Manrope self-hosted via Fontsource, one slate grey family, indigo accent, dark tokens, named text styles, reduced-motion handling)
- Theme store (Zustand, persisted): system / light / dark, applied as .dark class
- Tool registry (src/features/tools/registry.ts): 16 real tools, 4 categories, Phosphor icons, accept/multiple/phase per tool. Bookmarks deferred and password tools spike-gated — neither is listed.
- Router: / (home with live search + category sections), /tools/:slug (shared 3-step shell), /privacy, custom 404
- Layout: floating header, skip-to-content, footer with privacy link and Clear local data
- Libraries installed and pinned: pdf-lib, pdfjs-dist, jsPDF, Mammoth, JSZip (not yet imported — home bundle stays free of PDF code)
- CI workflow (.github/workflows/ci.yml): npm ci, build, test on Node 24
- README with stack, privacy model and phase status

## Verified
- npm run build: PASS (tsc + Vite). Home JS 389 kB / 119 kB gzip, CSS 22 kB. No PDF libraries in the home bundle.
- npm test: PASS — 4 registry tests (16 tools, unique slugs, no deferred/spike tools listed, every tool declares accept + outcome)
- npm run lint (oxlint): PASS — 0 warnings, 0 errors
- Preview server serves the built app with the correct title/meta/canonical for pdftweaks.adedotun.dev

## Not done in Phase 0 (by design)
- No tool processing yet — tool pages are shells naming their phase. Phase 1 builds the shared workspace, Phase 2 the first tools.
- No PWA/icons yet (Phase 5), no GitHub push yet — this scaffold is a local project, not yet the rebuild/react-tailwind branch of adedotun/UtilityApp. Pushing needs the branch created in that repo.
- Favicon is still the Vite default file reference.
