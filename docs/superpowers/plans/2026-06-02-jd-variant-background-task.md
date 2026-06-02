# JD 派生任务后台保活 实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 让 JD 派生（变体）的 LLM 链式调用在用户关闭弹窗 / 切换页面后继续在后台运行，并支持从右上角"派生任务"列表点击重新进入查看实时大模型过程。

**架构：** 把派生生成状态与 async 流程从组件本地（`useState`/`useRef`）迁入一个独立全局 zustand store（`src/store/jd-variant/`），AbortController 存 module-level Map；删除"组件卸载即 abort"的 effect（Bug 根因）。`useJdVariantGenerator` 降级为 store 选择器封装。弹窗、派生任务列表、右上角角标均订阅该 store。完全对齐 ATS 优化（`src/pages/optimize/store.ts`）的后台任务模式。

**技术栈：** React 19 + TypeScript + Vite + Zustand 5 + shadcn/ui + sonner（toast）。本仓库**无单元测试框架**，验证统一用 `npx tsc --noEmit`、`npm run lint` 以及 `npm run dev` 手动冒烟。

**关键约束（来自 spec 与评审）：**
- 多任务并发，按 `parentResumeId` 隔离（`Record<string, VariantTask>`）。
- 内存保活，不持久化。
- 保留主动取消（`abortTask` 置 `aborted` 但不删草稿；`discardTask` 删草稿+移除）。
- 关闭/离开弹窗不再 abort、不再删草稿。
- 点卡片"派生"前需清理非活跃残留 task（消歧）。
- `aborted` phase 必须有 UI 出口；controllers Map 与 store state 都要清理。
- optimize 入口（`job-description/index.tsx`）的 `JdVariantDialog` 用法需同步适配。

参考 spec：`docs/superpowers/specs/2026-06-02-jd-variant-background-task-design.md`

---

## 文件结构

新建：
- `src/store/jd-variant/types.ts` — `VariantTask`、`JdVariantStore` 类型与 `makeIdleTask` 工厂。
- `src/store/jd-variant/generate.ts` — `startGenerate` 异步流程（从旧 hook 迁移），module-level `controllers` Map。
- `src/store/jd-variant/index.ts` — `create<JdVariantStore>()` 与 hook 导出。

修改：
- `src/components/jd-variant/use-jd-variant-generator.ts` — 降级为 store 选择器封装，删除卸载 abort。
- `src/components/jd-variant/jd-variant-dialog.tsx` — 关闭不再 abort/删草稿；新增 `aborted` 分支；hook 改传 `parentResumeId`。
- `src/components/jd-variant/steps/step-result.tsx`（如涉及，仅核对，不一定改）。
- `src/components/jd-variant/derived-jobs-dialog.tsx` — "生成中"项加"查看进度"，数据源接 store。
- `src/pages/resume/components/resume-card/index.tsx` — `handleDeriveClick` 新建前清理非活跃残留 task。
- `src/pages/resume/components/head-bars/index.tsx` — `pendingCount` 接入 store 活跃任务。
- `src/pages/resume/index.tsx` — 弹窗 `open`/`onOpenChange` 适配。
- `src/pages/optimize/components/advanced-tools/job-description/index.tsx` — 适配 hook 新接口（hook 现在无内部 state，组件用法基本不变，但需确认 `skipInputStep` 自动触发逻辑不读旧 task）。

---

## 任务 1：新建 store 类型与 idle 工厂

**文件：**
- 新建：`src/store/jd-variant/types.ts`

- [ ] **步骤 1：编写类型文件**

复用 `src/components/jd-variant/types.ts` 中既有的 `GeneratorPhase`、`VariantChange`、`ResumeSchema`、`GenerateVariantArgs`。

