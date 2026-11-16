/**
 * Local, deterministic parser for plain-English split descriptions.
 *
 * This is deliberately NOT an AI call: PDF Tweaks never uploads files, so the
 * prompt is understood on the device by the grammar below. It handles page
 * maths (ranges, first/last, rest, odd/even, every N, into N files, split
 * after, except) and content requests ("pages that mention X"), which the
 * tool resolves against the PDF's own text layer locally.
 *
 * Every result is shown to the user as trays of pages before anything is
 * split, and pages can be dragged between trays to fix misunderstandings.
 */

export type PromptResult =
  | { kind: 'groups'; groups: number[][]; unassigned: number[]; explanation: string }
  | { kind: 'content'; query: string }

const allPages = (count: number) => Array.from({ length: count }, (_, i) => i + 1)
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

function checkPage(n: number, count: number, phrase: string) {
  if (n > count) throw new Error(`"${phrase}" mentions page ${n}, which is past the last page, which is page ${count}.`)
  if (n < 1) throw new Error(`"${phrase}" mentions page ${n}. Page numbers start at page 1.`)
}

/** Extracts page numbers and ranges from a fragment like "pages 2 and 6" or "1-3, 5". */
function extractPages(fragment: string, count: number, phrase: string): number[] {
  const pages = new Set<number>()
  const rest = fragment.replace(/(\d+)\s*(?:-|–|to)\s*(\d+)/g, (_m, a: string, b: string) => {
    const start = parseInt(a, 10)
    const end = parseInt(b, 10)
    checkPage(start, count, phrase)
    checkPage(end, count, phrase)
    if (end < start) throw new Error(`"${phrase}" is not a valid range. The first page must come before the last.`)
    range(start, end).forEach((p) => pages.add(p))
    return ' '
  })
  for (const m of rest.matchAll(/\d+/g)) {
    const n = parseInt(m[0], 10)
    checkPage(n, count, phrase)
    pages.add(n)
  }
  return [...pages].sort((a, b) => a - b)
}

/** "page 5" / "pages 1-3" / "pages 1, 4, 6" for one group of pages. */
export function describePageList(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b)
  if (sorted.length === 0) return 'no pages'
  const contiguous = sorted.every((p, i) => i === 0 || p === sorted[i - 1] + 1)
  if (sorted.length === 1) return `page ${sorted[0]}`
  if (contiguous) return `pages ${sorted[0]}-${sorted[sorted.length - 1]}`
  return `pages ${sorted.join(', ')}`
}

/** "File 1: pages 1-3 · File 2: page 5" style summary of a grouping. */
export function describeGroups(groups: number[][], unassigned: number[]): string {
  const describePages = describePageList
  const parts = groups.filter((g) => g.length > 0).map((g, i) => `File ${i + 1}: ${describePages(g)}`)
  if (unassigned.length > 0) parts.push(`${describePages(unassigned)} ${unassigned.length === 1 ? 'is' : 'are'} not in any file`)
  return parts.join(' · ')
}

function groupsResult(groups: number[][], count: number): PromptResult {
  const used = new Set(groups.flat())
  const unassigned = allPages(count).filter((p) => !used.has(p))
  const clean = groups.filter((g) => g.length > 0)
  if (clean.length === 0) throw new Error('That description does not put any page in a file. Try "split after page 3" or "1-3, 5-7".')
  return { kind: 'groups', groups: clean, unassigned, explanation: describeGroups(clean, unassigned) }
}

function balancedGroups(count: number, files: number): number[][] {
  const n = Math.min(files, count)
  const base = Math.floor(count / n)
  const extra = count % n
  const groups: number[][] = []
  let next = 1
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0)
    groups.push(range(next, next + size - 1))
    next += size
  }
  return groups
}

function chunksOf(count: number, size: number): number[][] {
  const groups: number[][] = []
  for (let i = 1; i <= count; i += size) groups.push(range(i, Math.min(i + size - 1, count)))
  return groups
}

