# JD 派生任务后台保活 — 设计文档

- 日期：2026-06-02
- 主题：让 JD 派生（变体）的 LLM 链式调用在用户关闭弹窗 / 切换页面后继续在后台运行，并支持从右上角"派生任务"重新进入查看实时大模型过程。

## 1. 背景与问题

当前 JD 派生生成逻辑由 `useJdVariantGenerator`（[use-jd-variant-generator.ts](../../../src/components/jd-variant/use-jd-variant-generator.ts)）持有：

- 生成状态（`phase` / `parseReasoning` / `rewriteReasoning` / `rewriteContent` / `changes` / `draftResumeId` …）存在**组件本地 `useState`**。
- `AbortController` 存在**本地 `useRef`**。
- 钩子内有 `useEffect(() => () => abortRef.current?.abort(), [])`：**组件卸载即 abort 底层 fetch/SSE 流**。
- `JdVariantDialog` 在 `resume/index.tsx` 中被 `{derivePendingFor && <JdVariantDialog/>}` 条件渲染，关闭弹窗 → `openDeriveFor(null)` → 弹窗连同钩子一起卸载 → 触发清理 abort。

**结果（Bug）**：用户在 LLM 正在链式输出时关闭弹窗，大模型调用被立即中断，且二次确认还会主动 `abort()` + `discardDraft()` 删除草稿。这不符合预期——预期应是**后台继续生成**，右上角"派生任务"提示，点击可重新查看正在进行的大模型过程。

## 2. 参考实现：ATS 优化的后台任务模式

简历优化（ATS）页面已实现等价的"后台保活 + 重开查看"模式（[optimize/store.ts](../../../src/pages/optimize/store.ts)）：

- `startAnalysis` 这个 async 流程定义在 **zustand store 闭包内**，不依附任何组件。
- 调用 LLM 时**不传 AbortController**，流式 token 经节流回调持续写回 store 的 `analysisState.reasoning/content/status`。
- 弹窗 `isOpen` 是纯本地 state，与 store 任务状态解耦。关闭 = `setIsOpen(false)`，LLM 不受影响。
- Header 据 `isProcessing` 显示运行中、据 `hasAnalysis` 显示"查看分析"按钮，点击重开弹窗后组件重新订阅 store，**直接还原最新 live 视图**。

我们将这套模式迁移到 JD 派生，并按下文决策做并发/取消适配。

## 3. 已确认的设计决策

| 维度 | 决策 |
|---|---|
| 并发模型 | **多任务并发**，按 `parentResumeId` 隔离（`Record<parentResumeId, VariantTask>`） |
| 状态存活 | **内存保活**（不持久化 localStorage），与 ATS 一致；刷新/关浏览器会丢失流过程 |
| 取消能力 | **保留主动取消**：弹窗内 / 派生任务列表可主动 abort 某任务；仅"关闭/离开"不再触发 abort |
| 重入入口 | **派生任务列表 → 点击重开**：复用右上角"派生任务"按钮 + `DerivedJobsDialog`，点击"生成中"项重开 `JdVariantDialog` 还原实时过程 |
| 任务指示 | 右上角**仅用数字角标**（沿用现有 Badge，不加转圈动效） |
| store 归属 | **独立全局 store** `src/store/jd-variant/`（跨页面复用，optimize 入口也可触发派生） |

## 4. 架构设计

### 4.1 新增全局 store：`src/store/jd-variant/`

按本仓库 store 约定（slice + barrel）组织。最小实现可单文件，但遵循领域拆分：

```
src/store/jd-variant/
├── index.ts        # create<JdVariantStore>() + 导出 hook 与选择器
├── types.ts        # VariantTask、JdVariantStore 形状
└── generate.ts     # generate 异步流程（从 use-jd-variant-generator 迁移）
```

**`VariantTask`**（每个 parentResumeId 一份）：

