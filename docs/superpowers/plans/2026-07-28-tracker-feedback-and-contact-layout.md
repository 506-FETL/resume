# 求职看板反馈精简与联系人响应式布局实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精简求职看板的非必要成功 Toast，统一永久删除确认，并让联系人卡片适配大屏、中屏和小屏。

**Architecture:** 在现有 tracker 组件内局部调整反馈和确认状态，不新增全局通知层或 Store 状态。删除确认复用 shadcn `AlertDialog`；联系人字段区使用 Tailwind 响应式网格，字段先保存在本地草稿中，再由区域级“保存修改”按钮一次提交。

**Tech Stack:** React、TypeScript、Tailwind CSS、shadcn/Radix AlertDialog、Sonner、Zustand、Supabase

---

## 文件职责

- `src/pages/tracker/components/drawer/contacts/index.tsx`：联系人本地草稿、显式保存、增删、删除确认、响应式卡片布局及联系人 Toast 策略。
- `src/pages/tracker/components/drawer/activity-timeline/index.tsx`：手动跟进记录创建/删除及删除确认。
- `src/pages/tracker/components/drawer/next-action/index.tsx`：下一步跟进保存/清除，移除普通成功提示。
- `src/pages/tracker/components/list/job-card.tsx`：卡片视图职位操作、删除确认及状态/归档 Toast 清理。
- `src/pages/tracker/components/list/job-table.tsx`：表格视图职位操作、删除确认及状态/归档 Toast 清理。
- `src/pages/tracker/components/board/index.tsx`：看板拖拽状态更新反馈清理。
- `src/pages/tracker/components/header/index.tsx`：批量状态和归档反馈清理。
- `src/pages/tracker/components/drawer/index.tsx`：详情抽屉归档反馈清理。

用户已明确不采用 TDD。本计划不新增测试文件，但每个任务都执行目标文件静态检查，最终执行完整类型检查、构建和手工场景验证。

### 任务 1：联系人反馈、删除确认与响应式布局

**文件：**
- 修改：`src/pages/tracker/components/drawer/contacts/index.tsx`

- [ ] **步骤 1：改为显式保存联系人草稿**

移除所有联系人输入框的 `onBlur` 保存。维护联系人草稿和基线：进入新 `job.id` 时，两者都取该职位的 `job.contacts`；同一职位的其他完整行回写不直接替换联系人基线。通过逐字段比较草稿与基线得到 dirty。联系人区域增加明确的“保存修改”按钮，未修改或保存中禁用。

每次联系人请求捕获 `job.id` 和递增 request token。只有当前职位的最新 token 可以更新草稿、基线和 saving。切换职位时递增 token，并用新职位数据重置草稿、基线、saving 和确认状态。旧职位请求成功晚到时，仅在当前展示不同职位时同步其全局 jobs 条目；同职位 stale 响应不得进入 store。创建/删除成功 Toast 和所有失败 Toast 仍按请求结果显示，但 stale 回调不得改变当前局部状态。

点击“保存修改”后提交当前草稿。当前请求成功时以 `savedJob.contacts` 同时更新草稿和基线、同步 store、静默结束；失败时保留草稿和原基线，显示错误 Toast，按钮保持 dirty 可重试。

- [ ] **步骤 2：保留新增/删除的即时持久化反馈**

dirty 或 saving 时禁用新增和删除，用户必须先保存字段修改。clean 状态下新增和删除继续立即持久化并分别显示“已添加联系人”“已删除联系人”；成功后以 `savedJob.contacts` 同时更新草稿和基线，失败时把草稿回滚到操作前基线并保留错误 Toast。这样结构操作不会顺带持久化未确认字段，也不会丢失草稿。

- [ ] **步骤 3：增加联系人删除确认状态**

增加 `pendingDeleteId: string | null`。删除按钮只设置待删除 ID；`AlertDialog` 的确认按钮调用现有删除持久化路径，取消或关闭时清空状态。对话框展示联系人姓名；空姓名回退为“该联系人”。

