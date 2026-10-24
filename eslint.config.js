import js from '@eslint/js'
import react from '@eslint-react/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const codeFiles = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']
const typescriptFiles = ['**/*.{ts,mts,cts,tsx}']

const generatedComponentFiles = [
  'src/components/ui/**/*.{js,jsx,ts,tsx}',
  'src/components/animate-ui/**/*.{js,jsx,ts,tsx}',
  '**/tiptap-*/**/*.{js,jsx,ts,tsx}',
]

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
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
    ignores: generatedComponentFiles,
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
    ignores: generatedComponentFiles,
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
    ignores: generatedComponentFiles,
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
  {
    // 生成组件保留质量检查豁免，但同样接受统一的段落排版。
    files: generatedComponentFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  prettier,
  {
    files: codeFiles,
    plugins: { '@stylistic': stylistic },
    rules: {
      // Prettier 保留空行；此规则负责在逻辑段落的边界补足空行。
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'any', prev: 'directive', next: 'directive' },
        {
          blankLine: 'always',
          prev: '*',
          next: ['export', 'function', 'class', 'interface', 'type'],
        },
        {
          blankLine: 'always',
          prev: ['export', 'function', 'class', 'interface', 'type'],
          next: '*',
        },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'always', prev: '*', next: ['const', 'let', 'var'] },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          prev: ['multiline-const', 'multiline-let', 'multiline-var'],
          next: '*',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: ['multiline-const', 'multiline-let', 'multiline-var'],
        },
        {
          blankLine: 'always',
          prev: '*',
          next: [
            'if',
            'for',
            'while',
            'do',
            'switch',
            'try',
            'return',
            'throw',
          ],
        },
        { blankLine: 'always', prev: ['block-like', 'if'], next: '*' },
        { blankLine: 'any', prev: 'if', next: 'if' },
        { blankLine: 'always', prev: 'multiline-expression', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-expression' },
        // 连续属性赋值保留为一组，兼容 Prettier 插入的 ASI 防护分号。
        {
          blankLine: 'any',
          prev: {
            selector:
              'ExpressionStatement[expression.type="AssignmentExpression"]',
          },
          next: {
            selector:
              'ExpressionStatement[expression.type="AssignmentExpression"]',
          },
        },
      ],
    },
  },
])
