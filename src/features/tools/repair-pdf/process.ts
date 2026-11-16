// @ts-ignore - vite asset url import for the qpdf wasm binary (bundled locally, never a CDN)
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'
import createModule from '@neslinesli93/qpdf-wasm'

interface QpdfFS { writeFile: (path: string, data: Uint8Array) => void; readFile: (path: string) => Uint8Array }

function resolveWasmLocation(): string {
  const url = wasmUrl as unknown as string
  // Under Vitest/Node the asset url is a root relative /node_modules path; resolve it against the cwd.
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd?: () => string } }).process
  if (proc?.versions?.node && proc.cwd && url.startsWith('/node_modules/')) return proc.cwd() + url
  return url
}

export interface RepairResult { data: Uint8Array; warnings: boolean }

const REPAIR_FAILED = 'This file could not be rewritten. It may not be a PDF, it may be password protected, or the damage may be beyond a structural repair.'

/**
 * A repair is a full structural rewrite by qpdf: it rebuilds the cross-reference
 * tables and object structure and writes a clean file. It cannot recover pages
 * or content that are missing from the source. qpdf exit code 3 means the file
 * was written but warnings were reported while fixing it, which is expected for
 * genuinely damaged files, so 0 and 3 both count as a completed rewrite.
 */
export async function repairPdf(buffer: ArrayBuffer): Promise<RepairResult> {
  let qpdf
  try {
    qpdf = await createModule({ locateFile: () => resolveWasmLocation() })
  } catch {
    throw new Error(REPAIR_FAILED)
  }
  const fs = qpdf.FS as unknown as QpdfFS
  fs.writeFile('/in.pdf', new Uint8Array(buffer.slice(0)))
  let code: number
  try {
    code = qpdf.callMain(['/in.pdf', '/out.pdf'])
  } catch {
    throw new Error(REPAIR_FAILED)
  }
  if (code !== 0 && code !== 3) throw new Error(REPAIR_FAILED)
  try {
    return { data: fs.readFile('/out.pdf'), warnings: code === 3 }
  } catch {
    throw new Error(REPAIR_FAILED)
  }
}