- [ ] **步骤 4：实现三档响应式卡片和操作区**

联系人条目外层使用“字段区 + 删除按钮”的两列结构。字段区使用：

```tsx
className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,1.25fr)]"
```

标题区基础样式改为纵向，`sm` 以上恢复横向；“保存修改”和“添加联系人”组成操作区，小屏占满宽度，`sm` 以上为自适应宽度。

- [ ] **步骤 5：检查联系人组件**

运行：

```bash
pnpm exec eslint src/pages/tracker/components/drawer/contacts/index.tsx
```

预期：退出码 0，无 ESLint 错误。

- [ ] **步骤 6：提交联系人改动**

```bash
git add src/pages/tracker/components/drawer/contacts/index.tsx
git commit -m "fix(tracker): refine contact feedback and layout"
```

### 任务 2：跟进记录删除确认与下一步反馈精简

**文件：**
- 修改：`src/pages/tracker/components/drawer/activity-timeline/index.tsx`
- 修改：`src/pages/tracker/components/drawer/next-action/index.tsx`

- [ ] **步骤 1：为手动跟进记录增加删除确认**

在 `ActivityTimeline` 中增加待删除记录 ID。删除图标只打开 `AlertDialog`；确认框展示该记录的 `label`，确认后删除，取消或关闭时清空状态。保留新增记录和删除记录成功 Toast，以及失败 Toast；自动状态记录继续不显示删除按钮。

- [ ] **步骤 2：移除下一步普通成功 Toast**

删除 `handleSave` 中“已更新下一步”和 `handleClear` 中“已清除下一步”的成功 Toast，保留失败 Toast 和现有 saving 状态。

- [ ] **步骤 3：检查两个组件**

运行：

```bash
pnpm exec eslint src/pages/tracker/components/drawer/activity-timeline/index.tsx src/pages/tracker/components/drawer/next-action/index.tsx
```

预期：退出码 0，无 ESLint 错误。

- [ ] **步骤 4：提交跟进区改动**

```bash
git add src/pages/tracker/components/drawer/activity-timeline/index.tsx src/pages/tracker/components/drawer/next-action/index.tsx
git commit -m "fix(tracker): confirm activity deletion"
```

### 任务 3：列表视图职位删除确认与反馈精简

**文件：**
- 修改：`src/pages/tracker/components/list/job-card.tsx`
- 修改：`src/pages/tracker/components/list/job-table.tsx`

- [ ] **步骤 1：为卡片视图职位删除增加确认**

在 `JobCard` 中增加删除确认开关。删除菜单项只打开 `AlertDialog`；确认后调用 `handleDelete`。对话框显示“公司 - 职位”，保留删除成功和失败 Toast。

- [ ] **步骤 2：为表格视图职位删除增加确认**

在 `JobTable` 中增加 `pendingDeleteJob`。每行删除菜单项设置待删除职位；表格外统一渲染一个 `AlertDialog`，确认后调用 `handleDelete(pendingDeleteJob)`，关闭后清空状态。

- [ ] **步骤 3：移除状态与归档成功 Toast**

两个组件均移除 Offer、终止流程、归档和取消归档的成功 Toast；保留状态更新、归档和删除失败 Toast。

- [ ] **步骤 4：检查列表组件**

运行：

```bash
pnpm exec eslint src/pages/tracker/components/list/job-card.tsx src/pages/tracker/components/list/job-table.tsx
```

预期：退出码 0，无 ESLint 错误。

- [ ] **步骤 5：提交列表改动**

```bash
git add src/pages/tracker/components/list/job-card.tsx src/pages/tracker/components/list/job-table.tsx
git commit -m "fix(tracker): confirm job deletion in list views"
```

### 任务 4：清理其余求职看板成功 Toast

