import path from 'node:path'
import { defineConfig } from 'vite'
import appConfig from '../../../vite.config'

const fixturePath = '/tests/workspace-controls/pagination/boundary.ts'

export default defineConfig({
  ...appConfig,
  cacheDir: 'node_modules/.vite-workspace-pagination',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      'https://workspace-pagination.invalid',
    ),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      'workspace-pagination-fixture',
    ),
  },
  plugins: [
    {
      name: 'workspace-pagination-boundaries',
      enforce: 'pre',
      transform(code, id) {
        const database = new URLSearchParams(id.split('?')[1] ?? '').get(
          'search-index-db',
        )

        if (
          id.split('?')[0] ===
            path.resolve('src/lib/offline-resume-manager.ts') &&
          database?.startsWith('resume-workflow-search-')
        ) {
          return {
            code: code.replace(
              "const DB_NAME = 'offline-resumes'",
              `const DB_NAME = ${JSON.stringify(database)}`,
            ),
            map: null,
          }
        }

        if (
          !['library.ts', 'library-cache.ts', 'library-page.ts'].some(
            (file) =>
              id.split('?')[0] === path.resolve('src/pages/resume/store', file),
          )
        )
          return

        return {
          code: code.replace(
            /'@\/lib\/(?:offline-resume-manager|supabase\/resume\/library|supabase\/user)'/g,
            `'${fixturePath}'`,
          ),
          map: null,
        }
      },
    },
    ...(appConfig.plugins ?? []),
  ],
  server: {
    ...appConfig.server,
    port: 5193,
    strictPort: true,
  },
  optimizeDeps: {
    ...appConfig.optimizeDeps,
    entries: ['tests/workspace-controls/pagination/index.html'],
  },
})
