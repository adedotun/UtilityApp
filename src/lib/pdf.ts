import { PDFDocument } from 'pdf-lib'

export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return PDFDocument.load(bytes.slice(), { ignoreEncryption: true })
}

export async function countPages(data: ArrayBuffer): Promise<number> {
  try {
    const doc = await loadPdf(data)
    return doc.getPageCount()
  } catch {
    return 0
  }
}

export interface PdfMetadata { title: string; author: string; subject: string; keywords: string; creator: string; producer: string; pageCount: number }

export async function readMetadata(data: ArrayBuffer | Uint8Array): Promise<PdfMetadata> {
  const doc = await loadPdf(data)
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: (doc.getKeywords() ?? '').toString(),
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
    pageCount: doc.getPageCount(),
  }
}
