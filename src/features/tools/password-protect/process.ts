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

export async function runQpdf(input: Uint8Array, args: string[]): Promise<Uint8Array> {
  const qpdf = await createModule({ locateFile: () => resolveWasmLocation() })
  const fs = qpdf.FS as unknown as QpdfFS
  fs.writeFile('/in.pdf', input)
  const code = qpdf.callMain(args)
  if (code !== 0) throw new Error(`qpdf exited with code ${code}`)
  return fs.readFile('/out.pdf')
}

/** Encrypts with 256-bit AES. User password opens the file; owner password controls permissions changes. */
export async function encryptPdf(buffer: ArrayBuffer, userPassword: string, ownerPassword: string): Promise<Uint8Array> {
  if (!userPassword) throw new Error('Enter a password to open the protected file.')
  try {
    return await runQpdf(new Uint8Array(buffer.slice(0)), ['/in.pdf', '--encrypt', userPassword, ownerPassword || userPassword, '256', '--', '/out.pdf'])
  } catch {
    throw new Error('This PDF could not be protected. It may be damaged or already encrypted.')
  }
}

export async function decryptPdf(buffer: ArrayBuffer, password: string): Promise<Uint8Array> {
  if (!password) throw new Error('Enter the current password for this PDF.')
  try {
    return await runQpdf(new Uint8Array(buffer.slice(0)), ['/in.pdf', `--password=${password}`, '--decrypt', '/out.pdf'])
  } catch {
    throw new Error('The password was not accepted, or this PDF is not password protected. Check the password and try again.')
  }
}
