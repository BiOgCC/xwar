import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/worldmonitor': {
        target: 'https://api.worldmonitor.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/worldmonitor/, '/api'),
        secure: true,
      },
    },
  },
})
 
