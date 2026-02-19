import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Source maps verbrauchen beim Bundling viel RAM (esbuild); bei OOM deaktivieren
    sourcemap: false,
  },
})
