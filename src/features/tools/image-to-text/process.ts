import type { OcrPageResult } from '../ocr-engine'

/**
 * Reads the words in one image with the shared local OCR recogniser (the
 * same engine OCR PDF uses). Fails honestly when nothing can be read, so
 * the user is told why instead of being handed an empty file.
 */
export async function imageToText(
  image: Uint8Array,
  recognize: (image: Uint8Array) => Promise<OcrPageResult>,
): Promise<{ text: string; wordCount: number }> {
  const result = await recognize(image)
  const text = result.text.trim()
  if (!text) {
    throw new Error('No words could be recognised in this image. OCR reads clear, straight text best; if the image is blank, very faint or photographed at an angle, there may be nothing it can read.')
  }
  return { text, wordCount: text.split(/\s+/).filter(Boolean).length }
}
