import { describe, expect, it } from 'vitest'
import { findMatchingHash, hashData, hashMatches, hashReportText } from './process'

// The published FIPS 180 test vectors for the message "abc".
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const ABC_SHA1 = 'a9993e364706816aba3e25717850c26c9cd0d89d'

describe('hashData', () => {
  it('produces the known SHA-256 and SHA-1 of "abc"', async () => {
    const hashes = await hashData(new TextEncoder().encode('abc'))
    expect(hashes.sha256).toBe(ABC_SHA256)
    expect(hashes.sha1).toBe(ABC_SHA1)
  })

  it('changes completely when one byte changes', async () => {
    const a = await hashData(new TextEncoder().encode('abc'))
    const b = await hashData(new TextEncoder().encode('abd'))
    expect(b.sha256).not.toBe(a.sha256)
    expect(b.sha1).not.toBe(a.sha1)
  })
})

describe('hash comparison', () => {
  it('matches the same hex in upper case, with spaces', () => {
    expect(hashMatches(ABC_SHA256, ABC_SHA256.toUpperCase())).toBe(true)
    expect(hashMatches(ABC_SHA256, `  ${ABC_SHA256} `)).toBe(true)
    expect(hashMatches(ABC_SHA256, ABC_SHA1)).toBe(false)
    expect(hashMatches(ABC_SHA256, '')).toBe(false)
  })

  it('finds which of the two hashes a pasted value matches', async () => {
    const hashes = await hashData(new TextEncoder().encode('abc'))
    expect(findMatchingHash(hashes, ABC_SHA256.toUpperCase())).toBe('SHA-256')
    expect(findMatchingHash(hashes, ABC_SHA1)).toBe('SHA-1')
    expect(findMatchingHash(hashes, 'deadbeef')).toBeNull()
  })
})

describe('hashReportText', () => {
  it('names the file and carries both hashes', async () => {
    const hashes = await hashData(new TextEncoder().encode('abc'))
    const report = hashReportText('letter.pdf', 1234, hashes)
    expect(report).toContain('File: letter.pdf')
    expect(report).toContain(`SHA-256: ${ABC_SHA256}`)
    expect(report).toContain(`SHA-1: ${ABC_SHA1}`)
  })
})
