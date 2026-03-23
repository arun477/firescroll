import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3600,
    proxy: {
      '/api': 'http://localhost:8500',
      '/static': 'http://localhost:8500',
      '/media': 'http://localhost:8500',
    },
  },
})
