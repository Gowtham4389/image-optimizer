import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: { exclude: ['@jsquash/avif'] },
  worker: { format: 'es' },
  build: { target: ['es2022', 'chrome109', 'firefox115', 'safari16.4'] },
})
