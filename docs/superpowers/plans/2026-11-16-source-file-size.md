# 全项目源码拆分实现计划

> **面向 AI 代理的工作者：** 使用 dispatching-parallel-agents 按独立模块实施，主代理负责集成。用户已明确授权全部现有源码；在当前分支工作，不 TDD、不提交或推送。

**目标：** 除已明确保留的历史迁移外，所有维护中的源码文件不超过 400 行，目录 index 表达公开入口，行为保持一致。

**架构：** 按组件、状态 slice、协议与业务操作拆模块，保留原外部导出和懒加载入口。原模块内部直引叶子，避免循环与不必要的重依赖。

**技术栈：** 现有 React、Zustand、TypeScript、CSS/SCSS、Supabase Edge/Deno、ESLint、Prettier；不增加依赖。

**规格：** [设计](../specs/2026-11-16-source-file-size-design.md)。基线 `0ae0920f`。

## 1. 清单与约束

- [x] 记录所有超过 400 行的源码、既有导出及模块解析基线；保存生产构建与主要入口资源基线到 `tests/file-size-refactor/`。
- [x] 更新 `AGENTS.md` 与 `docs/product-development-guardrails.md`，明确物理行数、职责拆分、index、历史迁移例外和禁止压行绕过。

## 2. 独立模块拆分

- [x] 后端：`supabase/functions/{resume-comments,resume-share,llm-proxy,experience-sources,job-submissions}`、`shared/resume-comment-core.ts`；保留唯一服务入口和原协议。既有 `supabase/tests/database/005_backend_maintenance.sql` 保留事务顺序拆分。
- [x] 跟进/助手/档案：`src/pages/{tracker,assistant,experience}`、`src/features/experience-sources`、`src/store/experience-sources` 的全部超限文件，按业务区块、hook、slice 和职责文件组织。
- [x] 基础库/评论：`src/lib`、`src/features/resume-comments`、除档案外的 `src/store` 中全部超限文件，保持缓存、保存队列、账户代次及纯逻辑边界。
- [x] UI/其他页面：`src/components`、`src/pages/{resume,index,history,share,optimize}`、`src/public-homepage` 中全部超限文件；保留组件输出、DOM、样式顺序及动态导入。
- [x] 补查范围：邮件 HTML 按语义拆成源模块与 index，通过现有 Node/pnpm 生成完整 HTML，逐字节核对；编辑器示例 JSON 拆成内容块并核对组合对象。

```ts
// 原模块的公开 API 由目录入口显式转出；内部文件直接互相依赖。
export { PublicComponent } from './components/public-component'
export { usePublicStore } from './store'
export type { PublicOptions } from './types'
```

每组自行扫描新增叶子是否仍超限，对改动文件先运行 Prettier，再运行 ESLint `--fix --fix-type layout`。不在别组文件中做批量导入改写；跨域问题报告主代理解决。

## 3. 集成门禁

- [x] 在现有 `eslint.config.js` 接入 400 行上限；样式与 SQL 源码纳入同一检查，历史大迁移使用精确路径例外。临时增加超限样本验证会失败，再删除样本。
- [x] 核对既有导出可解析、新增循环、唯一运行器/缓存/订阅、路由列表和生产依赖闭包；修复重构引入的问题，不增加功能。
- [x] 运行 `pnpm exec tsc --noEmit`、`pnpm format:check`、`pnpm build` 和相关 Deno 检查，逐项读取真实结果。
- [x] 在 `tests/file-size-refactor/` 用真实模块/页面完成核心流程回归、保存/权限/未知结果、代表弹窗重复及反向操作、减少动效与 PDF 导出；不操作用户现有资料。

## 4. 部署与交付

- [x] 部署验证通过的 Edge 到当前链接项目，检查函数版本、迁移账本不变及线上 smoke；前端保持本地，除非用户另行授权发布。
- [x] 把原文件到目录的映射、剩余例外、真实验证与部署结果记录到 `docs/superpowers/specs/2026-11-16-source-file-size-acceptance.md`。
- [x] 删除临时脚本、账户、数据与服务；再次检查行数、格式和 diff，分别记录实施完成、验证通过、用户审查待进行。
