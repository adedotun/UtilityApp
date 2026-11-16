import { renderBlocksToPdf, type PdfBlock, type PdfRun } from '../word/process'
import { decodeEntities } from '../../../lib/entities'

export { decodeEntities }

/** Marked turns the Markdown into HTML, on demand, only for this tool. */
export async function markdownToHtml(markdown: string): Promise<string> {
  const { marked } = await import('marked')
  return await marked.parse(markdown, { gfm: true })
}

interface BlockBuilder {
  kind: 'heading' | 'paragraph' | 'listItem' | 'quote'
  level: number
  ordered: boolean
  index: number
  depth: number
  runs: PdfRun[]
}

function appendRun(builder: BlockBuilder, text: string, style: { bold: boolean; italic: boolean; mono: boolean }) {
  if (!text) return
  const last = builder.runs[builder.runs.length - 1]
  if (last && !!last.bold === style.bold && !!last.italic === style.italic && !!last.mono === style.mono) {
    last.text += text
  } else {
    builder.runs.push({ text, bold: style.bold || undefined, italic: style.italic || undefined, mono: style.mono || undefined })
  }
}

/**
 * Turns the HTML Marked produces into the shared renderer's blocks. A small
 * hand-rolled scanner rather than a DOM parser, so the exact same code runs
 * in the browser and in the unit tests. It understands the elements Marked
 * emits: headings, paragraphs, lists, blockquotes, code blocks, tables
 * (rows become lines, cells separated), rules, and strong/em/code inline.
 */
export function htmlToBlocks(html: string): PdfBlock[] {
  const blocks: PdfBlock[] = []
  const listStack: Array<{ ordered: boolean; counter: number }> = []
  let current: BlockBuilder | null = null
  let bold = 0, italic = 0, mono = 0
  let quoteDepth = 0
  let preText: string | null = null
  let skipDepth = 0
  let cellCount = 0

  const flush = () => {
    if (!current) return
    const text = current.runs.map((r) => r.text).join('').trim()
    if (text) {
      if (current.kind === 'heading') blocks.push({ type: 'heading', level: current.level, runs: current.runs })
      else if (current.kind === 'listItem') blocks.push({ type: 'listItem', runs: current.runs, ordered: current.ordered, index: current.index, depth: current.depth })
      else if (current.kind === 'quote') blocks.push({ type: 'quote', runs: current.runs })
      else blocks.push({ type: 'paragraph', runs: current.runs })
    }
    current = null
  }
  const startBlock = (kind: BlockBuilder['kind'], extra: Partial<BlockBuilder> = {}) => {
    flush()
    current = { kind, level: 0, ordered: false, index: 0, depth: 0, runs: [], ...extra }
  }

  const parts = html.split(/(<[^>]+>)/g)
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('<')) {
      const match = part.match(/^<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/)
      if (!match) continue
      const tag = match[1].toLowerCase()
      const closing = part.startsWith('</')
      if (tag === 'script' || tag === 'style') { skipDepth += closing ? -1 : 1; continue }
      if (skipDepth > 0) continue
      if (preText !== null) {
        if (tag === 'pre' && closing) {
          blocks.push({ type: 'code', text: preText.replace(/\n$/, '') })
          preText = null
        }
        continue
      }
      switch (tag) {
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
          if (closing) flush()
          else startBlock('heading', { level: Number(tag[1]) })
          break
        case 'p':
          if (closing) flush()
          else startBlock(quoteDepth > 0 ? 'quote' : 'paragraph')
          break
        case 'ul': case 'ol':
          if (closing) listStack.pop()
          else { flush(); listStack.push({ ordered: tag === 'ol', counter: 0 }) }
          break
        case 'li': {
          if (closing) { flush(); break }
          const top = listStack[listStack.length - 1]
          if (top?.ordered) top.counter++
          startBlock('listItem', {
            ordered: !!top?.ordered,
            index: top?.ordered ? top.counter : 0,
            depth: Math.max(0, listStack.length - 1),
          })
          break
        }
        case 'blockquote':
          quoteDepth += closing ? -1 : 1
          if (closing) flush()
          break
        case 'pre':
          if (!closing) { flush(); preText = '' }
          break
        case 'hr':
          flush()
          blocks.push({ type: 'rule' })
          break
        case 'br':
          if (current) appendRun(current, ' ', { bold: bold > 0, italic: italic > 0, mono: mono > 0 })
          break
        case 'tr':
          if (closing) flush()
          else { startBlock('paragraph'); cellCount = 0 }
          break
        case 'td': case 'th':
          if (!closing && current) {
            if (cellCount > 0) appendRun(current, ' | ', { bold: false, italic: false, mono: false })
            cellCount++
            if (tag === 'th') bold++
          } else if (closing && tag === 'th') bold = Math.max(0, bold - 1)
          break
        case 'strong': case 'b': bold += closing ? -1 : 1; break
        case 'em': case 'i': italic += closing ? -1 : 1; break
        case 'code': mono += closing ? -1 : 1; break
        default: break
      }
      continue
    }
    // Text node
    const text = decodeEntities(part)
    if (preText !== null) { preText += text; continue }
    if (skipDepth > 0) continue
    if (!current) {
      if (!text.trim()) continue
      startBlock(quoteDepth > 0 ? 'quote' : 'paragraph')
    }
    appendRun(current!, text.replace(/\s+/g, ' '), { bold: bold > 0, italic: italic > 0, mono: mono > 0 })
  }
  flush()
  return blocks
}

/**
 * Markdown to PDF: Marked parses to HTML, htmlToBlocks structures it, and
 * the shared renderer in word/process.ts (the one Word to PDF's text
 * renderer lives beside) lays it out. Headings, lists, quotes and code
 * survive; images and pixel-exact styling do not, and the tool says so.
 */
export async function markdownToPdf(markdown: string, title: string): Promise<Uint8Array> {
  if (!markdown.trim()) throw new Error('There is no Markdown text to convert yet. Add a file or paste some text first.')
  const html = await markdownToHtml(markdown)
  const blocks = htmlToBlocks(html)
  if (!blocks.length) throw new Error('Nothing readable could be found in this Markdown.')
  return renderBlocksToPdf(blocks, title)
}
