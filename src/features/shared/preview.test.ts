import { describe, expect, it } from 'vitest'
import { previewKindFor } from './preview'

describe('previewKindFor', () => {
  it('recognises PDFs by MIME type and by extension', () => {
    expect(previewKindFor({ name: 'report.pdf', type: 'application/pdf' })).toBe('pdf')
    expect(previewKindFor({ name: 'report.pdf', type: '' })).toBe('pdf')
    expect(previewKindFor({ name: 'download', type: 'application/pdf' })).toBe('pdf')
  })

  it('recognises the previewable image formats by MIME type', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif']) {
      expect(previewKindFor({ name: 'photo', type })).toBe('image')
    }
  })

  it('recognises images by extension when the MIME type is missing or generic', () => {
    for (const name of ['a.png', 'a.jpg', 'a.jpeg', 'a.webp', 'a.gif', 'a.heic', 'a.heif']) {
      expect(previewKindFor({ name, type: '' })).toBe('image')
      expect(previewKindFor({ name, type: 'application/octet-stream' })).toBe('image')
    }
  })

  it('is case-insensitive about extensions and MIME types', () => {
    expect(previewKindFor({ name: 'SCAN.PDF', type: '' })).toBe('pdf')
    expect(previewKindFor({ name: 'PHOTO.JPG', type: '' })).toBe('image')
    expect(previewKindFor({ name: 'Photo.PnG', type: '' })).toBe('image')
    expect(previewKindFor({ name: 'photo', type: 'IMAGE/JPEG' })).toBe('image')
  })

  it('lets PDF win when the signals disagree, matching the page-count rule', () => {
    expect(previewKindFor({ name: 'odd.pdf', type: 'image/png' })).toBe('pdf')
    expect(previewKindFor({ name: 'odd.png', type: 'application/pdf' })).toBe('pdf')
  })

  it('gives no preview for formats we do not render', () => {
    const none: Array<{ name: string; type: string }> = [
      { name: 'letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'sheet.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'data.csv', type: 'text/csv' },
      { name: 'book.epub', type: 'application/epub+zip' },
      { name: 'archive.zip', type: 'application/zip' },
      { name: 'notes.md', type: 'text/markdown' },
      { name: 'vector.svg', type: 'image/svg+xml' },
      { name: 'scan.tiff', type: 'image/tiff' },
      { name: 'no-extension', type: '' },
      { name: '', type: '' },
    ]
    for (const f of none) expect(previewKindFor(f)).toBe('none')
  })

  it('does not mistake a trailing name fragment for an extension', () => {
    expect(previewKindFor({ name: 'my.pdf.backup', type: '' })).toBe('none')
    expect(previewKindFor({ name: 'png-notes.txt', type: 'text/plain' })).toBe('none')
  })
})