**文件：**
- 修改：`src/pages/tracker/components/board/index.tsx`
- 修改：`src/pages/tracker/components/header/index.tsx`
- 修改：`src/pages/tracker/components/drawer/index.tsx`

- [ ] **步骤 1：清理看板状态成功提示**

删除看板拖拽更新到 Offer 或终止流程后的 Toast；保留状态更新失败 Toast 和终态二次确认。

- [ ] **步骤 2：补充批量删除确认**

在 `TrackerHeader` 中增加批量删除确认状态。“删除选中”按钮只打开 `AlertDialog`；对话框展示当前选中职位数量，确认后才调用 `handleDeleteSelectedJobs`，取消或关闭时不发送请求。

- [ ] **步骤 3：清理批量普通成功提示**

删除批量修改状态和批量归档成功 Toast；保留批量删除成功 Toast，以及所有失败 Toast。

- [ ] **步骤 4：清理详情抽屉归档成功提示**

删除归档/取消归档成功 Toast；保留职位删除成功 Toast和所有失败 Toast。

- [ ] **步骤 5：检查三个组件**

运行：

```bash
pnpm exec eslint src/pages/tracker/components/board/index.tsx src/pages/tracker/components/header/index.tsx src/pages/tracker/components/drawer/index.tsx
```

预期：退出码 0，无 ESLint 错误。

- [ ] **步骤 6：提交反馈清理**

```bash
git add src/pages/tracker/components/board/index.tsx src/pages/tracker/components/header/index.tsx src/pages/tracker/components/drawer/index.tsx
git commit -m "fix(tracker): reduce routine success toasts"
```

### 任务 5：全量审计与验证

**文件：**
- 检查：`src/pages/tracker/**/*.{ts,tsx}`

- [ ] **步骤 1：审计剩余 Toast**

运行：

```bash
rg -n "toast\.(success|error|warning|info)" src/pages/tracker
```

预期：`toast.success` 只出现在新增职位、新增联系人、新增跟进记录、删除职位、删除联系人、删除跟进记录和批量删除职位路径；错误及业务阻断提示仍存在。

- [ ] **步骤 2：运行目标文件 ESLint**

```bash
pnpm exec eslint \
  src/pages/tracker/components/drawer/contacts/index.tsx \
  src/pages/tracker/components/drawer/activity-timeline/index.tsx \
  src/pages/tracker/components/drawer/next-action/index.tsx \
  src/pages/tracker/components/list/job-card.tsx \
  src/pages/tracker/components/list/job-table.tsx \
  src/pages/tracker/components/board/index.tsx \
  src/pages/tracker/components/header/index.tsx \
  src/pages/tracker/components/drawer/index.tsx
```

预期：退出码 0，无 ESLint 错误。

- [ ] **步骤 3：运行 TypeScript 类型检查**

```bash
npx tsc --noEmit
```

预期：退出码 0，无类型错误。

- [ ] **步骤 4：运行生产构建**

```bash
pnpm build
```

预期：退出码 0；允许既有的大 chunk 警告。

- [ ] **步骤 5：手工验证交互与响应式布局**

在 375px、768px、1440px 三个视口检查联系人字段分别为单列、两列两行、单行。验证联系人编辑后保存按钮启用、dirty 时新增/删除禁用、保存失败保留草稿、新增/删除失败回滚、同职位无关完整行回写不覆盖 dirty/保存中状态，以及切换职位后旧请求晚到不影响新职位。验证联系人/手动跟进记录/卡片职位/表格职位及批量职位的删除取消和确认路径，并核对批量确认框显示正确的选中数量；验证普通更新不再弹成功 Toast，创建、删除、失败和业务阻断仍有反馈。

- [ ] **步骤 6：记录验证结果并提交计划更新**

将本计划所有已完成步骤勾选，并在验证步骤后追加实际命令结果或环境限制，然后提交：

```bash
git add docs/superpowers/plans/2026-07-28-tracker-feedback-and-contact-layout.md
git commit -m "docs: record tracker feedback verification"
```