```ts
import type { GenerateVariantArgs, GeneratorPhase, VariantChange } from '@/components/jd-variant/types'
import type { ResumeSchema } from '@/lib/schema'

export interface VariantTask {
  parentResumeId: string
  phase: GeneratorPhase
  draftResumeId: string | null
  keywords: string[]
  changes: VariantChange[]
  completedSections: Array<keyof ResumeSchema>
  errorMessage: string | null
  matchRate: number
  parseReasoning: string
  rewriteReasoning: string
  rewriteContent: string
}

export interface JdVariantStore {
  tasks: Record<string, VariantTask>
  startGenerate: (args: GenerateVariantArgs) => Promise<void>
  abortTask: (parentResumeId: string) => void
  discardTask: (parentResumeId: string) => Promise<void>
  clearTask: (parentResumeId: string) => void
}

export function makeIdleTask(parentResumeId: string): VariantTask {
  return {
    parentResumeId,
    phase: 'idle',
    draftResumeId: null,
    keywords: [],
    changes: [],
    completedSections: [],
    errorMessage: null,
    matchRate: 0,
    parseReasoning: '',
    rewriteReasoning: '',
    rewriteContent: '',
  }
}
```

> 注意：旧 `GeneratorState` 含 `logs` 字段。先用 Grep 确认无 Step 组件读取 `state.logs`（评审问题 8）；若无，则 `VariantTask` 不带 `logs`。

- [ ] **步骤 2：确认 logs 字段无外部读取**

运行（用 Grep 工具）：搜索 `state.logs` 与 `.logs` 在 `src/components/jd-variant/` 下的引用。
预期：无 Step 组件读取 `state.logs`。若有，则在 `VariantTask` 补回 `logs: VariantAnalysisLog[]`。

- [ ] **步骤 3：类型校验**

运行：`npx tsc --noEmit`
预期：PASS（新文件不应引入类型错误；此时 store 尚未被引用）。

- [ ] **步骤 4：提交**

```bash
git add src/store/jd-variant/types.ts
git commit -m "feat(jd-variant): add background task store types"
```

---

## 任务 2：迁移生成流程到 store（generate.ts）

**文件：**
- 新建：`src/store/jd-variant/generate.ts`

把 `src/components/jd-variant/use-jd-variant-generator.ts` 的 `generate`/`computeDepth`/`discardDraft` 逻辑迁入，改为操作 store 的 `tasks[parentId]`。

- [ ] **步骤 1：编写 generate.ts**

要点：
- module-level `const controllers = new Map<string, AbortController>()`。
- 导出 `createStartGenerate(set, get)`、`createAbortTask(set, get)`、`createDiscardTask(set, get)`、`createClearTask(set, get)` 工厂（接收 zustand 的 `set`/`get`）。
  - 类型提示（评审 P6）：为让 generate.ts 独立编译通过，工厂参数须显式标注 zustand 类型，例如 `import type { StoreApi } from 'zustand'`，`set: StoreApi<JdVariantStore>['setState']`、`get: StoreApi<JdVariantStore>['getState']`（或等价的 `() => JdVariantStore`）。
- `startGenerate(args)`：
  - `const { parentResumeId } = args`
  - 先 `controllers.get(parentResumeId)?.abort()`；`const ctrl = new AbortController(); controllers.set(parentResumeId, ctrl)`。
  - `patch(parentResumeId, { ...makeIdleTask(parentResumeId), phase: 'parsing' })`（用一个内部 `patch` helper 做不可变更新：`set(s => ({ tasks: { ...s.tasks, [parentResumeId]: { ...(s.tasks[parentResumeId] ?? makeIdleTask(parentResumeId)), ...partial } } }))`）。
  - 把旧 `generate` 的全部步骤（深度检查、parse、建草稿、rewrite、apply、markReady）搬入，所有 `setState(s => ...)` 改为 `patch(parentResumeId, ...)`，所有 `ctrl.signal.aborted` 检查保留。
  - catch：非 abort 时 `markVariantFailed` + `patch(phase:'error', errorMessage)`，与旧逻辑一致（注意从 `get().tasks[parentResumeId]?.draftResumeId` 取草稿 id）。
  - finally：`if (controllers.get(parentResumeId) === ctrl) controllers.delete(parentResumeId)`。
