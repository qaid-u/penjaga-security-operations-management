import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { deny: ['**/.env', '**/.env.*', '**/.git/**', '**/backend/**', '**/.phase5-runtime.local/**', '**/docs/psm-evaluation/data/**', '**/artifacts/**'] },
    watch: { ignored: ['**/backend/**', '**/.phase5-runtime.local/**', '**/artifacts/**', '**/docs/psm-evaluation/**'] },
  },
})
