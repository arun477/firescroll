import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3500,
    proxy: {
      '/api': 'http://localhost:8500',
      '/static': 'http://localhost:8500',
    },
  },
})