- `abortTask(parentResumeId)`（**评审 P1：避免 DB 僵尸草稿**）：
  - `controllers.get(parentResumeId)?.abort(); controllers.delete(parentResumeId)`。
  - 取 `get().tasks[parentResumeId]?.draftResumeId`，若存在则按 online/offline 调 `markVariantFailed`/`markOfflineVariantFailed`（message 传 `'已取消'`），把 DB 草稿从 `generating` 落到 `failed`，避免取消后 DB 永远停在 `generating`。`.catch(() => undefined)` 忽略落库失败。
  - `patch(parentResumeId, { phase: 'aborted' })`（内存仍区分"已取消"与"失败"，供 aborted 视图展示"重新生成/丢弃"）。
  - 由于 DB 已是 `failed`，DerivedJobsDialog 的 DB 兜底与 head-bars 角标口径统一（不会再把已取消任务误显示为"生成中"）。
- `discardTask(parentResumeId)`：取 `get().tasks[parentResumeId]?.draftResumeId`，abort + delete controller，按 online/offline 删草稿（`deleteDraftVariant`/`deleteOfflineDraftVariant`），然后从 `tasks` 移除该 key。
- `clearTask(parentResumeId)`：`controllers.get(parentResumeId)?.abort(); controllers.delete(parentResumeId)`，从 `tasks` 移除该 key（不删草稿）。

> 完整代码量较大，执行时直接以旧 `use-jd-variant-generator.ts:82-253` 为蓝本逐行迁移，仅替换状态写入方式与 abort 句柄来源。

- [ ] **步骤 2：类型校验**

运行：`npx tsc --noEmit`
预期：PASS（generate.ts 仍未被 index 引用也应能独立编译；若工厂签名依赖 store 类型，先在本步保证类型自洽）。

- [ ] **步骤 3：提交**

```bash
git add src/store/jd-variant/generate.ts
git commit -m "feat(jd-variant): migrate generation flow into store module"
```

---

## 任务 3：组装 store（index.ts）

**文件：**
- 新建：`src/store/jd-variant/index.ts`

- [ ] **步骤 1：编写 index.ts**

```ts
import type { JdVariantStore } from './types'
import { create } from 'zustand'
import { createAbortTask, createClearTask, createDiscardTask, createStartGenerate } from './generate'

const useJdVariantStore = create<JdVariantStore>()((set, get) => ({
  tasks: {},
  startGenerate: createStartGenerate(set, get),
  abortTask: createAbortTask(set, get),
  discardTask: createDiscardTask(set, get),
  clearTask: createClearTask(set, get),
}))

export default useJdVariantStore
export type { JdVariantStore, VariantTask } from './types'
export { makeIdleTask } from './types'
```

- [ ] **步骤 2：类型校验**

运行：`npx tsc --noEmit`
预期：PASS。

- [ ] **步骤 3：提交**

```bash
git add src/store/jd-variant/index.ts
git commit -m "feat(jd-variant): assemble background task store"
```

---

## 任务 4：降级 hook 为 store 选择器封装

**文件：**
- 修改：`src/components/jd-variant/use-jd-variant-generator.ts`

- [ ] **步骤 1：重写 hook**

整文件替换为薄封装（接收 `parentResumeId` 参数）：

```ts
import type { GenerateVariantArgs } from './types'
import { useCallback } from 'react'
import useJdVariantStore, { makeIdleTask } from '@/store/jd-variant'

export function useJdVariantGenerator(parentResumeId: string) {
  const task = useJdVariantStore(s => s.tasks[parentResumeId])
  const startGenerate = useJdVariantStore(s => s.startGenerate)
  const abortTask = useJdVariantStore(s => s.abortTask)
  const discardTask = useJdVariantStore(s => s.discardTask)
  const clearTask = useJdVariantStore(s => s.clearTask)

  const state = task ?? makeIdleTask(parentResumeId)

  const generate = useCallback((args: GenerateVariantArgs) => startGenerate(args), [startGenerate])
  const abort = useCallback(() => abortTask(parentResumeId), [abortTask, parentResumeId])
  const discardDraft = useCallback(() => discardTask(parentResumeId), [discardTask, parentResumeId])
  const reset = useCallback(() => clearTask(parentResumeId), [clearTask, parentResumeId])

  return { state, generate, abort, reset, discardDraft }
}
```

