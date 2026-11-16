import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vite'
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const tessCoreDir = join(rootDir, 'node_modules/tesseract.js-core')
const tessDataDir = join(rootDir, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int')
// The worker always runs the LSTM engine and picks one of these by SIMD support.
const TESS_CORE_FILES = [
  'tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm',
  'tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm',
]

/**
 * Tesseract.js loads its core wasm and language data from directories at
 * runtime, and its defaults point at a CDN — which this product forbids.
 * This plugin serves both directories from the app's own node_modules in
 * dev and copies them into dist at build time, so /tess-core and
 * /tess-data are always same-origin, local files.
 */
function ocrAssetsPlugin(): Plugin {
  let outDir = join(rootDir, 'dist')
  const serveFrom = (dir: string) => (req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const name = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
    const file = join(dir, name)
    if (!name || !file.startsWith(dir) || !existsSync(file)) return next()
    const ext = extname(file)
    res.setHeader('Content-Type', ext === '.wasm' ? 'application/wasm' : ext === '.js' ? 'text/javascript' : 'application/octet-stream')
    createReadStream(file).pipe(res as never)
  }
  return {
    name: 'pdf-tweaks-ocr-assets',
    configResolved(config) {
      outDir = resolve(rootDir, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use('/tess-core', serveFrom(tessCoreDir) as never)
      server.middlewares.use('/tess-data', serveFrom(tessDataDir) as never)
    },
    closeBundle() {
      const coreOut = join(outDir, 'tess-core')
      const dataOut = join(outDir, 'tess-data')
      mkdirSync(coreOut, { recursive: true })
      mkdirSync(dataOut, { recursive: true })
      for (const f of TESS_CORE_FILES) copyFileSync(join(tessCoreDir, f), join(coreOut, f))
      copyFileSync(join(tessDataDir, 'eng.traineddata.gz'), join(dataOut, 'eng.traineddata.gz'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ocrAssetsPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FileTweaks — PDF, image, document and file tools',
        short_name: 'FileTweaks',
        description:
          'Free PDF, image, document and file tools that run entirely in your browser. Your files never leave your device.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#4f46e5',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // PDF engines and the qpdf wasm are large; cache them on first use per tool instead of precaching.
        // The same applies to the OCR assets: tesseract core builds, the worker script and the language data.
        globIgnores: ['**/pdfjs-*.js', '**/pdf.worker-*.js', '**/qpdf-*.wasm', '**/es-*.js', '**/tess-core/**', '**/tess-data/**', '**/worker.min-*.js', '**/xlsx-*.js', '**/pptxgen.es-*.js', '**/heic2any-*.js', '**/full.esm-*.js', '**/dist-*.js', '**/jsQR-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:wasm)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-tweaks-wasm', expiration: { maxEntries: 4 } },
          },
          {
            // SheetJS and pptxgenjs are large single-tool chunks (Wave 3a); cache on first use, like the engines above.
            // The dist-*.js chunks join them in Wave 6a: the docx library and the docx-merger bundle
            // are both named after their packages' dist entry, and both are Word-tool-only engines.
            urlPattern: /(?:xlsx|pptxgen\.es|dist)-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-tweaks-office', expiration: { maxEntries: 6 } },
          },
          {
            urlPattern: /\/tess-(?:core|data)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-tweaks-ocr', expiration: { maxEntries: 12 } },
          },
          {
            urlPattern: /worker\.min-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-tweaks-ocr', expiration: { maxEntries: 4 } },
          },
          {
            // The HEIC decoder and the EXIF parser (Wave 5; its chunk is named full.esm-*.js after exifr's ESM build) are large single-tool chunks; cache on first use, like the engines above.
            urlPattern: /(?:heic2any|full\.esm)-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-tweaks-images', expiration: { maxEntries: 4 } },
          },
          {
            // The jsQR decoder (Wave 6b) is a large single-tool chunk; cache on first use, like the engines above.
            urlPattern: /jsQR-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-tweaks-files', expiration: { maxEntries: 2 } },
          },
        ],
        navigateFallback: '/index.html',
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
  },
})
