import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PDF Tweaks — PDF and Word tools',
        short_name: 'PDF Tweaks',
        description:
          'Free PDF and Word tools that run entirely in your browser. Your files never leave your device.',
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
        globIgnores: ['**/pdfjs-*.js', '**/pdf.worker-*.js', '**/qpdf-*.wasm', '**/es-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:wasm)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-tweaks-wasm', expiration: { maxEntries: 4 } },
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
