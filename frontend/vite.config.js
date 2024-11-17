import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext' // TODO: remove this line, now because top level await 
  },
  server: {
    proxy: {
      '/data': {
        target: 'http://localhost:3000',
      }
    },
  },
})
