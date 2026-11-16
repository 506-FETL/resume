# 职业档案响应式布局与批量管理实现计划

> **面向 AI 代理的工作者：** 在当前会话内按 executing-plans 逐项实现与复核；用户已授权，不重复确认，不创建分支或提交。不采用 TDD，必要验证使用真实实现。

**目标：** 大屏自动增加卡片列数，并允许在资料库直接删除与批量删除。

**架构：** 保留现有库页、分页与全局资料缓存。页面 store 管理跨组件选择和删除任务；单项与批量共用确认组件，复用领域删除及未知结果核对。期间暂停本页重读，任务结束再刷新。

**技术栈：** React、Zustand、Tailwind、现有 shadcn 与 Motion，无后端变更及新依赖。

**规格：** [设计](../specs/2026-11-16-career-library-management-design.md)。

## 1. 布局与管理状态

- [x] 修改 `src/pages/experience/const.ts`，网格与现有骨架共享自然列数：

```ts
export const EXPERIENCE_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4'
```

- [x] 在 `types.ts` 定义只含 id/name 的删除目标；在 `store.ts` 管理 selectionMode、selectedSources、deleteOpen、deleteTargets、deleting、deleteProgress、deleteError。搜索/类型切换清空选择，翻页保留；确认时冻结目标，成功项移除，失败项保留。
- [x] `src/store/experience-sources/index.ts` 的 remove 增加可选 AbortSignal，传给已有 delete/metadata API；批量任务订阅账户 generation 并取消 signal。`hooks/use-experience-list.ts` 删除中暂停读取，结束由已有缓存失效重读。

## 2. 页面入口与反馈

- [x] `components/source-item/index.tsx` 调整为同级打开按钮与删除/勾选控件，保留真实摘要及长标题换行。选择模式点击条目切勾选，单删直接进入确认。
- [x] 新建 `components/library-selection/index.tsx`，组合 Checkbox 和 Button，明确全选本页、已选数量、清空、删除和退出；使用现有过渡预设并接入减少动效。
- [x] 新建 `components/delete-sources-dialog/index.tsx`，组合 AlertDialog 与 Spinner，显示名称、删除范围、进度和失败；取消保持选择，成功回稳定入口，关闭期间保留目标。
- [x] 在 `components/library/index.tsx` 集成管理栏、确认框和删除退出动效；暂停删除中的分页/上传，保持失败与空态含义。同步 `src/components/page-skeletons/experience.tsx` 管理入口占位。

## 3. 验证与记录

- [x] 临时 `tests/career-library-management/` 夹具渲染真实页面并在网络边界提供 23 项合成资料。Chromium 与 WebKit 验证布局、键盘/触屏、两轮确认框与快速反向、深色及运行中减少动效。
- [x] 检查跨页选择、取消、清空、筛选清选择、单删、批量成功/部分失败/未知结果重试；统计逐项删除与统一刷新次数，末页回退，账户切换后不再启动旧删除。
- [x] 改动文件运行 Prettier，再 ESLint `--fix --fix-type layout`；运行 `pnpm exec tsc --noEmit`、`pnpm build`、清理后的 `pnpm format:check`、`git diff --check`，修复本轮问题。
- [x] 使用 review-animations 与 verification-before-completion 复核，记录实际结果到同目录规格验收文档，向防回归清单补充触发/根因/长期约束/验收方法；删除本轮 tests 临时产物与服务。

状态：实施完成；功能验证及工程检查通过；用户审查待进行。验收记录见同日 career-library-management-acceptance.md。
