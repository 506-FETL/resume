# 全项目代码分段与排版实现计划

> **面向 AI 代理的工作者：** 按顺序执行任务，遵循仓库关于当前分支、不执行 TDD、不推送及临时验收文件清理的要求。

**目标：** 让项目代码按职责分段，并通过 ESLint、Prettier、保存动作与 AGENTS.md 持续保持。

**架构：** ESLint Stylistic 仅负责补足段落空行，Prettier 处理缩进与折行。批量排版只应用 layout 修复，不自动修改业务逻辑；生成组件仍豁免质量规则。

**技术栈：** ESLint 9、TypeScript ESLint、ESLint Stylistic、Prettier 3、VS Code。

## 任务 1：记录基线

- [x] 读取当前配置及用户示例，记录工作区源码与暂存区快照到 tests/code-layout。
- [x] 明确 Supabase 范围，在 spec 中记录最终结论。

## 任务 2：建立持续规则

- [x] 在 package.json 添加兼容 ESLint 9 的 @stylistic/eslint-plugin，更新 pnpm-lock.yaml。
- [x] 在 eslint.config.js 配置 padding-line-between-statements：声明、判断、返回、函数、类型、代码块和多行表达式分段，import 和连续简短 guard 保持组内连续。
- [x] 将生成组件从全局忽略调整为仅豁免质量规则，保留语法解析和空行规则。
- [x] 更新 format/format:check，使规则可自动修复与检查；在 AGENTS.md 和 README.md 写明规则与命令分工。

## 任务 3：统一项目排版

- [x] 对前端、样式及项目配置执行布局修复与 Prettier，按最终范围处理 Supabase。
- [x] 抽查 bindings.ts、页面、store、hooks、共享 UI；保留变量组与连续 guard。
- [x] 比较编译后语法结构及暂存区快照，差异必须仅为排版。

## 任务 4：验收与清理

- [x] 运行 pnpm format:check（包含全量 ESLint）、pnpm exec tsc -b --pretty false、pnpm build。
- [x] 重复格式化，确认文件哈希无变化；使用临时样例验证编辑器保存能补空行并格式化。
- [x] 如包含 Edge Functions，完成仓库要求的部署与线上核验。
- [x] 删除 tests/code-layout 中本次生成的验证文件，报告覆盖范围及检查结果。

## 验证记录

- 核对 1,068 个源码及配置文件，744 个文件存在排版变化。JS/TS 编译后语法结构、声明文件结构及其他文件的 Prettier 规范化内容一致，暂存区快照保持原样。
- 对 1,984 个已跟踪文件记录哈希，重复执行 pnpm format 后无变化。ESLint 与 Prettier 配置冲突检查通过；连续带防护分号的属性赋值保留在同一组，避免工具反复增删空行。
- VS Code 中实际打开密集的 TypeScript 临时样例并保存，成功补齐声明、判断与返回之间的空行，同时修正缩进和冒号、运算符空格；编辑器显示零问题。
- 全量格式检查、应用 TypeScript 检查和生产构建通过。既有 lint 警告与构建包体积提示保留。
- Edge Functions 的 Deno 2.2.12 类型检查存在 89 项既有错误；将格式化前快照放入隔离目录执行相同检查，逐项比较错误代码、消息和所属文件，确认没有新增错误。本次未改动这些业务类型。额外尝试 Deno 2.9.6 时共报告 91 项错误，未将该检查视作通过。
- Supabase 五个函数部署成功且均为 ACTIVE：llm-proxy v50、resume-share v44、resume-comments v42、github-stars-refresh v16、backend-ops-monitor v16。verify_jwt 配置与部署前一致。
- 部署前后分别执行 10 项 OPTIONS / 不支持的方法请求检查，状态、响应体与 CORS 头一致；未触发业务写入。57 条迁移记录本地与远端一致，部署前后账本无变化。
