import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
   plugins: [vue()],
   server: {
   port: 8080,
      open: true,
      host: true, // allows for external device connection on local network
      proxy: {
         '^/offline-socket-io/.*': {
            target: 'http://localhost:3000',
            ws: true,
            secure: false,
            changeOrigin: true,
         },
      }
   }
})
