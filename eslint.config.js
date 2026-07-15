import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  react: true,
  markdown: false,
  ignores: ['node_modules', 'dist', 'build', 'coverage', 'src/components/ui/**', 'src/components/animate-ui/**', '**/tiptap-*/**', '.trae/**', '.vscode/**', 'skills/**', '.agents/**'],
  rules: {
    'react/no-implicit-key': 'off',
    'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'unused-imports/no-unused-vars': 'warn',
    'no-unused-vars': 'warn',
    'no-void': 'error',
    'no-console': 'warn',
    'no-undef': 'error',
    'react-hooks/incompatible-library': 'off',
  },
}, {
  // 协作模块的纯函数回归测试使用 Node 内置测试运行器（`node --test`），
  // 项目未安装 vitest，故对这些文件放开 vitest 偏好与相关风格约束。
  files: ['src/hooks/collab/**/*.test.ts', 'src/lib/collaboration/richtext/**/*.test.ts'],
  rules: {
    'test/no-import-node-test': 'off',
    'style/max-statements-per-line': 'off',
  },
})