```ts
interface VariantTask {
  parentResumeId: string
  phase: GeneratorPhase            // 复用现有 'idle'|'parsing'|'rewriting'|'success'|'error'|'aborted'
  draftResumeId: string | null
  keywords: string[]
  changes: VariantChange[]
  completedSections: Array<keyof ResumeSchema>
  errorMessage: string | null
  matchRate: number
  parseReasoning: string
  rewriteReasoning: string
  rewriteContent: string
  // 注意：AbortController 不入 state（不可序列化），单独存 module-level Map
}
```

**`JdVariantStore`** 形状：

```ts
interface JdVariantStore {
  tasks: Record<string, VariantTask>            // key = parentResumeId
  startGenerate: (args: GenerateVariantArgs) => Promise<void>
  abortTask: (parentResumeId: string) => void   // 主动取消（不删草稿，置 aborted）
  discardTask: (parentResumeId: string) => Promise<void> // 取消 + 删草稿 + 移除 task
  clearTask: (parentResumeId: string) => void   // 仅从 store 移除（成功打开/新建前清理）
}
```

- `AbortController` 存在 module-level `const controllers = new Map<string, AbortController>()`，不放进 zustand state（避免不可序列化对象入 store）。
- `startGenerate` 把现有 `use-jd-variant-generator.ts` 的 `generate` 逻辑整体搬入，所有 `setState(...)` 改为 `set(s => ({ tasks: { ...s.tasks, [parentResumeId]: { ...next } } }))` 形式的不可变更新。
- **同一 parentId 重复 `startGenerate`**（评审问题 5）：函数开头先 `controllers.get(parentId)?.abort()`，再 `controllers.set(parentId, new AbortController())`，避免同 parent 并发产生孤儿流。等价于现有 `generate` 开头的 `abortRef.current?.abort()`。
- **controllers Map 清理**（评审问题 7）：`startGenerate` 的 `finally`、`abortTask`、`discardTask`、`clearTask` 都需 `controllers.delete(parentId)`（仅当当前 controller 属于该 parentId 时），防止 AbortController 引用泄漏。

### 4.2 改造钩子 `useJdVariantGenerator`

降级为 store 的**选择器薄封装**，对外接口保持与现有 `{ state, generate, abort, reset, discardDraft }` 尽量兼容，减少调用方改动：

```ts
function useJdVariantGenerator(parentResumeId: string) {
  const task = useJdVariantStore(s => s.tasks[parentResumeId])
  const startGenerate = useJdVariantStore(s => s.startGenerate)
  const abortTask = useJdVariantStore(s => s.abortTask)
  const discardTask = useJdVariantStore(s => s.discardTask)
  const clearTask = useJdVariantStore(s => s.clearTask)
  const state = task ?? makeIdleTask(parentResumeId)
  return {
    state,
    generate: (args) => startGenerate(args),
    abort: () => abortTask(parentResumeId),       // 主动取消，置 aborted，保留草稿
    discard: () => discardTask(parentResumeId),   // 取消 + 删草稿 + 移除 task（原 discardDraft）
    reset: () => clearTask(parentResumeId),        // 原 reset：仅从 store 移除，回到 idle 视图
  }
}
```

- **`reset` → `clearTask` 映射**（评审问题 3）：现 `jd-variant-dialog.tsx` 各处 `reset()` 改调 `clearTask(parentResumeId)`；`discardDraft()` 改调 `discardTask(parentResumeId)`。`makeIdleTask` 返回一个 `phase: 'idle'` 的瞬时对象（不写入 store），保证 task 不存在时 `state` 仍有合法 idle 形状供 StepInput 渲染。
- **删除** `useEffect(() => () => abortRef.current?.abort(), [])`（Bug 根因，整行移除）。
- 钩子不再持有任何本地生成状态或 AbortController。

### 4.3 改造 `JdVariantDialog`

- 关闭逻辑 `handleOpenChange`：
  - 生成中（`parsing`/`rewriting`）关闭时，**不再弹"关闭并丢弃"确认**；直接关闭，任务后台继续。
  - 轻量 toast「正在后台继续派生，可在右上角"派生任务"查看」。