/** Parses one comma/then-separated clause into a set of not-yet-used pages. */
function parseClause(clause: string, count: number, used: Set<number>, raw: string): number[] {
  const c = clause
    .replace(/^(?:please\s+)?(?:then\s+)?(?:split\s+)?(?:put\s+|make\s+|keep\s+)?/, '')
    .replace(/\s+(?:in one file|into one file|as one file|in a file|into a single file|alone|separately|together|in another file|in a separate file|in its own file)$/, '')
    .trim()
  const take = (pages: number[], label: string) => {
    const overlap = pages.filter((p) => used.has(p))
    if (overlap.length > 0) throw new Error(`"${label}" includes ${overlap.length === 1 ? `page ${overlap[0]}` : `pages ${overlap.join(', ')}`}, already in an earlier file. Each page can only be in one file — you can drag pages between files after applying.`)
    pages.forEach((p) => used.add(p))
    return pages
  }
  if (/^(?:the\s+)?rest$/.test(c) || /^(?:the\s+)?remaining(?:\s+pages)?$/.test(c) || /^everything else$/.test(c)) {
    const left = allPages(count).filter((p) => !used.has(p))
    if (left.length === 0) throw new Error('There are no pages left for "the rest" — the earlier parts already used every page.')
    return take(left, clause)
  }
  const first = c.match(/^(?:the\s+)?first\s+(\d+)\s+pages?$/)
  if (first) { const n = parseInt(first[1], 10); checkPage(n, count, raw); return take(range(1, n), clause) }
  if (/^(?:the\s+)?first\s+page$/.test(c)) return take([1], clause)
  const last = c.match(/^(?:the\s+)?last\s+(\d+)\s+pages?$/)
  if (last) { const n = parseInt(last[1], 10); checkPage(n, count, raw); return take(range(count - n + 1, count), clause) }
  if (/^(?:the\s+)?last\s+page$/.test(c)) return take([count], clause)
  if (/^odd\s+pages?$/.test(c)) return take(allPages(count).filter((p) => p % 2 === 1), clause)
  if (/^even\s+pages?$/.test(c)) return take(allPages(count).filter((p) => p % 2 === 0), clause)
  const looksLikePages = (/^(?:the\s+)?pages?\s+[\d\s,\-–toand]+$/.test(c) && /\d/.test(c)) || /^\d+\s*(?:-|–|to)\s*\d+$/.test(c) || /^\d+$/.test(c)
  if (looksLikePages) {
    return take(extractPages(c, count, raw), clause)
  }
  throw new Error(`I do not understand "${clause}". Try things like "1-3", "first 3 pages", "the rest", "odd pages", or "split after page 4".`)
}

