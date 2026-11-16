import {
  Archive,
  ArrowsClockwise,
  ArrowsIn,
  ArrowsLeftRight,
  Article,
  BookOpen,
  BookOpenText,
  BookmarkSimple,
  Broom,
  CircleHalf,
  CornersOut,
  Crop,
  Drop,
  EyeSlash,
  FileCsv,
  FileDashed,
  FileDoc,
  FilePdf,
  FilePlus,
  FilePpt,
  FileTxt,
  FileXls,
  FileZip,
  Files,
  Fingerprint,
  FirstAid,
  FolderOpen,
  FrameCorners,
  GitDiff,
  GridFour,
  Image,
  ImageSquare,
  Images,
  Info,
  ListChecks,
  ListNumbers,
  Lock,
  LockOpen,
  MarkdownLogo,
  Notebook,
  PenNib,
  PencilSimpleLine,
  QrCode,
  Scan,
  Scissors,
  ShareNetwork,
  ShieldCheck,
  Stack,
  StackSimple,
  Stamp,
  Table,
  TextAa,
  Trash,
  type Icon,
} from '@phosphor-icons/react'

export type ToolCategory = 'convert' | 'images' | 'documents' | 'files' | 'organise' | 'edit-sign' | 'optimise' | 'security'

export interface ToolDef {
  slug: string
  name: string
  category: ToolCategory
  icon: Icon
  /** One line outcome shown on cards and the tool page. Sentence case, no filler. */
  outcome: string
  accept: string[]
  multiple: boolean
  /**
   * Batch mode: the tool's options are file-independent, so with several
   * files added the same process runs over each one (see shared/batch.ts).
   * Only meaningful when multiple is true. Page-selection and interactive
   * tools are deliberately never flagged.
   */
  batch?: boolean
  /** Which rebuild phase implements this tool (see rebuild plan). */
  phase: 2 | 3 | 4 | 5
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  convert: 'Convert',
  images: 'Images',
  documents: 'Documents',
  files: 'Files',
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
  { slug: 'extract-images', name: 'Extract images', category: 'convert', icon: ImageSquare, outcome: 'Pull the original images out of a PDF as PNG files, at their stored size.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'pdf-to-text', name: 'PDF to text', category: 'convert', icon: FileTxt, outcome: 'Copy the text out of a PDF into a plain text file, one section per page.', accept: ['application/pdf'], multiple: true, batch: true, phase: 5 },
  { slug: 'pdf-to-word', name: 'PDF to Word', category: 'convert', icon: FileDoc, outcome: 'Rebuild a PDF as an editable Word document. Layout is reconstructed, not identical.', accept: ['application/pdf'], multiple: true, batch: true, phase: 5 },
  { slug: 'pdf-to-excel', name: 'PDF to Excel', category: 'convert', icon: FileXls, outcome: 'Pull the tables out of a PDF into a spreadsheet or CSV. Detection is positional and imperfect on complex layouts.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'pdf-to-powerpoint', name: 'PDF to PowerPoint', category: 'convert', icon: FilePpt, outcome: 'Turn each page into a slide. Slides are pictures of the pages, so the text is not editable.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'ocr-pdf', name: 'OCR PDF', category: 'convert', icon: Scan, outcome: 'Read the words in scanned pages and save a searchable PDF or the text, recognised on your device.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'word-to-pdf', name: 'Word to PDF', category: 'convert', icon: FileDoc, outcome: 'Convert a Word document to PDF. Complex layouts may lose some formatting.', accept: ['.docx'], multiple: true, phase: 3 },
  { slug: 'view-word', name: 'View Word', category: 'convert', icon: Notebook, outcome: 'Read a Word document in your browser, without Microsoft Word.', accept: ['.docx'], multiple: false, phase: 3 },

  // Images — Phase 5 (Wave 5: the first tools beyond PDF; all canvas-local)
  { slug: 'convert-image', name: 'Convert image', category: 'images', icon: ArrowsLeftRight, outcome: 'Convert PNG, JPEG and WebP images between formats, and HEIC photos to JPEG where your browser can decode them.', accept: ['image/*', '.heic', '.heif'], multiple: true, batch: true, phase: 5 },
  { slug: 'compress-image', name: 'Compress image', category: 'images', icon: ArrowsIn, outcome: 'Shrink JPEG, PNG and WebP images for sharing, with the before and after size for every file. If a file is already smaller, it is kept unchanged.', accept: ['image/png', 'image/jpeg', 'image/webp'], multiple: true, batch: true, phase: 5 },
  { slug: 'resize-image', name: 'Resize image', category: 'images', icon: CornersOut, outcome: 'Resize images by percentage or to exact pixel dimensions, keeping the proportions if you want.', accept: ['image/png', 'image/jpeg', 'image/webp'], multiple: true, batch: true, phase: 5 },
  { slug: 'exif-tools', name: 'Photo data (EXIF)', category: 'images', icon: ShieldCheck, outcome: 'See the camera, date and GPS data hidden in a photo, and save a copy with all of it removed.', accept: ['image/jpeg', 'image/png'], multiple: false, phase: 5 },
  { slug: 'image-to-text', name: 'Image to text', category: 'images', icon: TextAa, outcome: 'Read the words in a photo or screenshot and save them as a text file, recognised on your device.', accept: ['image/png', 'image/jpeg', 'image/webp'], multiple: false, phase: 5 },
  { slug: 'watermark-image', name: 'Watermark image', category: 'images', icon: Drop, outcome: 'Add a text watermark to images, at the position and opacity you set.', accept: ['image/png', 'image/jpeg', 'image/webp'], multiple: true, batch: true, phase: 5 },

  // Documents — Phase 5 (Wave 6a: Word, Markdown, EPUB and spreadsheets; all local)
  { slug: 'word-to-markdown', name: 'Word to Markdown', category: 'documents', icon: MarkdownLogo, outcome: 'Turn a Word document into Markdown. Headings, emphasis, lists and links carry across; tables and images do not.', accept: ['.docx'], multiple: true, batch: true, phase: 5 },
  { slug: 'markdown-to-pdf', name: 'Markdown to PDF', category: 'documents', icon: Article, outcome: 'Turn Markdown — from a file or pasted text — into a clean, laid-out PDF. Images are not included.', accept: ['.md', '.txt', 'text/markdown', 'text/plain'], multiple: false, phase: 5 },
  { slug: 'epub-viewer', name: 'EPUB viewer', category: 'documents', icon: BookOpenText, outcome: 'Read an EPUB book in your browser, chapter by chapter. Books protected with DRM cannot be opened.', accept: ['.epub', 'application/epub+zip'], multiple: false, phase: 5 },
  { slug: 'merge-word', name: 'Merge Word', category: 'documents', icon: FileDoc, outcome: 'Join several Word documents into one, in the order you choose, each starting on a new page.', accept: ['.docx'], multiple: true, phase: 5 },
  { slug: 'csv-to-excel', name: 'CSV to Excel', category: 'documents', icon: FileXls, outcome: 'Turn a CSV file into an Excel spreadsheet, with the delimiter detected for you or chosen by hand.', accept: ['.csv', '.tsv', '.txt', 'text/csv'], multiple: false, phase: 5 },
  { slug: 'excel-to-csv', name: 'Excel to CSV', category: 'documents', icon: FileCsv, outcome: 'Save one sheet of a spreadsheet as a CSV file, with values escaped so other programs read them back correctly.', accept: ['.xlsx', '.xls', '.csv'], multiple: false, phase: 5 },
  { slug: 'clean-csv', name: 'Clean CSV', category: 'documents', icon: Table, outcome: 'Tidy a CSV file: trim spaces, drop empty rows and remove duplicates, with the counts shown before you download.', accept: ['.csv', '.tsv', '.txt', 'text/csv'], multiple: false, phase: 5 },

  // Files — Phase 5 (Wave 6b: archives, hashes and QR codes; all local)
  { slug: 'zip-files', name: 'ZIP files', category: 'files', icon: FileZip, outcome: 'Pack files of any kind into one ZIP archive, ready to send or store.', accept: ['*/*'], multiple: true, phase: 5 },
  { slug: 'unzip-file', name: 'Unzip', category: 'files', icon: FolderOpen, outcome: 'Open a ZIP archive, see what is inside, and save each file it holds.', accept: ['.zip', 'application/zip', 'application/x-zip-compressed'], multiple: false, phase: 5 },
  { slug: 'file-hash', name: 'File hash', category: 'files', icon: Fingerprint, outcome: 'Work out the SHA-256 and SHA-1 hashes of a file on your device, and check a hash you were given against them.', accept: ['*/*'], multiple: false, phase: 5 },
  { slug: 'qr-generate', name: 'Generate QR code', category: 'files', icon: QrCode, outcome: 'Turn text or a web address into a QR code, preview it here, and save it as a PNG image.', accept: ['.txt', 'text/plain'], multiple: false, phase: 5 },
  { slug: 'qr-read', name: 'Read QR code', category: 'files', icon: Scan, outcome: 'Read the text or web address hidden in a QR code in an image, without uploading the image anywhere.', accept: ['image/png', 'image/jpeg', 'image/webp'], multiple: false, phase: 5 },

  // Organise — Phase 2 / 3
  { slug: 'merge-pdf', name: 'Merge PDF', category: 'organise', icon: Files, outcome: 'Combine PDFs into one file, in the order you choose.', accept: ['application/pdf'], multiple: true, phase: 2 },
  { slug: 'split-pdf', name: 'Split PDF', category: 'organise', icon: Scissors, outcome: 'Describe the split in plain words, then drag pages between files to adjust it.', accept: ['application/pdf'], multiple: false, phase: 2 },
  { slug: 'rotate-pdf', name: 'Rotate PDF', category: 'organise', icon: ArrowsClockwise, outcome: 'Rotate pages by 90, 180 or 270 degrees.', accept: ['application/pdf'], multiple: true, batch: true, phase: 2 },
  { slug: 'extract-pages', name: 'Extract pages', category: 'organise', icon: FilePdf, outcome: 'Pull selected pages out into a new PDF.', accept: ['application/pdf'], multiple: false, phase: 2 },
  { slug: 'delete-pages', name: 'Delete pages', category: 'organise', icon: Trash, outcome: 'Remove selected pages and save what is left.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'remove-blank-pages', name: 'Remove blank pages', category: 'organise', icon: FileDashed, outcome: 'Find blank pages and remove them, after showing you exactly which pages they are.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'insert-pages', name: 'Insert pages', category: 'organise', icon: FilePlus, outcome: 'Add blank pages, or pages from another PDF, at any point in a document.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'reorder-pages', name: 'Reorder pages', category: 'organise', icon: Stack, outcome: 'Drag pages into a new order and save the result.', accept: ['application/pdf'], multiple: false, phase: 3 },
  { slug: 'resize-pages', name: 'Resize pages', category: 'organise', icon: FrameCorners, outcome: 'Set every page to A4, Letter, Legal or a custom size, with content scaled to fit.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'n-up', name: 'Pages per sheet', category: 'organise', icon: GridFour, outcome: 'Place 2, 4, 6 or 9 pages on each sheet, ready to print.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'booklet-pdf', name: 'Booklet', category: 'organise', icon: BookOpen, outcome: 'Reorder pages into booklet pairs on landscape sheets, ready to print double-sided and fold into a booklet.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'split-by-bookmarks', name: 'Split by bookmarks or size', category: 'organise', icon: BookmarkSimple, outcome: 'Split a PDF at its bookmarks into one file per chapter, or into files under a target size.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'compare-pdfs', name: 'Compare PDFs', category: 'organise', icon: GitDiff, outcome: 'Compare the text of two PDFs page by page and show what changed. Layout and images are not compared.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'edit-metadata', name: 'Edit metadata', category: 'organise', icon: Info, outcome: 'See and change a PDF title, author, subject and keywords.', accept: ['application/pdf'], multiple: false, phase: 2 },

  // Edit and sign — Phase 3 / 4
  { slug: 'sign-pdf', name: 'Sign PDF', category: 'edit-sign', icon: PenNib, outcome: 'Draw or type a signature, place it, and save the signed PDF.', accept: ['application/pdf'], multiple: false, phase: 4 },
  { slug: 'edit-pdf', name: 'Edit PDF', category: 'edit-sign', icon: PencilSimpleLine, outcome: 'Highlight, redact, draw, and add shapes, text and images.', accept: ['application/pdf'], multiple: false, phase: 4 },
  { slug: 'watermark', name: 'Add watermark', category: 'edit-sign', icon: Stamp, outcome: 'Add text or a logo across every page, at the opacity you set.', accept: ['application/pdf'], multiple: true, batch: true, phase: 3 },
  { slug: 'page-numbers', name: 'Add page numbers', category: 'edit-sign', icon: ListNumbers, outcome: 'Add page numbers in the format and position you choose.', accept: ['application/pdf'], multiple: true, batch: true, phase: 2 },
  { slug: 'headers-footers', name: 'Headers and footers', category: 'edit-sign', icon: TextAa, outcome: 'Stamp text such as a title or date on every page, at the top or bottom.', accept: ['application/pdf'], multiple: true, batch: true, phase: 5 },
  { slug: 'crop-pdf', name: 'Crop PDF', category: 'edit-sign', icon: Crop, outcome: 'Trim margins or unwanted edges from pages, visually.', accept: ['application/pdf'], multiple: false, phase: 4 },
  { slug: 'flatten-pdf', name: 'Flatten PDF', category: 'edit-sign', icon: StackSimple, outcome: 'Bake form fields into the pages so they can no longer be edited.', accept: ['application/pdf'], multiple: true, batch: true, phase: 5 },
  { slug: 'fill-form', name: 'Fill form', category: 'edit-sign', icon: ListChecks, outcome: 'Fill in the fields of a PDF form — text, checkboxes and choices — and save it, flattened if you want.', accept: ['application/pdf'], multiple: false, phase: 5 },

  // Security — Phase 5 (qpdf wasm spike passed: real 256-bit AES, tested)
  { slug: 'password-protect', name: 'Password protect', category: 'security', icon: Lock, outcome: 'Encrypt a PDF with a password, using 256-bit AES.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'remove-password', name: 'Remove password', category: 'security', icon: LockOpen, outcome: 'Remove the password from a PDF when you know the current password.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'redact-pdf', name: 'Redact PDF', category: 'security', icon: EyeSlash, outcome: 'Permanently black out chosen areas. Redacted pages become images, so the hidden text is removed, not covered.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'scrub-pdf', name: 'Scrub PDF', category: 'security', icon: Broom, outcome: 'Remove metadata, attached files and JavaScript from a PDF, with a report of what was taken out.', accept: ['application/pdf'], multiple: true, batch: true, phase: 5 },

  // Optimise — Phase 3
  { slug: 'compress-pdf', name: 'Compress PDF', category: 'optimise', icon: FilePdf, outcome: 'Shrink a PDF for email, with the before and after size shown.', accept: ['application/pdf'], multiple: true, batch: true, phase: 3 },
  { slug: 'repair-pdf', name: 'Repair PDF', category: 'optimise', icon: FirstAid, outcome: 'Rewrite a damaged PDF into a clean file. Missing content cannot be brought back.', accept: ['application/pdf'], multiple: true, batch: true, phase: 5 },
  { slug: 'grayscale-pdf', name: 'Grayscale PDF', category: 'optimise', icon: CircleHalf, outcome: 'Turn every page black and white. Pages become images, so text stops being selectable.', accept: ['application/pdf'], multiple: true, batch: true, phase: 5 },
  { slug: 'prepare-to-share', name: 'Prepare to share', category: 'optimise', icon: ShareNetwork, outcome: 'Scrub hidden data, then compress, in one pass — with a report of what was removed and the size saved.', accept: ['application/pdf'], multiple: false, phase: 5 },
  { slug: 'prepare-to-archive', name: 'Prepare to archive', category: 'optimise', icon: Archive, outcome: 'Make scanned pages searchable with OCR, then flatten form fields, in one pass — with a report of both steps.', accept: ['application/pdf'], multiple: false, phase: 5 },
]

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug)
}

export function toolsByCategory(category: ToolCategory): ToolDef[] {
  return TOOLS.filter((t) => t.category === category)
}
