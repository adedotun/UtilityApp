import { describe, expect, it } from 'vitest'
import { TOOLS } from './registry'

describe('tool registry', () => {
  it('has 59 real tools after Wave 6b of the expansion, including the password tools after the qpdf spike passed', () => {
    expect(TOOLS).toHaveLength(59)
  })

  it('has unique slugs and names', () => {
    expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(TOOLS.length)
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length)
  })

  it('does not list the deferred bookmarks tool', () => {
    const slugs = TOOLS.map((t) => t.slug)
    expect(slugs).not.toContain('bookmarks')
    expect(slugs).toContain('password-protect')
    expect(slugs).toContain('remove-password')
    expect(slugs).toContain('delete-pages')
    expect(slugs).toContain('pdf-to-text')
    expect(slugs).toContain('repair-pdf')
    expect(slugs).toContain('flatten-pdf')
    expect(slugs).toContain('headers-footers')
    expect(slugs).toContain('ocr-pdf')
    expect(slugs).toContain('pdf-to-word')
    expect(slugs).toContain('redact-pdf')
    expect(slugs).toContain('scrub-pdf')
    expect(slugs).toContain('pdf-to-excel')
    expect(slugs).toContain('pdf-to-powerpoint')
    expect(slugs).toContain('insert-pages')
    expect(slugs).toContain('resize-pages')
    expect(slugs).toContain('n-up')
    expect(slugs).toContain('extract-images')
    expect(slugs).toContain('remove-blank-pages')
    expect(slugs).toContain('compare-pdfs')
    expect(slugs).toContain('grayscale-pdf')
    expect(slugs).toContain('split-by-bookmarks')
    expect(slugs).toContain('fill-form')
    expect(slugs).toContain('booklet-pdf')
    expect(slugs).toContain('prepare-to-share')
    expect(slugs).toContain('prepare-to-archive')
    expect(slugs).toContain('convert-image')
    expect(slugs).toContain('compress-image')
    expect(slugs).toContain('resize-image')
    expect(slugs).toContain('exif-tools')
    expect(slugs).toContain('image-to-text')
    expect(slugs).toContain('watermark-image')
    expect(slugs).toContain('word-to-markdown')
    expect(slugs).toContain('markdown-to-pdf')
    expect(slugs).toContain('epub-viewer')
    expect(slugs).toContain('merge-word')
    expect(slugs).toContain('csv-to-excel')
    expect(slugs).toContain('excel-to-csv')
    expect(slugs).toContain('clean-csv')
    expect(slugs).toContain('zip-files')
    expect(slugs).toContain('unzip-file')
    expect(slugs).toContain('file-hash')
    expect(slugs).toContain('qr-generate')
    expect(slugs).toContain('qr-read')
  })

  it('places the five Wave 6b tools in the files category', () => {
    const fileSlugs = TOOLS.filter((t) => t.category === 'files').map((t) => t.slug).sort()
    expect(fileSlugs).toEqual([
      'file-hash',
      'qr-generate',
      'qr-read',
      'unzip-file',
      'zip-files',
    ])
  })

  it('places the seven Wave 6a tools in the documents category', () => {
    const documentSlugs = TOOLS.filter((t) => t.category === 'documents').map((t) => t.slug).sort()
    expect(documentSlugs).toEqual([
      'clean-csv',
      'csv-to-excel',
      'epub-viewer',
      'excel-to-csv',
      'markdown-to-pdf',
      'merge-word',
      'word-to-markdown',
    ])
  })

  it('places the six Wave 5 tools in the images category', () => {
    const imageSlugs = TOOLS.filter((t) => t.category === 'images').map((t) => t.slug).sort()
    expect(imageSlugs).toEqual([
      'compress-image',
      'convert-image',
      'exif-tools',
      'image-to-text',
      'resize-image',
      'watermark-image',
    ])
  })

  it('flags exactly the file-independent tools for batch mode', () => {
    const batched = TOOLS.filter((t) => t.batch).map((t) => t.slug).sort()
    expect(batched).toEqual([
      'compress-image',
      'compress-pdf',
      'convert-image',
      'flatten-pdf',
      'grayscale-pdf',
      'headers-footers',
      'page-numbers',
      'pdf-to-text',
      'pdf-to-word',
      'repair-pdf',
      'resize-image',
      'rotate-pdf',
      'scrub-pdf',
      'watermark',
      'watermark-image',
      'word-to-markdown',
    ])
    for (const tool of TOOLS) {
      if (tool.batch) expect(tool.multiple).toBe(true)
    }
  })

  it('every tool declares accepted types and an outcome', () => {
    for (const tool of TOOLS) {
      expect(tool.accept.length).toBeGreaterThan(0)
      expect(tool.outcome.length).toBeGreaterThan(10)
    }
  })
})
