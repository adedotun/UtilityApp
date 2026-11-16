// Generates public/sitemap.xml and public/robots.txt from the tool registry slugs.
import { readFileSync, writeFileSync } from 'node:fs'

const registry = readFileSync(new URL('../src/features/tools/registry.ts', import.meta.url), 'utf8')
const slugs = [...registry.matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1])
const base = 'https://filetweaks.adedotun.dev'
const urls = [`${base}/`, `${base}/privacy`, ...slugs.map((s) => `${base}/tools/${s}`)]
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml)
writeFileSync(new URL('../public/robots.txt', import.meta.url), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`)
console.log(`sitemap: ${urls.length} urls (${slugs.length} tools)`)
