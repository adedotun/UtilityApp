import { describe, expect, it, vi } from 'vitest'
import { PdfThumbnailStore } from './pdfThumbnail'

const buf = (label: string) => new TextEncoder().encode(label).buffer as ArrayBuffer

describe('PdfThumbnailStore', () => {
  it('renders once per id and serves repeats from the cache', async () => {
    const render = vi.fn(async () => 'data:image/png;base64,AAA')
    const store = new PdfThumbnailStore(render)
    const buffer = buf('a')
    await expect(store.get('f1', buffer)).resolves.toBe('data:image/png;base64,AAA')
    await expect(store.get('f1', buffer)).resolves.toBe('data:image/png;base64,AAA')
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('keeps different files independent', async () => {
    const render = vi.fn(async (b: ArrayBuffer) => `data:${new TextDecoder().decode(b)}`)
    const store = new PdfThumbnailStore(render)
    await expect(store.get('f1', buf('one'))).resolves.toBe('data:one')
    await expect(store.get('f2', buf('two'))).resolves.toBe('data:two')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('turns a failed render into null and caches that too', async () => {
    const render = vi.fn(async () => {
      throw new Error('damaged PDF')
    })
    const store = new PdfThumbnailStore(render)
    await expect(store.get('f1', buf('a'))).resolves.toBeNull()
    await expect(store.get('f1', buf('a'))).resolves.toBeNull()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('renders again after release', async () => {
    const render = vi.fn(async () => 'data:image/png;base64,AAA')
    const store = new PdfThumbnailStore(render)
    await store.get('f1', buf('a'))
    store.release('f1')
    await store.get('f1', buf('a'))
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('runs renders sequentially, never two at once', async () => {
    const order: string[] = []
    let openGate!: () => void
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    const render = vi.fn(async (b: ArrayBuffer) => {
      const label = new TextDecoder().decode(b)
      order.push(`start:${label}`)
      if (label === 'first') await gate
      order.push(`end:${label}`)
      return `data:${label}`
    })
    const store = new PdfThumbnailStore(render)
    const p1 = store.get('f1', buf('first'))
    const p2 = store.get('f2', buf('second'))
    // Let the queue run as far as it can: the second render must not have
    // started while the first is still gated.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(order).toEqual(['start:first'])
    openGate()
    await expect(p1).resolves.toBe('data:first')
    await expect(p2).resolves.toBe('data:second')
    expect(order).toEqual(['start:first', 'end:first', 'start:second', 'end:second'])
  })

  it('one failing render does not stall the queue behind it', async () => {
    const render = vi.fn(async (b: ArrayBuffer) => {
      const label = new TextDecoder().decode(b)
      if (label === 'bad') throw new Error('nope')
      return `data:${label}`
    })
    const store = new PdfThumbnailStore(render)
    await expect(store.get('f1', buf('bad'))).resolves.toBeNull()
    await expect(store.get('f2', buf('good'))).resolves.toBe('data:good')
  })
})
