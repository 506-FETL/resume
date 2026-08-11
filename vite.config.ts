import path from 'node:path'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig } from 'vite'
import Pages from 'vite-plugin-pages'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter] }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tailwindcss(),
    Pages({
      exclude: [
        '**/components/*',
        '**/utils/*',
        '**/*.test.*',
        '**/*.spec.*',
        '**/hooks/*',
        '**/models/*',
        '**/data/*',
        '**/info/*',
        '**/*.ts',
        '**/content/*',
      ],
      importMode: 'async',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2024',
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心库
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI 组件库
          'radix-ui': [
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
          ],
          // TipTap 编辑器（单独分离，按需加载）
          'tiptap-editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extensions',
            '@tiptap/extension-highlight',
            '@tiptap/extension-image',
            '@tiptap/extension-text-align',
            '@tiptap/extension-typography',
            '@tiptap/extension-horizontal-rule',
            '@tiptap/extension-list',
            '@tiptap/extension-subscript',
            '@tiptap/extension-superscript',
          ],
          // 协作核心
          'automerge-core': [
            '@automerge/automerge',
            '@automerge/automerge-repo',
            '@automerge/automerge-repo-storage-indexeddb',
          ],
          // 动画
          'motion': ['motion'],
          // 图标库
          'icons': ['lucide-react'],
          // Supabase
          'supabase': ['@supabase/supabase-js'],
          // 其他工具库
          'utils': ['clsx', 'tailwind-merge', 'dayjs', 'zod', 'zustand'],
        },
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 启用压缩 terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        keep_fnames: false,
        keep_classnames: false,
      },
      format: {
        comments: false,
      },
      mangle: true,
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
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
