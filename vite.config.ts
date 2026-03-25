import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
  optimizeDeps: {
    include: ['socket.io-client'],
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy all /api calls to the Express backend on port 3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket (Socket.IO)
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      // External world monitor API
      '/api/worldmonitor': {
        target: 'https://api.worldmonitor.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/worldmonitor/, '/api'),
        secure: true,
      },
    },
  },
})


 
