import { defineConfig } from 'vite'
import appConfig from '../../vite.config'

export default defineConfig({
  ...appConfig,
  cacheDir: 'node_modules/.vite-template-preview-motion',
  server: { ...appConfig.server, port: 5194, strictPort: true },
  optimizeDeps: { ...appConfig.optimizeDeps, entries: ['tests/template-preview-motion/index.html'] },
})
