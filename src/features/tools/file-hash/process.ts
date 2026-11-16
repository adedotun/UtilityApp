export interface FileHashes {
  sha256: string
  sha1: string
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Computes the SHA-256 and SHA-1 hashes of the data with WebCrypto.
 * crypto.subtle is only exposed in secure contexts — this site is served
 * over HTTPS (and on localhost while developing), so it is available
 * wherever the tool itself can run.
 */
export async function hashData(data: Uint8Array): Promise<FileHashes> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure hashing is not available in this browser context.')
  }
  const copy = new Uint8Array(data)
  const [sha256, sha1] = await Promise.all([
    globalThis.crypto.subtle.digest('SHA-256', copy),
    globalThis.crypto.subtle.digest('SHA-1', copy),
  ])
  return { sha256: toHex(sha256), sha1: toHex(sha1) }
}

/** Normalises a pasted hash for comparison: case, spaces and colons ignored. */
export function normaliseHash(value: string): string {
  return value.replace(/[\s:]/g, '').toLowerCase()
}

/** True when the pasted value equals the computed hash, in any letter case. */
export function hashMatches(computed: string, expected: string): boolean {
  const pasted = normaliseHash(expected)
  return pasted.length > 0 && pasted === normaliseHash(computed)
}

/** Which of the file's hashes the pasted value matches, if any. */
export function findMatchingHash(hashes: FileHashes, expected: string): 'SHA-256' | 'SHA-1' | null {
  if (hashMatches(hashes.sha256, expected)) return 'SHA-256'
  if (hashMatches(hashes.sha1, expected)) return 'SHA-1'
  return null
}

/** The plain-text report saved from step 3. */
export function hashReportText(fileName: string, size: number, hashes: FileHashes): string {
  return [
    `File: ${fileName}`,
    `Size: ${size} bytes`,
    '',
    `SHA-256: ${hashes.sha256}`,
    `SHA-1: ${hashes.sha1}`,
    '',
    'Computed on your device with File Hash. The file was never uploaded.',
    '',
  ].join('\n')
}
