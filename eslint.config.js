import js from '@eslint/js'
import react from '@eslint-react/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const codeFiles = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']
const typescriptFiles = ['**/*.{ts,mts,cts,tsx}']

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    'src/components/ui/**',
    'src/components/animate-ui/**',
    '**/tiptap-*/**',
    '.trae/**',
    '.vscode/**',
    'skills/**',
    '.agents/**',
    '.agent/**',
    '.cursor/**',
    '.github/skills/**',
    '.superpowers/**',
    '.worktrees/**',
    '.playwright-mcp/**',
    'supabase/.temp/**',
    'supabase/.branches/**',
  ]),
  {
    files: codeFiles,
    extends: [js.configs.recommended],
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // 字符组中的连字符保留转义，避免后续编辑意外引入字符范围。
      'no-useless-escape': ['error', { allowRegexCharacters: ['-'] }],
      'no-void': 'error',
      'prefer-const': [
        'error',
        { destructuring: 'all', ignoreReadBeforeAssign: true },
      ],
      // 由 unused-imports 统一处理，避免重复报告并保留自动移除导入能力。
      'no-unused-vars': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: typescriptFiles,
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'always' },
      ],
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTaggedTemplates: true,
          allowTernary: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    extends: [react.configs.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // 延续现有 Hooks 检查范围，编译器相关规则由后续独立评估。
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@eslint-react/hooks-extra/no-direct-set-state-in-use-effect': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: [
      '*.{js,mjs,cjs,ts,mts,cts}',
      '{scripts,tests}/**/*.{js,mjs,cjs,ts,mts,cts}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['supabase/functions/**/*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.worker, Deno: 'readonly' },
    },
  },
  prettier,
])