- 二次确认 `AlertDialog`：移除"关闭即弹确认 + abort + discardDraft"的绑定。改为弹窗内 StepParsing/StepRewriting 的"取消生成"按钮（`onAbort`）显式调用 `abort()`（= `abortTask`）→ 仅置 `aborted`，**不自动删草稿**；草稿删除走"派生任务列表"或 aborted 视图的"丢弃"。
- **`'aborted'` phase 的展示与清理**（评审问题 2）：新增 aborted 渲染分支——展示"已取消"提示 + 两个按钮：「重新生成」(`generate` 同 args) / 「丢弃草稿」(`discard` → `discardTask`)。这样 aborted task 有明确出口，不会变成空白弹窗或永久残留。
- **`success` 后"打开"草稿**：`onOpenResume` + `clearTask(parentResumeId)` + 关闭。
- **新建 vs 重开续播的消歧**（评审问题 1）：在 `StepInput` 提交开始新生成时，`startGenerate` 内部已覆盖写入新 task，无歧义。真正的歧义在**点卡片"派生"按钮**时：若该 parentId 在 store 残留**非活跃**旧 task（`success`/`error`/`aborted`），应视为"开始新派生"，需先 `clearTask` 再打开弹窗，避免读到旧结果。具体策略：`ResumeCard.handleDeriveClick` → 若 `tasks[parentId]` 存在且 phase ∈ {success, error, aborted} 则先 `clearTask(parentId)`，再 `openDeriveFor(parentId)`。活跃任务（parsing/rewriting）则直接 `openDeriveFor` 续播（此时本就是"查看进度"语义）。
- 弹窗 `open` 仍由父级控制（见 4.5）；组件挂载时根据 `parentResumeId` 从 store 读取 task 还原视图——天然支持"重开续播"。

### 4.4 改造 `DerivedJobsDialog`

"生成中"区数据源**从 store tasks 优先**（实时 phase，含 DB 尚未建草稿的早期 parsing 阶段），辅以 `resumes` 的 `derived_status` 兜底（刷新后内存任务丢失但 DB 仍 generating 的情况）。

- 列表项以 **`parentResumeId`** 为重开入参（评审问题 6）：store task 的 key 本身即 parentId；DB 兜底项用 `item.parent_resume_id`。"查看进度"按钮点击：`openDeriveFor(parentResumeId)` 重开 `JdVariantDialog`，并关闭本弹窗。
- 每个"生成中"项新增**"查看进度"**按钮；保留"丢弃"= `discardTask(parentResumeId)`（store 任务）或现有 DB 删除（兜底项）。
- "失败"区沿用现有重试/丢弃，重试改为基于 store（`clearTask` 后 `openDeriveFor`）。

### 4.5 右上角入口（head-bars）

- 复用现有"派生任务"按钮 + 数字 Badge。
- `pendingCount` 数据源改为：store 中活跃任务（`phase` ∈ parsing/rewriting/error/aborted）数量，叠加 `resumes` 中 `derived_status` 为 generating/failed 的兜底（防刷新后内存任务丢失但 DB 仍标记 generating 的情况）。去重按 `parentResumeId`/`resume_id`。`success` 任务不计入（已完成，待用户打开后 clearTask）。
- 不加转圈动效（按用户决策仅数字角标）。

### 4.6 `resume/index.tsx` 渲染调整

当前 `{derivePendingFor && <JdVariantDialog/>}` 条件渲染导致卸载——**这是触发 abort 清理的关键路径**。改造后由于 store 持有状态、且钩子已移除卸载 abort，即便仍条件渲染，关闭也不会中断后台任务。

- `JdVariantDialog` 的 `open` 由 `Boolean(derivePendingFor)` 控制；关闭 `onOpenChange(false)` → `openDeriveFor(null)`。
- `derivePendingFor` 既用于"新建派生"（点卡片派生按钮），也用于"重开查看"（派生任务列表点查看进度）——两者都只是设置同一个 `parentResumeId`，弹窗据此从 store 还原或新建 task。

