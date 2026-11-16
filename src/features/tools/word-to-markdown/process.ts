import { loadMammoth, mammothInput } from '../word/mammoth-input'

export interface WordToMarkdownResult {
  markdown: string
  /** The intermediate HTML Mammoth produced, offered as a second download. */
  html: string
}

/**
 * Word to Markdown in two local steps: Mammoth turns the .docx into clean
 * HTML (the same conversion View Word previews), then Turndown turns that
 * HTML into Markdown. Both libraries load on demand, only for this tool.
 */
export async function wordToMarkdown(buffer: ArrayBuffer): Promise<WordToMarkdownResult> {
  const mammoth = await loadMammoth()
  let html: string
  try {
    const result = await mammoth.convertToHtml(mammothInput(buffer))
    html = result.value
  } catch {
    throw new Error('This file could not be read as a Word document. It may be damaged, or an older .doc file rather than .docx.')
  }
  if (!html.replace(/<[^>]+>/g, '').trim()) {
    throw new Error('This document appears to contain no readable text.')
  }
  const TurndownService = (await import('turndown')).default
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  })
  const markdown = `${turndown.turndown(html).trim()}\n`
  return { markdown, html }
}
