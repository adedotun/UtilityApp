// Prerenders one static HTML page per route from the built dist/index.html.
//
// FileTweaks is a client-side SPA served by GitHub Pages. Without this step
// every route serves the same homepage HTML (and unknown paths fall back to
// a 404-status copy), so crawlers see one title and one description for the
// whole site. This script writes dist/tools/<slug>/index.html for every tool
// in the registry plus dist/privacy/index.html, each with its own title,
// meta description, canonical and Open Graph values, and a small static
// summary inside #root that the app replaces when it boots.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const base = 'https://filetweaks.adedotun.dev'

const registry = readFileSync(new URL('../src/features/tools/registry.ts', import.meta.url), 'utf8')
const tools = [...registry.matchAll(/slug: '([a-z0-9-]+)',\s*name: '([^']*)',[\s\S]*?outcome: '([^']*)'/g)].map(
  (m) => ({ slug: m[1], name: m[2], outcome: m[3] }),
)
if (tools.length === 0) throw new Error('prerender: no tools parsed from registry.ts')
if (new Set(tools.map((t) => t.slug)).size !== tools.length) throw new Error('prerender: duplicate tool slugs')

const shell = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
if (!shell.includes('<div id="root"></div>')) throw new Error('prerender: #root placeholder not found in dist/index.html')

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function buildPage({ title, description, url, heading, bodyParas }) {
  let html = shell
  const swap = (pattern, replacement, label) => {
    if (!pattern.test(html)) throw new Error(`prerender: could not replace ${label}`)
    html = html.replace(pattern, replacement)
  }
  swap(/<title>[^<]*<\/title>/, `<title>${escText(title)}</title>`, 'title')
  swap(/(name="description"\s*content=")[^"]*(")/, `$1${escAttr(description)}$2`, 'meta description')
  swap(/(rel="canonical" href=")[^"]*(")/, `$1${url}$2`, 'canonical')
  swap(/(property="og:url" content=")[^"]*(")/, `$1${url}$2`, 'og:url')
  swap(/(property="og:title" content=")[^"]*(")/, `$1${escAttr(title)}$2`, 'og:title')
  swap(/(property="og:description"\s*content=")[^"]*(")/, `$1${escAttr(description)}$2`, 'og:description')
  const staticContent = `<main><p><a href="/">FileTweaks</a></p><h1>${escText(heading)}</h1>${bodyParas
    .map((p) => `<p>${escText(p)}</p>`)
    .join('')}</main>`
  html = html.replace('<div id="root"></div>', `<div id="root">${staticContent}</div>`)
  return html
}

for (const tool of tools) {
  // Same description formula the app applies at runtime (ToolWorkspace).
  const description = `${tool.name}: ${tool.outcome} Free, in your browser, with no uploads.`
  const html = buildPage({
    title: `${tool.name} — FileTweaks`,
    description,
    url: `${base}/tools/${tool.slug}`,
    heading: tool.name,
    bodyParas: [tool.outcome, 'Free, in your browser, with no uploads. Your files never leave your device.'],
  })
  const dir = new URL(`../dist/tools/${tool.slug}/`, import.meta.url)
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('index.html', dir), html)
}

const privacyDescription =
  'How FileTweaks handles your files: everything is processed in your browser, nothing is uploaded, and there is no analytics or tracking.'
const privacyHtml = buildPage({
  title: 'Privacy — FileTweaks',
  description: privacyDescription,
  url: `${base}/privacy`,
  heading: 'Privacy',
  bodyParas: [
    'FileTweaks processes every file in your browser, on your device. Files are never uploaded to a server, because there is no server in the design that could receive them.',
    'There is no analytics, no tracking, and no third party script loaded at runtime.',
  ],
})
const privacyDir = new URL('../dist/privacy/', import.meta.url)
mkdirSync(privacyDir, { recursive: true })
writeFileSync(new URL('index.html', privacyDir), privacyHtml)

console.log(`prerender: ${tools.length} tool pages + privacy`)
