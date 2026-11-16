import JSZip from 'jszip'
import { decodeEntities } from '../../../lib/entities'

export interface EpubChapter { title: string; text: string }
export interface EpubBook { title: string | null; chapters: EpubChapter[] }

export const DRM_ERROR = 'This book is protected with DRM: its contents are encrypted, so it cannot be opened here. A DRM-free copy of the same book (for example from the store\u2019s DRM-free download, or a library that lends unprotected EPUBs) will open normally.'

/** Resolves an href against the folder holding the OPF, inside the zip. */
export function resolvePath(baseDir: string, href: string): string {
  const clean = decodeURIComponent(href.split('#')[0])
  const parts = (baseDir ? `${baseDir}/${clean}` : clean).split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`)) ?? tag.match(new RegExp(`${name}='([^']*)'`))
  return m ? m[1] : null
}

function stripMarkupToText(xhtml: string): string {
  return xhtml
    .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => decodeEntities(line).replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function chapterTitle(xhtml: string, fallback: string): string {
  const titleTag = xhtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const heading = xhtml.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]
  const clean = (s?: string) => (s ? decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '')
  return clean(heading) || clean(titleTag) || fallback
}

/**
 * Reads an EPUB with JSZip and hand-rolled parsing: container.xml points at
 * the OPF, the OPF manifest and spine give the reading order, the NCX (when
 * present) gives chapter titles. No EPUB library is involved.
 *
 * DRM is checked before anything is read: META-INF/encryption.xml listing
 * encrypted content files means the book is protected and cannot be opened.
 * Encrypted font files alone are font obfuscation, not DRM — the text is
 * fully readable, so those books still open.
 */
export async function readEpub(buffer: ArrayBuffer): Promise<EpubBook> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error('This file could not be read as an EPUB. It may be damaged, or not an EPUB at all.')
  }

  const encryptionFile = zip.file('META-INF/encryption.xml')
  if (encryptionFile) {
    const xml = await encryptionFile.async('string')
    const uris = [...xml.matchAll(/<[^>]*CipherReference[^>]*URI="([^"]+)"/g)].map((m) => m[1])
    const contentEncrypted = uris.filter((u) => !/\.(otf|ttf|woff2?)$/i.test(decodeURIComponent(u.split('#')[0])))
    if (contentEncrypted.length) throw new Error(DRM_ERROR)
  }

  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('This file is not a complete EPUB: it has no container.xml, so the book\u2019s contents cannot be located.')
  const containerXml = await containerFile.async('string')
  const rootfile = containerXml.match(/<rootfile[^>]*full-path="([^"]+)"/)?.[1] ?? containerXml.match(/<rootfile[^>]*full-path='([^']+)'/)?.[1]
  if (!rootfile) throw new Error('This EPUB\u2019s container does not name a contents file, so the book cannot be opened.')

  const opfPath = decodeURIComponent(rootfile)
  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error('This EPUB is missing its contents file, so the book cannot be opened.')
  const opf = await opfFile.async('string')
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''

  const bookTitle = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim()
    ? decodeEntities(opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)![1]).replace(/\s+/g, ' ').trim()
    : null

  const manifest = new Map<string, { href: string; type: string }>()
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = attr(m[0], 'id')
    const href = attr(m[0], 'href')
    const type = attr(m[0], 'media-type')
    if (id && href) manifest.set(id, { href, type: type ?? '' })
  }
  const spineIds = [...opf.matchAll(/<itemref\b[^>]*>/g)]
    .map((m) => attr(m[0], 'idref'))
    .filter((id): id is string => !!id)

  // Chapter titles from the NCX table of contents, when the book has one.
  const ncxTitles = new Map<string, string>()
  const ncxItem = [...manifest.values()].find((i) => i.type === 'application/x-dtbncx+xml')
  if (ncxItem) {
    const ncxFile = zip.file(resolvePath(opfDir, ncxItem.href))
    if (ncxFile) {
      const ncx = await ncxFile.async('string')
      for (const point of ncx.matchAll(/<navPoint\b[\s\S]*?<\/navPoint>/g)) {
        const label = point[0].match(/<navLabel>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i)?.[1]
        const src = point[0].match(/<content[^>]*src="([^"]+)"/i)?.[1]
        if (label && src) {
          ncxTitles.set(resolvePath(opfDir, src), decodeEntities(label.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
        }
      }
    }
  }

  const chapters: EpubChapter[] = []
  for (const id of spineIds) {
    const item = manifest.get(id)
    if (!item || !/xhtml|html/.test(item.type)) continue
    const path = resolvePath(opfDir, item.href)
    const file = zip.file(path)
    if (!file) continue
    const xhtml = await file.async('string')
    const text = stripMarkupToText(xhtml)
    if (!text) continue
    chapters.push({ title: ncxTitles.get(path) || chapterTitle(xhtml, `Chapter ${chapters.length + 1}`), text })
  }
  if (!chapters.length) {
    throw new Error('No readable chapters could be found in this EPUB. Its contents may use a format this viewer cannot read.')
  }
  return { title: bookTitle, chapters }
}
