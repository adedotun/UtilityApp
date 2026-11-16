import { PDFDocument } from 'pdf-lib'

export interface FlattenResult { data: Uint8Array; fieldCount: number }

export async function flattenPdf(buffer: ArrayBuffer): Promise<FlattenResult> {
  const doc = await PDFDocument.load(new Uint8Array(buffer.slice(0)), { ignoreEncryption: true })
  const form = doc.getForm()
  const fieldCount = form.getFields().length
  if (fieldCount === 0) {
    throw new Error('This PDF has no form fields, so there is nothing to flatten. The file was not changed.')
  }
  form.flatten()
  return { data: await doc.save(), fieldCount }
}
