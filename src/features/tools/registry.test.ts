import { describe, expect, it } from 'vitest'
import { TOOLS } from './registry'

describe('tool registry', () => {
  it('has 18 real tools for v1, including the password tools after the qpdf spike passed', () => {
    expect(TOOLS).toHaveLength(18)
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
  })

  it('every tool declares accepted types and an outcome', () => {
    for (const tool of TOOLS) {
      expect(tool.accept.length).toBeGreaterThan(0)
      expect(tool.outcome.length).toBeGreaterThan(10)
    }
  })
})