> 保留旧返回字段名（`abort`/`reset`/`discardDraft`），把 `generate`/`computeDepth` 等实现删除（已迁到 store）。删除原 `useEffect(() => () => abortRef.current?.abort(), [])`。
>
> 命名说明（评审 P3）：spec §4.2 hook 返回字段名为 `discard`，本计划统一采用 `discardDraft`（更贴近旧 hook 既有接口、调用点改动最小）。**以本计划的 `discardDraft` 为准**；执行时 spec 中的 `discard` 视为同义。

- [ ] **步骤 2：类型校验**

运行：`npx tsc --noEmit`
预期：**只**出现 `jd-variant-dialog.tsx` 调用 `useJdVariantGenerator()` 缺少 `parentResumeId` 参数的错误——这是预期的瞬时错误，将在任务 5 一并修复。

> 说明（评审 P2）：`job-description/index.tsx` **不调用** `useJdVariantGenerator`（仅渲染 `<JdVariantDialog>`），因此不会因本任务报错；任务 9 只是对其打开逻辑做消歧适配，与本任务的类型错误无关。唯一受影响的调用点是 `jd-variant-dialog.tsx`。

- [ ] **步骤 3：提交（编译预期失败，下一任务修复）**

> ⚠️ 评审 P2：本步提交时 `npx tsc --noEmit` 仍会因 `jd-variant-dialog.tsx` 缺参而失败。这是 hook 接口变更的必然中间态。为保持任务粒度清晰，**允许此 commit 编译失败**，紧接的任务 5 提交即恢复全绿。若执行者偏好不留下编译失败的提交，可改为：**跳过本步单独提交，将任务 4 与任务 5 的改动合并为任务 5 末尾的一次提交**（提交信息合并两条 message）。二者任选其一，默认采用前者（标注式独立提交）。

```bash
git add src/components/jd-variant/use-jd-variant-generator.ts
git commit -m "refactor(jd-variant): make hook a thin store selector, drop unmount abort

note: tsc fails transiently here (jd-variant-dialog.tsx missing arg); fixed in next task"
```

---

## 任务 5：改造 JdVariantDialog（关闭保活 + aborted 分支）

**文件：**
- 修改：`src/components/jd-variant/jd-variant-dialog.tsx`

- [ ] **步骤 1：hook 改传 parentResumeId**

把 `const { state, generate, abort, reset, discardDraft } = useJdVariantGenerator()` 改为 `useJdVariantGenerator(parentResumeId)`。

- [ ] **步骤 2：关闭逻辑改为后台保活**

`handleOpenChange` 改为：生成中关闭时不再弹确认，直接关闭并 toast 提示。

```tsx
const handleOpenChange = (next: boolean) => {
  if (!next && (state.phase === 'parsing' || state.phase === 'rewriting')) {
    toast.info('正在后台继续派生，可在右上角“派生任务”查看进度')
  }
  if (!next && (state.phase === 'idle')) {
    reset()
    setJd('')
  }
  onOpenChange(next)
}
```

> 导入 `import { toast } from 'sonner'`。`success`/`error`/`aborted` 关闭时保留 task（不 reset），以便从派生任务列表重开或后续处理。删除 `confirmClose` 相关 state 与底部 `AlertDialog`（不再需要"关闭并丢弃"确认）。

- [ ] **步骤 3：新增 aborted 渲染分支**

在 success 分支后增加：

```tsx
{state.phase === 'aborted' && (
  <Alert>
    <AlertCircle className="size-4" aria-hidden />
    <AlertTitle>已取消派生</AlertTitle>
    <AlertDescription className="space-y-2">
      <div>生成已取消，草稿仍保留。</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!jd.trim()} onClick={startGenerate}>重新生成</Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            discardDraft().catch(() => undefined)
            onOpenChange(false)
          }}
        >
          丢弃草稿
        </Button>
      </div>
    </AlertDescription>
  </Alert>
)}
```

