import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
   plugins: [
      vue(),
   
      VitePWA({
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
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
         '/electric-sql/': {
            target: 'http://localhost:3000',
         },
         '^/offline-socket-io/.*': {
            target: 'http://localhost:3000',
            ws: true,
            secure: false,
            changeOrigin: true,
         },
      }
   },
})