## 5. 数据流

```
点击"派生" → openDeriveFor(parentId) → JdVariantDialog 挂载
  → StepInput 提交 → store.startGenerate({parentId, jdText})
      → store 闭包内 async：解析JD → 建草稿(generating) → 改写(LLM流) → ready
      → 流式 token 经回调写入 store.tasks[parentId].(parseReasoning/rewriteReasoning/...)
  → 用户关闭弹窗：openDeriveFor(null)，store 任务继续跑（无 abort）
  → 右上角"派生任务"Badge 计数 +1
  → 点"派生任务" → DerivedJobsDialog 列出生成中任务
  → 点"查看进度" → openDeriveFor(parentId) → JdVariantDialog 重新挂载
      → 从 store.tasks[parentId] 读取当前 phase/reasoning/content → 实时续播
  → 任务完成：phase=success；用户"打开"草稿 → clearTask
  → 主动取消：abortTask(parentId)（置 aborted，草稿保留）；或"丢弃"→ discardTask 删草稿+移除
```

## 6. 错误处理

- LLM/网络错误：catch 内（非 abort 时）`markVariantFailed` + 置 `phase=error`，与现状一致；任务保留在 store 供重试。
- abort：`ctrl.signal.aborted` 时提前 return，不写失败状态、不删草稿（删除交给显式 discard）。
- 刷新/关浏览器：内存任务丢失，但 DB 中草稿仍为 `generating`/`failed`，由 `loadResumes` + `DerivedJobsDialog` 兜底展示（可丢弃/重试），与 ATS"刷新会丢失流过程"的取舍一致。

## 7. 单元/隔离边界

- `src/store/jd-variant/generate.ts`：纯 async 生成流程，输入 `args` + `set/get`，可独立理解；不依赖任何组件。
- `useJdVariantGenerator`：仅做 store 选择器封装，无业务逻辑。
- `JdVariantDialog` / `DerivedJobsDialog` / `head-bars`：纯展示 + 派发，订阅 store。
- module-level `controllers` Map：AbortController 容器，与 store state 分离，保证 state 可序列化/可被 React 安全比较。

## 8. 不做的事（YAGNI）

- 不做 localStorage 持久化（用户已确认内存保活）。
- 不做跨刷新续跑 LLM（技术上 SSE 流无法跨刷新恢复）。
- 不加右上角转圈动效（用户已确认仅数字角标）。
- 不引入任务队列/优先级（多任务直接并发即可）。

## 9. 受影响文件清单

| 文件 | 改动 |
|---|---|
| `src/store/jd-variant/{index,types,generate}.ts` | 新增全局 store |
| `src/components/jd-variant/use-jd-variant-generator.ts` | 降级为 store 选择器封装，删除卸载 abort effect |
| `src/components/jd-variant/jd-variant-dialog.tsx` | 关闭不再 abort/删草稿；新增 aborted 分支；接收 parentResumeId 从 store 还原 |
| `src/components/jd-variant/derived-jobs-dialog.tsx` | "生成中"项加"查看进度"按钮，数据源接 store，以 parentId 重开 |
| `src/components/jd-variant/types.ts` | 视情况新增 `VariantTask` 类型（或放 store/types） |
| `src/pages/resume/components/resume-card/index.tsx` | `handleDeriveClick` 新建前清理非活跃残留 task（消歧） |
| `src/pages/resume/components/head-bars/index.tsx` | pendingCount 接入 store 活跃任务 |
| `src/pages/resume/index.tsx` | 弹窗 open/onOpenChange 适配（关闭不卸载即可保活） |
| `src/pages/optimize/components/advanced-tools/job-description/index.tsx` | optimize 入口同样渲染 `JdVariantDialog`，需同步适配 store 化的 hook 接口与 skipInputStep 自动触发逻辑 |
