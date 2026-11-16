/**
 * Mammoth ships two builds with different input shapes: the browser build
 * reads { arrayBuffer }, the Node build (which the unit tests run against)
 * reads { buffer }. Hand it whichever shape this runtime understands.
 */
export function mammothInput(buffer: ArrayBuffer): { arrayBuffer: ArrayBuffer } | { buffer: Uint8Array } {
  const B = (globalThis as unknown as { Buffer?: { from(data: ArrayBuffer): Uint8Array } }).Buffer
  if (B) return { buffer: B.from(buffer.slice(0)) }
  return { arrayBuffer: buffer.slice(0) }
}

export interface MammothLike {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer } | { buffer: Uint8Array }) => Promise<{ value: string }>
  extractRawText: (input: { arrayBuffer: ArrayBuffer } | { buffer: Uint8Array }) => Promise<{ value: string }>
}

export async function loadMammoth(): Promise<MammothLike> {
  return (await import('mammoth')) as unknown as MammothLike
}
