import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
   const env = loadEnv(mode, process.cwd(), '')
   // Server-only setting: local development can use its own authenticated CouchDB.
   const couchProxy = new URL(env.COUCH_PROXY_TARGET || 'https://couchdb.jcbuisson.dev')
   return {
   // Local database initialization uses top-level await.
   build: { target: 'esnext' },
   optimizeDeps: {
      exclude: ['@jcbuisson/express-x-plugins', '@electric-sql/pglite'],
      // Worker-only dependencies are missed by Vite's page dependency scan.
      include: ['pouchdb-browser', 'pouchdb-adapter-indexeddb'],
   },
   worker: { format: 'es' },
   plugins: [
      vue(),
   
      VitePWA({
         // ReloadPrompt owns registration, activation and cross-tab reloads.
         injectRegister: false,
         devOptions: {
            enabled: false
         },
         mode: "development",
         base: "/",
         srcDir: "src",
         filename: "sw.ts",
         includeAssets: ["/favicon.png"],
         strategies: "injectManifest",
         injectManifest: {
            // PGlite's runtime and initial database must be available offline.
            globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,data}'],
            maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
         },
         manifest: {
            name: "Offline",
            short_name: "Offline",
            theme_color: "#ffffff",
            start_url: "/",
            display: "fullscreen",
            background_color: "#ffffff",
            icons: [
               {
                  src: "icons/logo-world-192x192.jpg",
                  sizes: "192x192",
                  type: "image/jpeg",
               },
               {
                  src: "icons/logo-world-512x512.jpg",
                  sizes: "512x512",
                  type: "image/jpeg",
               },
               {
                  src: "icons/logo-world-512x512.jpg",
                  sizes: "512x512",
                  type: "image/jpeg",
                  purpose: "any maskable",
               },
            ],
         },
      }),
   ],
   server: {
   port: 8080,
      open: true,
      host: true, // allows for external device connection on local network
      proxy: {
         '/couchdb/': {
            target: couchProxy.origin,
            auth: couchProxy.username
               ? `${decodeURIComponent(couchProxy.username)}:${decodeURIComponent(couchProxy.password)}`
               : undefined,
            changeOrigin: true,
            cookiePathRewrite: '/couchdb',
            rewrite: path => path.replace(/^\/couchdb/, ''),
         },
         '^/offline-socket-io/.*': {
            target: 'http://localhost:3000',
            ws: true,
            secure: false,
            changeOrigin: true,
         },
      }
   },
   }
})