> ⚠️ 评审 P4：复用本组件**既有的无参本地回调 `startGenerate`**（`jd-variant-dialog.tsx:37-39`，内部用本地 `jd` 组装 `{ parentResumeId, jdText: jd }` 后调 hook 的 `generate(args)`）。error 重试（line 82）和 StepInput（line 99）已在用它，直接 `onClick={startGenerate}` 即可，**无需新增或重命名为 `handleStart`**。注意区分两层同名概念：组件本地 `startGenerate` 无参（正确用）；store action / hook 的 `generate`/`startGenerate` 需要 `GenerateVariantArgs`，**不可无参直传**。
>
> 冒烟依赖（评审 P4）：`aborted` 视图依赖本地 `jd` 非空。两种进入路径需在任务 10 场景 4/6 验证：
> - 同会话内"取消"：本地 `jd` 仍为用户输入值，`startGenerate` 可直接重跑。
> - 从"派生任务"列表重开后再取消：弹窗重新挂载，本地 `jd` 初值来自 `initialJd`/`skipInputStep`；若重开时 `jd` 为空，则 `disabled={!jd.trim()}` 会禁用"重新生成"，用户需回 StepInput 重填。务必在冒烟中确认重开路径下 `jd` 是否被正确回填，并据实记录。

- [ ] **步骤 4：清理 success/error 分支里的 reset 语义**

确认 `success` 的"打开"按钮：`onOpenResume(draftId)` → `reset()`（= clearTask）→ `onOpenChange(false)`，顺序保持。`error` 的"放弃草稿"：`discardDraft()` → `onOpenChange(false)`（不再单独 reset，discardTask 已移除 task）。

- [ ] **步骤 5：类型 + lint 校验**

运行：`npx tsc --noEmit && npm run lint`
预期：PASS（本组件不再有未用的 `AlertDialog` 导入；如有未用导入按 lint 提示删除）。

- [ ] **步骤 6：提交**

```bash
git add src/components/jd-variant/jd-variant-dialog.tsx
git commit -m "feat(jd-variant): keep generation alive on close, add aborted branch"
```

---

## 任务 6：改造 DerivedJobsDialog（查看进度入口）

**文件：**
- 修改：`src/components/jd-variant/derived-jobs-dialog.tsx`

- [ ] **步骤 1：接入 store 任务作为"生成中"主数据源**

在组件顶部引入 `import useJdVariantStore from '@/store/jd-variant'` 并取 `const tasks = useJdVariantStore(s => s.tasks)`、`const discardTask = useJdVariantStore(s => s.discardTask)`。

构造"生成中"列表：以 store 中 `phase ∈ {parsing, rewriting}` 的任务为主（key 即 parentResumeId，展示父简历名可从 `resumes` 按 parentResumeId 查 `display_name`），并合并 `resumes` 中 `derived_status === 'generating'` 但 store 无对应活跃 task 的兜底项（按 parentId 去重）。

合并/去重伪代码（评审 P5）：

```tsx
type RunningItem = {
  parentResumeId: string
  parentName: string          // resumes 中按 parentResumeId 查 display_name，查不到回退 '未命名简历'
  source: 'store' | 'db'      // store=可“查看进度”续播；db=仅兜底展示
  dbResumeId?: string         // db 兜底项的 resume_id，供“丢弃”用现有 discard(resume_id)
}

// 1) store 活跃任务（可续播实时过程）
const storeRunning: RunningItem[] = Object.values(tasks)
  .filter(t => t.phase === 'parsing' || t.phase === 'rewriting')
  .map(t => ({
    parentResumeId: t.parentResumeId,
    parentName: resumeNameById.get(t.parentResumeId) ?? '未命名简历',
    source: 'store',
  }))

const storeParentIds = new Set(storeRunning.map(i => i.parentResumeId))

// 2) DB 兜底：generating 且 store 无对应活跃 task（按父简历去重）
const dbRunning: RunningItem[] = resumes
  .filter(r => r.derived_status === 'generating')
  .filter(r => !storeParentIds.has(r.parent_resume_id ?? ''))
  .map(r => ({
    parentResumeId: r.parent_resume_id ?? r.resume_id,
    parentName: resumeNameById.get(r.parent_resume_id ?? '') ?? '未命名简历',
    source: 'db',
    dbResumeId: r.resume_id,
  }))

const runningItems = [...storeRunning, ...dbRunning]
```

> 渲染时按 `source` 决定按钮：`store` 项显示"查看进度"（`openDeriveFor`）+"丢弃"（`discardTask`）；`db` 兜底项无可续播过程，仅"丢弃"（现有 `discard(dbResumeId)`），不显示"查看进度"或显示禁用态。`resumeNameById` 为一次性构造的 `Map<resume_id, display_name>`。

