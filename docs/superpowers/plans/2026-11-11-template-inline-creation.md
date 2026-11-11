# 模板页原地创建实现计划

> 本轮明确授权，使用 subagent-driven-development 分离数据任务和 UI 任务；主代理整合与审查。遵循仓库规则，不采用 TDD、不新建分支、不提交或推送。

**目标：** “使用此模板”留在当前预览窗口完成填写与创建，不打开我的简历创建向导。

**架构：** 页面 store 管理 preview/details；页面独立创建草稿与 hook 管理字段、冻结操作和持久化。底层继续用既有创建核心、IndexedDB 和真实模板来源。原预览保持挂载并保存阅读位置，信息面板在同一窗口内过渡。

**技术栈：** React、Zustand、现有 shadcn 组件、Motion、现有 IndexedDB 与创建持久化。

## 1. 独立创建数据

文件：src/pages/template/hooks/use-template-creation.ts、store/creation.ts；src/lib/resume-template/create/types.ts；src/lib/resume-preparation/storage.ts。

- [x] 新草稿仅有 displayName、description 和可选冻结 operation；存储键为账户＋精确模板，不能复用 ImportDraft 或 create-resume-card store。
- [x] hook 提供 draft、patchDraft、ready、locked、loading、error、mode、isExampleReady 与最终 create(example)。使用按钮只切换页面步骤。
- [x] 创建前持久化冻结操作，复用 start 和示例证据；确认成功后更新列表并导航，未确认保持同 ID，账户/页面会话守卫沿用。
- [x] 在 tests/template-inline-creation 下验证真实 store、hook 和持久化边界：零提前写入、精确非默认示例、空白兜底、原导入草稿不变、未知重试、账户与关闭重开。

## 2. 当前窗口原地交互

文件：src/pages/template/types.ts、store.ts、index.tsx、components/preview-dialog/index.tsx；新增 components/preview-workspace/index.tsx、components/creation-form/index.tsx；移除 components/creation-dialog/index.tsx。

- [x] 将 creationOpen 交接替换为 previewStep: 'preview' | 'details'，外层 previewOpen 不变。
- [x] 使用已有组件实现模板页表单，接独立 draft；默认和最终兜底一致。
- [x] 保留原排版实例与预览滚动位置，详情使用精确预览背景；桌面向右渐隐，手机向下渐隐。
- [x] Footer 在同一窗口切换“返回预览 / 创建简历”，只在成功后关闭；错误留在当前步骤且可重试。
- [x] 公共时长、缓动、减少动效和焦点衔接；实际采样两轮、反向、深浅色及手机短屏。

## 3. 集成与交付

- [x] 审查当前页面无 create-resume-card 导入；移除旧交接状态与不再使用的参数，保留我的简历自身行为。
- [x] 更新必要的隔离验收入口，完成真实流程、保存和 UI 复核；清理本轮已完成的脚本及数据。
- [x] 修改文件 Prettier → ESLint layout；运行 tsc、pnpm build、pnpm format:check、git diff --check。
- [x] 更新规格、验收、防回归和被取代的历史决定，分别记录实现、验证与用户审查状态。

实施与本轮验证完成，用户审查待进行。实际证据见 [验收记录](../specs/2026-11-11-template-inline-creation-acceptance.md)。
