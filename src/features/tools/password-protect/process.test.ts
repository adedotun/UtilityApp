import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { decryptPdf, encryptPdf } from './process'
import { buf, makePdf } from '../test-fixtures'

describe('password protection with qpdf wasm', () => {
  it('encrypts so the file cannot be opened without the password, and decrypts back', async () => {
    const src = await makePdf(2)
    const encrypted = await encryptPdf(buf(src), 'open-sesame', 'owner-pw')
    await expect(PDFDocument.load(encrypted.slice())).rejects.toThrow(/encrypted/i)
    const decrypted = await decryptPdf(buf(encrypted), 'open-sesame')
    const doc = await PDFDocument.load(decrypted.slice())
    expect(doc.getPageCount()).toBe(2)
  }, 30000)
  it('rejects a wrong password with a specific message', async () => {
    const src = await makePdf(1)
    const encrypted = await encryptPdf(buf(src), 'right-password', '')
    await expect(decryptPdf(buf(encrypted), 'wrong-password')).rejects.toThrow('password was not accepted')
  }, 30000)
  it('requires a password', async () => {
    const src = await makePdf(1)
    await expect(encryptPdf(buf(src), '', '')).rejects.toThrow('Enter a password')
  })
})