- [ ] **步骤 2："生成中"项加"查看进度"按钮**

每项渲染"查看进度"按钮，点击：

```tsx
onClick={() => { openDeriveFor(parentResumeId); onOpenChange(false) }}
```

"丢弃"按钮：store 活跃任务调 `discardTask(parentResumeId)`；DB 兜底项沿用现有 `discard(resume_id)`。

- [ ] **步骤 3：失败区重试改为基于 store**

`retry`：先 `clearTask`/`discard` 再 `openDeriveFor(parentId)`，保持现有交互。

- [ ] **步骤 4：类型 + lint 校验**

运行：`npx tsc --noEmit && npm run lint`
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/components/jd-variant/derived-jobs-dialog.tsx
git commit -m "feat(jd-variant): add view-progress entry for running tasks"
```

---

## 任务 7：ResumeCard 派生前消歧 + head-bars 角标接入

**文件：**
- 修改：`src/pages/resume/components/resume-card/index.tsx`
- 修改：`src/pages/resume/components/head-bars/index.tsx`

- [ ] **步骤 1：ResumeCard 新建派生前清理非活跃残留 task**

引入 `import useJdVariantStore from '@/store/jd-variant'`，在 `handleDeriveClick` 中：

```tsx
const handleDeriveClick = (e: MouseEvent<HTMLButtonElement>) => {
  e.stopPropagation()
  const task = useJdVariantStore.getState().tasks[resume.resume_id]
  if (task && (task.phase === 'success' || task.phase === 'error' || task.phase === 'aborted')) {
    useJdVariantStore.getState().clearTask(resume.resume_id)
  }
  openDeriveFor(resume.resume_id)
}
```

- [ ] **步骤 2：head-bars 角标接入 store 活跃任务**

`pendingCount` 改为：store 中 `phase ∈ {parsing, rewriting, error, aborted}` 的任务数，并入 `resumes` 中 `derived_status ∈ {generating, failed}` 的兜底项，按 parentId/resume_id 去重；`success` 不计入。

```tsx
const tasks = useJdVariantStore(s => s.tasks)
const activeParentIds = new Set(
  Object.values(tasks)
    .filter(t => t.phase === 'parsing' || t.phase === 'rewriting' || t.phase === 'error' || t.phase === 'aborted')
    .map(t => t.parentResumeId),
)
// DB 兜底：先按父简历维度去重（评审 P3：同一父简历可能有多条 failed/generating 草稿），再排除已被 store 覆盖的父
const dbPendingParentIds = new Set(
  resumes
    .filter(r => r.derived_status === 'generating' || r.derived_status === 'failed')
    .map(r => r.parent_resume_id ?? '')
    .filter(pid => pid && !activeParentIds.has(pid)),
)
const pendingCount = activeParentIds.size + dbPendingParentIds.size
```

> 去重以"父简历维度"为准（store key 是 parentId，DB 兜底用 `r.parent_resume_id` 先内部去重再与 store 去重），避免同一父简历的多条草稿被重复计数。

- [ ] **步骤 3：类型 + lint 校验**

运行：`npx tsc --noEmit && npm run lint`
预期：PASS。

- [ ] **步骤 4：提交**

```bash
git add src/pages/resume/components/resume-card/index.tsx src/pages/resume/components/head-bars/index.tsx
git commit -m "feat(jd-variant): disambiguate re-derive and wire store-based badge count"
```

---

## 任务 8：resume/index.tsx 弹窗渲染适配

**文件：**
- 修改：`src/pages/resume/index.tsx`

- [ ] **步骤 1：确认条件渲染下关闭不再中断后台任务**

由于状态已在 store、hook 已移除卸载 abort，现有 `{derivePendingFor && <JdVariantDialog/>}` 即便卸载也不会 abort。无需结构性改动，仅核对 `onOpenChange` 仍 `openDeriveFor(null)`。

> 可选优化：若希望 success 任务关闭后再次打开仍能看到结果，保持条件渲染即可（重新挂载会从 store 还原）。本任务不强制改动，只做核对。

- [ ] **步骤 2：类型 + lint 校验**

运行：`npx tsc --noEmit && npm run lint`
预期：PASS。

- [ ] **步骤 3：提交（若有改动）**

```bash
git add src/pages/resume/index.tsx
git commit -m "chore(jd-variant): verify dialog rendering keeps background task alive"
```

---

## 任务 9：适配 optimize 入口（job-description）

**文件：**
- 修改：`src/pages/optimize/components/advanced-tools/job-description/index.tsx`

- [ ] **步骤 1：核对 JdVariantDialog 用法**

该组件不直接调用 `useJdVariantGenerator`，仅渲染 `<JdVariantDialog .../>`，因此 hook 接口变更不影响它。重点核对：`skipInputStep` + `initialJd` 场景下，`JdVariantDialog` 内部 `useEffect`（自动 `startGenerate`）的触发条件是 `state.phase === 'idle'`。

由于 store 中该 parentId 可能残留旧 task（非 idle），需保证打开 optimize 派生时也走消歧。

- [ ] **步骤 2：打开派生前清理非活跃残留 task**

在 `onClick={() => setDeriveOpen(true)}` 改为：

```tsx
onClick={() => {
  const task = useJdVariantStore.getState().tasks[resumeContext.resumeId]
  if (task && (task.phase === 'success' || task.phase === 'error' || task.phase === 'aborted')) {
    useJdVariantStore.getState().clearTask(resumeContext.resumeId)
  }
  setDeriveOpen(true)
}}
```

引入 `import useJdVariantStore from '@/store/jd-variant'`。

> 若该 parentId 已有活跃任务（parsing/rewriting），`skipInputStep` 的 effect 因 `phase !== 'idle'` 不会重复触发，会直接展示进行中的实时过程——符合预期。

- [ ] **步骤 3：类型 + lint 校验**

运行：`npx tsc --noEmit && npm run lint`
预期：PASS。

- [ ] **步骤 4：提交**

```bash
git add src/pages/optimize/components/advanced-tools/job-description/index.tsx
git commit -m "feat(jd-variant): disambiguate optimize-entry derive against stale task"
```

---

## 任务 10：手动冒烟验证（无单测框架）

**文件：** 无（运行验证）

- [ ] **步骤 1：全量类型 + lint**

运行：`npx tsc --noEmit && npm run lint`
预期：PASS。

- [ ] **步骤 2：启动 dev 手动验证场景**

运行：`npm run dev`，逐项验证：
1. 在简历列表点"派生"→ 输入 JD → 开始生成 → **关闭弹窗**：生成应继续（右上角"派生任务"角标 +1），并弹 toast。
2. 点右上角"派生任务"→ 列表出现"生成中"项 → 点"查看进度"→ 弹窗重开并**续播实时 reasoning/content**（不是从头开始）。
3. 等待完成 → success 视图 → "打开"草稿进入编辑器；"派生任务"角标对应清零。
4. 生成中点弹窗内"取消生成"→ 进入 aborted 视图 → "重新生成"可重跑；"丢弃草稿"删除并关闭。
5. 对同一父简历"成功/失败/取消"后再次点"派生"→ 应是全新 StepInput，而非旧结果。
6. optimize 页"派生针对性简历"→ 自动跳过输入 → 关闭后台继续 → 同样可在简历页"派生任务"重开查看。
7. 同时对两份不同简历发起派生 → 两个任务并发互不干扰，角标计数为 2。

> 执行记录：在此追加每个场景的实际结果或环境限制说明。

- [ ] **步骤 3：最终提交（如冒烟中有微调）**

```bash
git add -A
git commit -m "fix(jd-variant): polish background task UX after smoke test"
```

---

## 完成标准

- LLM 派生调用在关闭弹窗 / 切页后继续后台运行，不被中断。
- 右上角"派生任务"数字角标实时反映进行中/失败/取消的任务数。
- 从派生任务列表点击可重开弹窗并续播实时大模型过程。
- 保留主动取消（aborted 有明确 UI 出口）与丢弃草稿能力。
- 多任务按父简历并发隔离。
- `npx tsc --noEmit` 与 `npm run lint` 全绿。