export function parseSplitPrompt(rawInput: string, pageCount: number): PromptResult {
  if (pageCount < 1) throw new Error('Add a PDF first, then describe your split.')
  const raw = rawInput.trim()
  if (!raw) throw new Error('Describe your split, for example "split after page 3" or "first 3 pages, then the rest".')
  const s = raw.toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '').trim()
  const count = pageCount

  // Content requests: "pages that mention "invoice total"", 'the page with "signed"'.
  const quoted = s.match(/["“]([^"”]+)["”]/)
  const contentWords = /^(?:the\s+)?pages?\s+(?:that\s+)?(?:mention|mentions|mentioning|contain|contains|containing|include|includes|including|say|says|with|about)\s+(.+)$/.exec(s)
    ?? /^find\s+(?:the\s+)?pages?\s+(?:with|mentioning|containing)\s+(.+)$/.exec(s)
  if (quoted && /\bpages?\b/.test(s) && /(mention|contain|with|say|find)/.test(s)) {
    return { kind: 'content', query: quoted[1].trim() }
  }
  if (contentWords) {
    const query = contentWords[1].replace(/^["']|["']$/g, '').trim()
    if (query && !/^[\d\s,\-–toand]+$/.test(query)) return { kind: 'content', query }
  }

  // Every page on its own.
  if (/^(?:split\s+)?(?:every|each)\s+page(?:\s+on its own|\s+separately|\s+in its own file)?$/.test(s) || s === 'single pages' || s === 'split into single pages') {
    return groupsResult(allPages(count).map((p) => [p]), count)
  }

  // Odd in one file, even in another.
  if (/\bodd\b/.test(s) && /\beven\b/.test(s)) {
    return groupsResult([allPages(count).filter((p) => p % 2 === 1), allPages(count).filter((p) => p % 2 === 0)], count)
  }

  // Every N pages / groups of N.
  const everyN = s.match(/^(?:split\s+)?every\s+(\d+)\s+pages?$/) ?? s.match(/^(?:split\s+)?(?:in\s+)?(?:groups|chunks|files)\s+of\s+(\d+)(?:\s+pages)?$/)
  if (everyN) {
    const n = parseInt(everyN[1], 10)
    if (n < 1) throw new Error('The group size must be at least 1 page.')
    return groupsResult(chunksOf(count, n), count)
  }

  // Into N files.
  const intoN = s.match(/^(?:split\s+)?(?:in)?to\s+(\d+)\s+(?:equal\s+)?(?:files|parts)$/) ?? s.match(/^(\d+)\s+(?:equal\s+)?files$/)
  if (intoN) {
    const n = parseInt(intoN[1], 10)
    if (n < 1) throw new Error('The number of files must be at least 1.')
    if (n > count) throw new Error(`This document has ${count} ${count === 1 ? 'page' : 'pages'}, so it cannot be split into ${n} files.`)
    return groupsResult(balancedGroups(count, n), count)
  }

  // Split after page X (and after page Y).
  if (/after\s+(?:pages?\s+)?\d+/.test(s)) {
    const cuts: number[] = []
    const leftover = s.replace(/after\s+(?:pages?\s+)?(\d+)/g, (_m, n: string) => { cuts.push(parseInt(n, 10)); return ' ' })
    // "split after pages 3 and 6": the second cut has no "after" of its own.
    const afterList = s.match(/^(?:split\s+)?after\s+(?:pages?\s+)?([\d\s,]+(?:\s+and\s+[\d\s,]+)*)$/)
    if (afterList) {
      cuts.length = 0
      for (const m of afterList[1].matchAll(/\d+/g)) cuts.push(parseInt(m[0], 10))
    }
    if ((/^[\s,]*(?:split|and|pages?)*[\s,]*$/.test(leftover) || afterList) && cuts.length > 0) {
      const sorted = [...new Set(cuts)].sort((a, b) => a - b)
      for (const cut of sorted) {
        checkPage(cut, count, raw)
        if (cut === count) throw new Error(`"After page ${cut}" is the last page, so there is nothing after it to split off.`)
      }
      const groups: number[][] = []
      let start = 1
      for (const cut of sorted) { groups.push(range(start, cut)); start = cut + 1 }
      groups.push(range(start, count))
      return groupsResult(groups, count)
    }
  }

  // Everything except pages X and Y.
  const except = s.match(/^(?:everything|all\s+pages|the\s+whole\s+(?:document|file))(?:\s+pages)?(?:,)?\s+except\s+(?:pages?\s+)?(.+)$/)
  if (except) {
    const excluded = extractPages(except[1], count, raw)
    return groupsResult([allPages(count).filter((p) => !excluded.includes(p))], count)
  }

  // General clause list: "first 3 pages, then the rest" / "1-3, 5-7" / "page 5 alone, rest together".
  const clauses = s.split(/\s*(?:,|;|\band then\b|\bthen\b)\s*/).map((c) => c.trim()).filter(Boolean)
  if (clauses.length === 0) throw new Error('Describe your split, for example "split after page 3".')
  const used = new Set<number>()
  const groups = clauses.map((clause) => parseClause(clause, count, used, raw))
  return groupsResult(groups, count)
}

/** 1-based pages whose extracted text contains the query (case and spacing insensitive). */
export function findPagesWithText(pageTexts: string[], query: string): number[] {
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()
  const q = norm(query)
  if (!q) return []
  const matches: number[] = []
  pageTexts.forEach((text, i) => { if (norm(text).includes(q)) matches.push(i + 1) })
  return matches
}

/** Groups for a content search: matching pages in one file, the rest in another. */
export function contentGroups(matches: number[], pageCount: number): number[][] {
  const rest = allPages(pageCount).filter((p) => !matches.includes(p))
  return [matches, rest].filter((g) => g.length > 0)
}
