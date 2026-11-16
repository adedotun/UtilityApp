import { PDFDocument } from 'pdf-lib'
import { readMetadata, type PdfMetadata } from '../../../lib/pdf'
export { readMetadata }
export type { PdfMetadata }

export interface MetadataEdits { title: string; author: string; subject: string; keywords: string }

export async function setMetadata(buffer: ArrayBuffer, edits: MetadataEdits): Promise<Uint8Array> {
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  doc.setTitle(edits.title)
  doc.setAuthor(edits.author)
  doc.setSubject(edits.subject)
  doc.setKeywords(edits.keywords.split(',').map((k) => k.trim()).filter(Boolean))
  doc.setModificationDate(new Date())
  return doc.save()
}
