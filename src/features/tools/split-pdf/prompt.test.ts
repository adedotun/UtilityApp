import { describe, expect, it } from 'vitest'
import { contentGroups, describeGroups, findPagesWithText, parseSplitPrompt, type PromptResult } from './prompt'

const groupsOf = (r: PromptResult) => {
  if (r.kind !== 'groups') throw new Error('expected groups')
  return r
}

describe('parseSplitPrompt — ranges and clauses', () => {
  it('parses plain ranges as one file per range', () => {
    const r = groupsOf(parseSplitPrompt('1-3, 5-7', 10))
    expect(r.groups).toEqual([[1, 2, 3], [5, 6, 7]])
    expect(r.unassigned).toEqual([4, 8, 9, 10])
  })
  it('parses "first 3 pages, then the rest"', () => {
    expect(groupsOf(parseSplitPrompt('first 3 pages, then the rest', 6)).groups).toEqual([[1, 2, 3], [4, 5, 6]])
  })
  it('parses "page 5 alone, rest together"', () => {
    expect(groupsOf(parseSplitPrompt('page 5 alone, rest together', 6)).groups).toEqual([[5], [1, 2, 3, 4, 6]])
  })
  it('parses "pages 2 and 6" as one file', () => {
    expect(groupsOf(parseSplitPrompt('pages 2 and 6, then the rest', 6)).groups).toEqual([[2, 6], [1, 3, 4, 5]])
  })
  it('parses "last 2 pages, then the rest"', () => {
    expect(groupsOf(parseSplitPrompt('last 2 pages, then the rest', 7)).groups).toEqual([[6, 7], [1, 2, 3, 4, 5]])
  })
  it('rejects overlapping clauses with a specific message', () => {
    expect(() => parseSplitPrompt('first 3 pages, pages 2-4', 8)).toThrow('already in an earlier file')
  })
  it('rejects pages past the end', () => {
    expect(() => parseSplitPrompt('page 99', 10)).toThrow('page 10')
  })
  it('rejects words it does not understand, naming the clause', () => {
    expect(() => parseSplitPrompt('banana', 10)).toThrow('do not understand "banana"')
  })
  it('rejects an empty prompt', () => {
    expect(() => parseSplitPrompt('   ', 10)).toThrow('Describe your split')
  })
})

describe('parseSplitPrompt — whole-phrase patterns', () => {
  it('splits after one page', () => {
    expect(groupsOf(parseSplitPrompt('split after page 4', 7)).groups).toEqual([[1, 2, 3, 4], [5, 6, 7]])
  })
  it('splits after several pages', () => {
    expect(groupsOf(parseSplitPrompt('split after pages 3 and 6', 8)).groups).toEqual([[1, 2, 3], [4, 5, 6], [7, 8]])
  })
  it('refuses to split after the last page', () => {
    expect(() => parseSplitPrompt('split after page 10', 10)).toThrow('last page')
  })
  it('splits every page on its own', () => {
    expect(groupsOf(parseSplitPrompt('every page on its own', 3)).groups).toEqual([[1], [2], [3]])
  })
  it('splits every N pages', () => {
    expect(groupsOf(parseSplitPrompt('every 2 pages', 5)).groups).toEqual([[1, 2], [3, 4], [5]])
    expect(groupsOf(parseSplitPrompt('groups of 3', 7)).groups).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })
  it('splits into N balanced files', () => {
    expect(groupsOf(parseSplitPrompt('split into 3 files', 10)).groups.map((g) => g.length)).toEqual([4, 3, 3])
  })
  it('refuses more files than pages', () => {
    expect(() => parseSplitPrompt('split into 12 files', 10)).toThrow('cannot be split into 12 files')
  })
  it('splits odd and even pages', () => {
    expect(groupsOf(parseSplitPrompt('odd pages in one file, even pages in another', 6)).groups).toEqual([[1, 3, 5], [2, 4, 6]])
  })
  it('keeps everything except the named pages, which stay unassigned', () => {
    const r = groupsOf(parseSplitPrompt('everything except pages 2 and 6', 7))
    expect(r.groups).toEqual([[1, 3, 4, 5, 7]])
    expect(r.unassigned).toEqual([2, 6])
  })
})

describe('parseSplitPrompt — content requests', () => {
  it('recognises a quoted content request', () => {
    expect(parseSplitPrompt('pages that mention "invoice total"', 10)).toEqual({ kind: 'content', query: 'invoice total' })
  })
  it('recognises an unquoted content request', () => {
    expect(parseSplitPrompt('pages containing invoice', 10)).toEqual({ kind: 'content', query: 'invoice' })
  })
  it('does not treat a numeric "pages with" phrase as content', () => {
    expect(groupsOf(parseSplitPrompt('pages 1-3, 5', 8)).groups).toEqual([[1, 2, 3], [5]])
  })
})

describe('findPagesWithText and contentGroups', () => {
  const texts = ['Hello world', 'Invoice   Total due: 50', 'Nothing here', 'another INVOICE total']
  it('finds pages case and spacing insensitively', () => {
    expect(findPagesWithText(texts, 'invoice total')).toEqual([2, 4])
  })
  it('finds nothing for an absent phrase', () => {
    expect(findPagesWithText(texts, 'appendix')).toEqual([])
  })
  it('groups matches first, the rest second', () => {
    expect(contentGroups([2, 4], 5)).toEqual([[2, 4], [1, 3, 5]])
    expect(contentGroups([1, 2], 2)).toEqual([[1, 2]])
  })
})

describe('describeGroups', () => {
  it('describes contiguous, single and scattered groups', () => {
    expect(describeGroups([[1, 2, 3], [5], [2 - 1, 4, 6]], [])).toContain('File 1: pages 1-3')
    expect(describeGroups([[5]], [])).toBe('File 1: page 5')
    expect(describeGroups([[1, 4, 6]], [])).toBe('File 1: pages 1, 4, 6')
  })
  it('notes unassigned pages', () => {
    expect(describeGroups([[1, 2]], [3])).toContain('page 3 is not in any file')
  })
})
