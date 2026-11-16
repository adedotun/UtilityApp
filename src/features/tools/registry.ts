import {
  ArrowsClockwise,
  Crop,
  FileDoc,
  FilePdf,
  Files,
  Image,
  Images,
  Info,
  ListNumbers,
  Lock,
  LockOpen,
  Notebook,
  PenNib,
  PencilSimpleLine,
  Scissors,
  Stack,
  Stamp,
  type Icon,
} from '@phosphor-icons/react'

export type ToolCategory = 'convert' | 'organise' | 'edit-sign' | 'optimise' | 'security'

export interface ToolDef {
  slug: string
  name: string
  category: ToolCategory
  icon: Icon
  /** One line outcome shown on cards and the tool page. Sentence case, no filler. */
  outcome: string
  accept: string[]
  multiple: boolean
  /** Which rebuild phase implements this tool (see rebuild plan). */
  phase: 2 | 3 | 4 | 5
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  convert: 'Convert',
  organise: 'Organise',
  'edit-sign': 'Edit and sign',
  optimise: 'Optimise',
  security: 'Security',
}

/**
 * Single source of truth for every tool.
 * Home page, search, routing and sitemap all read from this list.
 * Only tools that actually work belong here — no placeholder entries.
 * Bookmarks is deferred and password tools are spike-gated, so neither appears.
 */
export const TOOLS: ToolDef[] = [
  // Convert — Phase 2 / 3
  { slug: 'images-to-pdf', name: 'Images to PDF', category: 'convert', icon: Images, outcome: 'Turn images into one PDF, in the order you choose.', accept: ['image/*'], multiple: true, phase: 2 },
  { slug: 'pdf-to-images', name: 'PDF to images', category: 'convert', icon: Image, outcome: 'Save each page of a PDF as a PNG or JPEG image.', accept: ['application/pdf'], multiple: false, phase: 2 },
  { slug: 'word-to-pdf', name: 'Word to PDF', category: 'convert', icon: FileDoc, outcome: 'Convert a Word document to PDF. Complex layouts may lose some formatting.', accept: ['.docx'], multiple: true, phase: 3 },
  { slug: 'view-word', name: 'View Word', category: 'convert', icon: Notebook, outcome: 'Read a Word document in your browser, without Microsoft Word.', accept: ['.docx'], multiple: false, phase: 3 },

  // Organise — Phase 2 / 3
  { slug: 'merge-pdf', name: 'Merge PDF', category: 'organise', icon: Files, outcome: 'Combine PDFs into one file, in the order you choose.', accept: ['application/pdf'], multiple: true, phase: 2 },
  { slug: 'split-pdf', name: 'Split PDF', category: 'organise', icon: Scissors, outcome: 'Describe the split in plain words, then drag pages between files to adjust it.', accept: ['application/pdf'], multiple: false, phase: 2 },
  { slug: 'rotate-pdf', name: 'Rotate PDF', category: 'organise', icon: ArrowsClockwise, outcome: 'Rotate pages by 90, 180 or 270 degrees.', accept: ['application/pdf'], multiple: false, phase: 2 },
  { slug: 'extract-pages', name: 'Extract pages', category: 'organise', icon: FilePdf, outcome: 'Pull selected pages out into a new PDF.', accept: ['application/pdf'], multiple: false, phase: 2 },
  { slug: 'reorder-pages', name: 'Reorder pages', category: 'organise', icon: Stack, outcome: 'Drag pages into a new order and save the result.', accept: ['application/pdf'], multiple: false, phase: 3 },
  { slug: 'edit-metadata', name: 'Edit metadata', category: 'organise', icon: Info, outcome: 'See and change a PDF title, author, subject and keywords.', accept: ['application/pdf'], multiple: false, phase: 2 },

  // Edit and sign — Phase 3 / 4
  { slug: 'sign-pdf', name: 'Sign PDF', category: 'edit-sign', icon: PenNib, outcome: 'Draw or type a signature, place it, and save the signed PDF.', accept: ['application/pdf'], multiple: false, phase: 4 },
  { slug: 'edit-pdf', name: 'Edit PDF', category: 'edit-sign', icon: PencilSimpleLine, outcome: 'Highlight, redact, draw, and add shapes, text and images.', accept: ['application/pdf'], multiple: false, phase: 4 },
  { slug: 'watermark', name: 'Add watermark', category: 'edit-sign', icon: Stamp, outcome: 'Add text or a logo across every page, at the opacity you set.', accept: ['application/pdf'], multiple: false, phase: 3 },
  { slug: 'page-numbers', name: 'Add page numbers', category: 'edit-sign', icon: ListNumbers, outcome: 'Add page numbers in the format and position you choose.', accept: ['application/pdf'], multiple: false, phase: 2 },
  { slug: 'crop-pdf', name: 'Crop PDF', category: 'edit-sign', icon: Crop, outcome: 'Trim margins or unwanted edges from pages, visually.', accept: ['application/pdf'], multiple: false, phase: 4 },

  // Security — Phase 5 (qpdf wasm spike passed: real 256-bit AES, tested)
  { slug: 'password-protect', name: 'Password protect', category: 'security', icon: Lock, outcome: 'Encrypt a PDF with a password, using 256-bit AES.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'remove-password', name: 'Remove password', category: 'security', icon: LockOpen, outcome: 'Remove the password from a PDF when you know the current password.', accept: ['application/pdf'], multiple: false, phase: 5 },

  // Optimise — Phase 3
  { slug: 'compress-pdf', name: 'Compress PDF', category: 'optimise', icon: FilePdf, outcome: 'Shrink a PDF for email, with the before and after size shown.', accept: ['application/pdf'], multiple: false, phase: 3 },
]

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug)
}

export function toolsByCategory(category: ToolCategory): ToolDef[] {
  return TOOLS.filter((t) => t.category === category)
}
