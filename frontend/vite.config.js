import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read backend URL from environment variable (default localhost:8080)
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Allow remote access
    proxy: {
      '/data': {
        target: backendUrl,
        changeOrigin: true,
      }
    },
  },
})
