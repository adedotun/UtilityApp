# SEO completion — Nov 22, 2026

## What was already in place (verified Nov 22)

- Homepage title, meta description, canonical, Open Graph / Twitter cards, JSON-LD WebApplication schema.
- robots.txt (allow all, sitemap reference) and a script-generated sitemap.xml with 61 URLs (home + privacy + 59 tools).
- Per-tool title and meta description were set by the app at runtime (ToolWorkspace), so they only existed after JavaScript ran.
- The deploy workflow already copied dist/index.html to dist/404.html as an SPA fallback — unknown paths served the app shell with a 404 status.

## What this change adds

- `scripts/prerender.mjs`, wired into `npm run build` after `vite build` (so CI runs it too):
  - Writes `dist/tools/<slug>/index.html` for all 59 tools and `dist/privacy/index.html`.
  - Each page carries its own title (`<Tool> — FileTweaks`), meta description (the same formula the app uses at runtime: `<Name>: <outcome> Free, in your browser, with no uploads.`), canonical URL, and matching Open Graph title/description/url.
  - Each page contains a small static summary inside #root (tool name as H1, outcome line, no-uploads note) that the app replaces when it boots — crawlers get real content with a 200 status instead of the 404 fallback.
  - The script parses slug/name/outcome from the registry (same approach as the sitemap generator), fails the build if no tools parse or slugs collide, and leaves the homepage dist/index.html untouched.
- `PrivacyPage` now also sets its own document title and meta description on client-side navigation, matching its prerendered page.

## Verification (local, Nov 22)

- Build passes; prerender logged "59 tool pages + privacy".
- dist spot-check: merge-pdf page has title "Merge PDF — FileTweaks", its unique description, canonical https://filetweaks.adedotun.dev/tools/merge-pdf, and the static H1 summary; homepage HTML unchanged.
- Unit tests 340/340 (63 files), lint 0/0 on 234 files, e2e 10/10.

## Search Console / Bing

- Handled separately in the browser: Google Search Console domain property for adedotun.dev (DNS TXT at Porkbun, add-only), sitemap submission, then Bing Webmaster import. Status recorded in MEMORY.md when confirmed.
