import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { imageToText } from './process'
import { createRecognizer } from '../ocr-engine'
import { makeTextImage } from '../image/test-images'

describe('imageToText', () => {
  it('rejects an image the recogniser reads as empty, with the reason', async () => {
    await expect(imageToText(new Uint8Array([1]), async () => ({ text: '   ', lines: [] }))).rejects.toThrow('No words could be recognised')
  })

  it('returns the recognised text and a word count', async () => {
    const result = await imageToText(new Uint8Array([1]), async () => ({ text: 'Four word test line', lines: [] }))
    expect(result.text).toBe('Four word test line')
    expect(result.wordCount).toBe(4)
  })

  it('reads real words from a drawn text image with the local tesseract engine', async () => {
    const recognizer = await createRecognizer({
      langPath: join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
      cachePath: mkdtempSync(join(tmpdir(), 'pdf-tweaks-img-ocr-')),
    })
    try {
      const image = makeTextImage(['SECRET LEDGER', 'Account summary page'])
      const result = await imageToText(image, (img) => recognizer.recognize(img))
      expect(result.text).toContain('SECRET LEDGER')
      expect(result.wordCount).toBeGreaterThan(2)
    } finally {
      await recognizer.terminate()
    }
  }, 120_000)
})
