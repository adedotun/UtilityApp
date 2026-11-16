/**
 * docx-merger ships no TypeScript declarations. This is the slice of its
 * API the Merge Word tool uses: construct with options and the input files,
 * then save in one of JSZip 2's output shapes ('blob' in the browser,
 * 'nodebuffer' under Node).
 */
declare module 'docx-merger' {
  class DocxMerger {
    constructor(options: Record<string, unknown>, files: ArrayBuffer[])
    save(type: string, callback: (data: unknown) => void): void
  }
  export default DocxMerger
}
