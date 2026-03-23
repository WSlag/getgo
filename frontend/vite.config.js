import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

function excludeDebugPagesInProd() {
  const includeDebugPages = process.env.VITE_INCLUDE_DEBUG_PAGES === 'true'
  const excludedDebugAssets = new Set([
    'verify-contracts.html',
    'icons/generate-icons.html',
    // Hero source PNGs are only used to generate optimized variants during build.
    'assets/trucker-phone-cab.png',
    'assets/warehouse-worker-phone.png',
    'assets/highway-sunset-truck.png',
    'assets/problem-logistics-manager.png',
    'assets/broker-booking.png',
  ])

  return {
    name: 'exclude-debug-pages-in-prod',
    apply: 'build',
    closeBundle() {
      if (includeDebugPages) return

      const outDir = path.resolve(process.cwd(), 'dist')
      for (const relativePath of excludedDebugAssets) {
        const absolutePath = path.resolve(outDir, relativePath)
        if (fs.existsSync(absolutePath)) {
          fs.rmSync(absolutePath, { force: true })
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    excludeDebugPagesInProd(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'GetGo',
        short_name: 'GetGo',
        description: 'Book trusted trucks across Mindanao. Direct shippers to truckers — no middlemen.',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'en',
        categories: ['business', 'logistics', 'transportation'],
        icons: [
          {
            src: 'icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          },
        ],
        shortcuts: [
          {
            name: 'Post Cargo',
            short_name: 'Post',
            description: 'Post a new cargo listing',
            url: '/?action=post-cargo',
            icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96' }]
          },
          {
            name: 'Find Trucks',
            short_name: 'Trucks',
            description: 'Browse available trucks',
            url: '/?tab=trucks',
            icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96' }]
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['firebase-messaging-sw.js'],
        // Keep SPA navigations on the app shell. Using offline.html here causes
        // controlled hard-refresh navigations to render the offline page.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/__\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          const inPkg = (pkg) =>
            id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`)

          if (inPkg('@sentry') || inPkg('sentry')) return 'sentry'
          if (inPkg('leaflet') || inPkg('react-leaflet')) return 'maps'
          if (inPkg('@radix-ui')) return 'radix'

          if (inPkg('firebase') || inPkg('@firebase')) {
            if (inPkg('@firebase/firestore') || id.includes('firebase/firestore')) return 'firebase-firestore'
            if (inPkg('@firebase/auth') || id.includes('firebase/auth')) return 'firebase-auth'
            if (inPkg('@firebase/functions') || id.includes('firebase/functions')) return 'firebase-functions'
            if (inPkg('@firebase/storage') || id.includes('firebase/storage')) return 'firebase-storage'
            if (inPkg('@firebase/app-check') || id.includes('firebase/app-check')) return 'firebase-app-check'
            if (inPkg('@firebase/analytics') || id.includes('firebase/analytics')) return 'firebase-analytics'
            if (inPkg('@firebase/messaging') || id.includes('firebase/messaging')) return 'firebase-messaging'
            return 'firebase-core'
          }

          return undefined
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
