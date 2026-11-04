import path from 'node:path'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig } from 'vite'
import Pages from 'vite-plugin-pages'
import wasm from 'vite-plugin-wasm'
import { WORKSPACE_PATH } from './src/lib/workspace-path'

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/.superpowers/**', '**/tests/**'],
    },
  },
  plugins: [
    wasm(),
    // MDX 会去掉 query 再匹配；Skill 文档必须保留 ?raw 的原始文本。
    {
      enforce: 'pre',
      ...mdx({
        exclude: '**/src/lib/ai/skills/**/*.md',
        remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      }),
    },
    react({
      include: /\.(jsx|js|mdx|md|tsx|ts)$/,
      exclude: [/node_modules/, /src\/lib\/ai\/skills\/.*\.md(?:\?|$)/],
    }),
    tailwindcss(),
    Pages({
      exclude: [
        '**/components/**',
        '**/utils/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/hooks/**',
        '**/models/**',
        '**/data/**',
        '**/info/**',
        '**/*.ts',
        '**/content/**',
      ],
      importMode: 'async',
      extendRoute(route, parent) {
        if (!parent && route.path === '/') return { path: WORKSPACE_PATH }
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    cssCodeSplit: true,
    minify: 'terser',
  },
  optimizeDeps: {
    entries: ['index.html'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@automerge/automerge',
      '@automerge/automerge-repo',
      'motion',
      'react-markdown',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-tabs',
      '@radix-ui/react-use-controllable-state',
      'dayjs/plugin/customParseFormat',
      'openai/streaming',
      'shiki/bundle/web',
      'dompurify',
    ],
  },
})
