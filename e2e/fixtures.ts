import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Programmatic fixtures for the e2e suite — no binary files are committed.
 * global-setup.ts calls generateFixtures() before the run; specs import the
 * paths and the known facts (page counts, page widths, strings) from here.
 *
 * Page widths are all distinct so a downloaded PDF can be verified with
 * pdf-lib alone: page count + the width sequence proves which source pages
 * ended up where, in which order.
 */
export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '.fixtures')

export const ALPHA = join(FIXTURE_DIR, 'alpha.pdf')
export const BETA = join(FIXTURE_DIR, 'beta.pdf')
export const FORM = join(FIXTURE_DIR, 'form.pdf')
export const SCAN = join(FIXTURE_DIR, 'scan.pdf')

/** alpha.pdf — 3 text pages. */
export const ALPHA_WIDTHS = [500, 520, 540]
export const ALPHA_LINES = ['Alpha page one', 'Alpha page two', 'Alpha page three']
/** beta.pdf — 2 text pages. */
export const BETA_WIDTHS = [600, 620]
export const BETA_LINES = ['Beta page one', 'Beta page two']
/** form.pdf — one text field with this name. */
export const FORM_FIELD = 'fullName'
/** scan.pdf — one image-only page; OCR should read this word from it. */
export const SCAN_WORD = 'ZEBRA'

async function textPdf(widths: number[], lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  widths.forEach((width, i) => {
    const page = doc.addPage([width, 600])
    page.drawText(lines[i], { x: 40, y: 520, size: 24, font })
    page.drawText('Fixture document for end-to-end tests.', { x: 40, y: 480, size: 12, font })
  })
  return doc.save()
}

async function formPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([612, 792])
  page.drawText('Full name:', { x: 60, y: 700, size: 14, font })
  const form = doc.getForm()
  const field = form.createTextField(FORM_FIELD)
  field.addToPage(page, {
    x: 60,
    y: 660,
    width: 320,
    height: 26,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0.4, 0.4, 0.4),
    borderWidth: 1,
  })
  return doc.save()
}

/**
 * One image-only page whose pixels spell the scan words — the same recipe as
 * the OCR unit tests (text rendered to a PNG with @napi-rs/canvas, embedded
 * full-page with pdf-lib), so the file has no text layer at all.
 */
async function scanPdf(): Promise<Uint8Array> {
  const canvas = createCanvas(1800, 600)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1800, 600)
  ctx.fillStyle = '#000000'
  ctx.font = '120px sans-serif'
  ctx.fillText('ZEBRA CROSSING', 90, 240)
  ctx.font = '72px sans-serif'
  ctx.fillText('handle with care', 90, 420)
  const png = new Uint8Array(canvas.toBuffer('image/png'))

  const doc = await PDFDocument.create()
  const image = await doc.embedPng(png)
  const page = doc.addPage([612, 204])
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 204 })
  return doc.save()
}

export async function generateFixtures(): Promise<void> {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  writeFileSync(ALPHA, await textPdf(ALPHA_WIDTHS, ALPHA_LINES))
  writeFileSync(BETA, await textPdf(BETA_WIDTHS, BETA_LINES))
  writeFileSync(FORM, await formPdf())
  writeFileSync(SCAN, await scanPdf())
}

/** Sanity-check the generated fixtures so a broken generator fails the run loudly, not mysteriously inside a spec. */
export async function verifyFixtures(): Promise<void> {
  const { readFileSync } = await import('node:fs')
  const alpha = await PDFDocument.load(readFileSync(ALPHA))
  if (alpha.getPageCount() !== 3) throw new Error('alpha.pdf should have 3 pages')
  const beta = await PDFDocument.load(readFileSync(BETA))
  if (beta.getPageCount() !== 2) throw new Error('beta.pdf should have 2 pages')
  const form = await PDFDocument.load(readFileSync(FORM))
  const names = form.getForm().getFields().map((f) => f.getName())
  if (!names.includes(FORM_FIELD)) throw new Error(`form.pdf should carry the ${FORM_FIELD} field, got: ${names.join(', ')}`)
  const scan = await PDFDocument.load(readFileSync(SCAN))
  if (scan.getPageCount() !== 1) throw new Error('scan.pdf should have 1 page')
}
