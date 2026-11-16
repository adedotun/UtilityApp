import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { DRM_ERROR, readEpub, resolvePath } from './process'

const CONTAINER = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

const OPF = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>The Test Voyage</dc:title>
    <dc:identifier id="id">urn:test:1</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`

const NCX = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="n1" playOrder="1"><navLabel><text>Setting Sail</text></navLabel><content src="chapter1.xhtml"/></navPoint>
    <navPoint id="n2" playOrder="2"><navLabel><text>Open Water</text></navLabel><content src="chapter2.xhtml"/></navPoint>
  </navMap>
</ncx>`

const CH1 = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head>
<body><h1>Setting Sail</h1><p>The harbour bell rang at dawn &amp; the crew cast off.</p></body></html>`

const CH2 = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head>
<body><h1>Open Water</h1><p>By noon the coast was a grey line behind them.</p><p>Nobody looked back.</p></body></html>`

async function fixtureEpub(extra?: (zip: JSZip) => void): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip')
  zip.file('META-INF/container.xml', CONTAINER)
  zip.file('OEBPS/content.opf', OPF)
  zip.file('OEBPS/toc.ncx', NCX)
  zip.file('OEBPS/chapter1.xhtml', CH1)
  zip.file('OEBPS/chapter2.xhtml', CH2)
  extra?.(zip)
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('resolvePath', () => {
  it('resolves hrefs against the OPF folder and strips fragments', () => {
    expect(resolvePath('OEBPS', 'chapter1.xhtml#top')).toBe('OEBPS/chapter1.xhtml')
    expect(resolvePath('OEBPS/text', '../images/pic.jpg')).toBe('OEBPS/images/pic.jpg')
    expect(resolvePath('', 'content.opf')).toBe('content.opf')
  })
})

describe('readEpub', () => {
  it('returns both chapters in spine order with NCX titles and decoded text', async () => {
    const book = await readEpub(await fixtureEpub())
    expect(book.title).toBe('The Test Voyage')
    expect(book.chapters).toHaveLength(2)
    expect(book.chapters[0].title).toBe('Setting Sail')
    expect(book.chapters[0].text).toContain('The harbour bell rang at dawn & the crew cast off.')
    expect(book.chapters[1].title).toBe('Open Water')
    expect(book.chapters[1].text).toContain('By noon the coast was a grey line behind them.')
    expect(book.chapters[1].text).toContain('Nobody looked back.')
  })

  it('refuses a book whose content files are encrypted, in plain words', async () => {
    const buffer = await fixtureEpub((zip) => {
      zip.file('META-INF/encryption.xml', `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:CipherData><enc:CipherReference URI="OEBPS/chapter1.xhtml"/></enc:CipherData></enc:EncryptedData>
</encryption>`)
    })
    await expect(readEpub(buffer)).rejects.toThrow(DRM_ERROR)
  })

  it('still opens a book whose only encrypted files are fonts', async () => {
    const buffer = await fixtureEpub((zip) => {
      zip.file('META-INF/encryption.xml', `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:CipherData><enc:CipherReference URI="OEBPS/fonts/Book.otf"/></enc:CipherData></enc:EncryptedData>
</encryption>`)
    })
    const book = await readEpub(buffer)
    expect(book.chapters).toHaveLength(2)
  })

  it('rejects a file that is not an EPUB', async () => {
    await expect(readEpub(new TextEncoder().encode('nope').buffer as ArrayBuffer)).rejects.toThrow(/could not be read as an EPUB/)
  })
})
