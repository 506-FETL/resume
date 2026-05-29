# AI Rewrite 组合式重构设计文档

- 创建日期：2026-05-30
- 状态：设计已在对话中确认，等待计划与实施
- 关联模块：`src/components/ai-rewrite`
- 背景文档：`docs/superpowers/specs/2026-05-28-ai-bullet-rewriter-design.md`

## 1. 背景与目标

当前 `ai-rewrite` 已经具备划词改写、JD 靠拢、候选应用、重试与响应式弹层能力，但组件职责开始混在一起：`ai-rewrite-bubble.tsx` 同时负责 Tiptap BubbleMenu 注册、选区序列化、动作按钮、弹窗标题、候选应用和会话协调；`ai-rewrite-panel.tsx` 同时负责布局、状态分支、JD 输入和候选列表。

本次重构目标是让 AI 改写组件职责更分明，更多使用 React 组合式组件，并参考项目内已有设计，尤其是 `src/pages/optimize/components/advanced-tools/shared/modal.tsx` 的固定 header/footer + 内容区滚动结构，以及 `src/pages/optimize/components/advanced-tools/shared/primitives.tsx` 的清晰标题、图标、卡片和状态表达。

## 2. 范围

### 2.1 包含

- 重构 `src/components/ai-rewrite` 内部组件边界。
- 引入更明确的组合式 UI 单元：BubbleMenu、DialogShell、Panel、Status、CandidateList、Footer。
- 抽离 Tiptap 选区读取与 HTML 序列化逻辑，避免散落在顶层组件。
- 明确 `align_jd` 的待填写 JD 状态，不再用 `success + empty candidates` 隐式表示。
- 优化桌面端和移动端弹层结构，保持 header/footer 固定，内容区独立滚动。
- 补齐 loading/error/waiting/success 的可访问性语义。
- 保持现有外部 API：`<AiRewriteBubble editor={editor} fieldContext={fieldContext} />` 不变。

### 2.2 不包含

- 不改 LLM prompt、模型参数或 `runBulletRewrite()` 调用协议。
- 不改 `SimpleEditor` 对 `AiRewriteBubble` 的挂载方式。
- 不扩展新的改写动作。
- 不做候选 diff、版本历史快照、配额系统或持久化 JD。
- 不引入新的全局状态库；`ai-rewrite` 仍使用局部 hook 状态。

## 3. 推荐方案

采用“组合式重构”方案：保留现有业务能力，把 UI 拆成小而明确的组件，把 editor 相关操作留在顶层编排层，把请求生命周期留在 hook，把布局 shell 与业务状态渲染分开。

没有选择“只做保守拆分”，因为它无法解决 `ai-rewrite-bubble.tsx` 对 UI、editor 和 session 的多重耦合。也不选择“headless provider 全量重写”，因为当前能力边界仍局限在单个 Tiptap 扩展内，引入 provider 会让局部流程过度复杂。

## 4. 目标目录结构

```text
src/components/ai-rewrite/
├── ai-rewrite-bubble.tsx          # 顶层编排：editor、selection、session、dialog、apply
├── ai-rewrite-panel.tsx           # 状态组合容器：JD 输入、状态视图、候选列表
├── candidate-card.tsx             # 单候选展示和 apply 按钮
├── const.ts                       # action 元数据、阈值、常量
├── index.ts                       # barrel 导出
├── jd-context-input.tsx           # JD 输入展示组件
├── rewrite-bubble-menu.tsx        # BubbleMenu 动作按钮组
├── rewrite-candidate-list.tsx     # 候选列表布局
├── rewrite-dialog-shell.tsx       # Dialog/Drawer shell，固定 header/footer
├── rewrite-status-view.tsx        # loading/error/waiting/empty 状态视图
├── types.ts                       # 领域类型与 UI prop 类型
├── use-ai-rewrite.ts              # 请求调度、取消、重试
├── use-rewrite-selection.ts       # Tiptap 选区读取、校验、HTML 序列化
└── use-rewrite-session.ts         # session 状态机
```

`parse-rewrite-response.ts` 保持现状，只在类型需要时做最小调整。

## 5. 职责边界

| 单元 | 职责 | 不做什么 |
|---|---|---|
| `AiRewriteBubble` | 顶层编排；连接 editor、selection、session 和 shell；执行 `insertContentAt` | 不渲染具体候选卡；不直接写状态 UI |
| `useRewriteSelection` | 从 Tiptap 读取选区、校验长度、序列化 HTML | 不操作请求；不渲染 UI |
| `RewriteBubbleMenu` | 渲染 5 个动作按钮，回传 action | 不知道 dialog、candidate、LLM |
| `useAiRewrite` | 管理请求、取消、重试、解析结果、错误落库到 session | 不知道 BubbleMenu 几何；不操作 editor |
| `useRewriteSession` | 管理状态机与 JD 草稿 | 不发请求；不渲染 UI |
| `RewriteDialogShell` | 提供响应式弹层结构、header、content、footer 插槽 | 不知道候选含义；不判断 action 业务 |
| `AiRewritePanel` | 根据 session 组合 JD 输入、状态视图、候选列表 | 不调用 editor；不发请求 |
| `RewriteStatusView` | 展示 loading/error/waiting/empty 状态 | 不知道候选应用逻辑 |
| `RewriteCandidateList` | 决定候选网格和移动端堆叠 | 不知道 session 状态机 |
| `CandidateCard` | 展示单个候选和应用按钮 | 不知道 Tiptap selection |

## 6. 状态设计

现有 `RewriteSessionStatus` 从：

```ts
type RewriteSessionStatus = 'idle' | 'streaming' | 'success' | 'error'
```

调整为：

```ts
type RewriteSessionStatus = 'idle' | 'waiting_jd' | 'streaming' | 'success' | 'error'
```

状态含义：

| 状态 | action | candidates | UI |
|---|---|---|---|
| `idle` | `null` | `[]` | 弹层关闭 |
| `waiting_jd` | `align_jd` | `[]` | 展示 JD 输入与待生成状态 |
| `streaming` | 当前 action | `[]` | 展示 loading 状态，`aria-live="polite"` |
| `success` | 当前 action | `RewriteCandidate[]` | 展示候选列表 |
| `error` | 当前 action | `[]` 或旧候选清空 | 展示错误说明和重试入口 |

`openWaitingJd(action)` 改为 `waitForJd()` 或保留现名但内部设置 `waiting_jd`。`retry(selection)` 在 `align_jd` 且 JD 字数不足时保持禁用。

## 7. 数据流

```text
用户选中文字
  -> BubbleMenuPlugin 判断选区长度
  -> RewriteBubbleMenu 渲染动作按钮
  -> 用户点击 action
  -> AiRewriteBubble 调用 useRewriteSelection(editor).read()
  -> 如果 action=align_jd 且 JD 不足：session.waitingJd(action)
  -> 否则 useAiRewrite.run(action, selection)
  -> runBulletRewrite()
  -> parseRewriteResponse()
  -> session.succeed(candidates) 或 session.fail(message)
  -> RewriteDialogShell 展示 AiRewritePanel
  -> CandidateCard apply 回传 candidate
  -> AiRewriteBubble 执行 editor.chain().focus().insertContentAt(...).run()
  -> reset session 并清空 savedSelection
```

这个流向保证：

- editor 命令只在 `AiRewriteBubble` 内出现。
- UI 展示组件只通过 props 通信。
- LLM 请求与错误恢复只在 hook 内出现。
- JD 草稿仍是局部内存状态，面板关闭即丢弃。

## 8. UI 与交互

### 8.1 Shell

`RewriteDialogShell` 参考 `AdvancedToolsModal`：

- 外层使用现有 `ResponsiveDialog`，保持桌面 Dialog、移动端 Drawer。
- header 固定，包含 icon、标题、说明和关闭能力。
- content 使用 `min-h-0 flex-1 overflow-y-auto`，是唯一滚动区域。
- footer 固定，放置「重新生成」等全局动作。
- 桌面宽度保持当前 3xl 附近，避免候选卡过宽；移动端纵向堆叠。

### 8.2 BubbleMenu

- `RewriteBubbleMenu` 接收 `actions`、`actionMeta`、`onAction`。
- 按钮继续使用 lucide icon + 简短文本。
- 保留 `onMouseDown={e => e.preventDefault()}`，避免 Dialog/Drawer 打开时焦点滞留在被隐藏的 bubble 按钮上。
- 后续要加 Tooltip 时，只需要改 `RewriteBubbleMenu`。

### 8.3 Panel

`AiRewritePanel` 只做组合：

- `align_jd` 时顶部展示 `JdContextInput`。
- `waiting_jd`、`streaming`、`error`、空候选分别交给 `RewriteStatusView`。
- `success` 且有候选时交给 `RewriteCandidateList`。
- footer 的重试按钮由 shell 或 panel footer 插槽渲染，但按钮禁用逻辑由 `AiRewriteBubble` 或一个小的派生 helper 提供。

### 8.4 Candidate

- `RewriteCandidateList` 使用响应式 grid：桌面 `repeat(auto-fill,minmax(280px,1fr))`，移动端单列。
- `CandidateCard` 维持 card header/content/footer，但只关心 `candidate` 和 `onApply`。
- HTML 仍使用 `dangerouslySetInnerHTML`，因为当前候选 HTML 后续会经 Tiptap schema 写入过滤；本次不改变安全模型。

### 8.5 可访问性

- loading/waiting/error 状态区域添加 `role="status"` 或 `aria-live="polite"`。
- error 使用 `Alert`，保留 `AlertTitle`/`AlertDescription`。
- footer 按钮在不可重试时提供明确 disabled 状态。
- Dialog title/description 继续通过 `ResponsiveDialogTitle`/`ResponsiveDialogDescription` 提供。
- 不新增隐藏快捷键，也不在 UI 内写使用说明。

## 9. 错误与边界条件

| 场景 | 处理 |
|---|---|
| 选区为空或过短 | BubbleMenu 不显示；点击时二次读取失败则不打开弹层 |
| `align_jd` JD 不足 | 进入 `waiting_jd`，不发起请求 |
| 请求中关闭弹层 | 调用 `cancel()` 后 `reset()` |
| 请求被 abort | 不写入 error |
| LLM 返回空候选 | 维持现有解析策略，进入 error 或显示 empty 状态，具体以现有 parser 输出为准 |
| 用户应用候选后 | 写回 editor，toast 成功，reset |
| savedSelection 丢失 | apply/retry 直接返回，不写 editor |

## 10. 测试与验证

### 10.1 单元/静态验证

- 为 `use-rewrite-session` 或其 reducer 状态转移补充测试，重点覆盖 `waiting_jd`、`streaming`、`success`、`error`、`reset`。
- 如果当前项目测试框架不足以直接覆盖 hook，至少把状态转移逻辑抽成纯函数再测。
- `parse-rewrite-response.ts` 不重写，避免扩大验证面。
- 完成实现后必须运行：

```bash
npx tsc --noEmit
```

必要时追加：

```bash
npm run lint -- src/components/ai-rewrite
```

### 10.2 手动验证

- 桌面端：在简历编辑富文本字段选中文字，BubbleMenu 出现，五个 action 可点击。
- 非 `align_jd`：点击后出现弹层，loading、success、apply、retry、close 都按预期工作。
- `align_jd`：JD 不足先进入 waiting，输入达到阈值后可重新生成。
- 移动端：Drawer 内 header/footer 固定，候选卡纵向堆叠，内容滚动不影响 footer。
- 关闭弹层时请求取消，重新打开不会保留旧候选或旧 selection。

## 11. 迁移策略

1. 先补状态转移测试或纯函数测试，锁定 `waiting_jd` 行为。
2. 抽 `use-rewrite-selection.ts`，保持 `AiRewriteBubble` 外部行为不变。
3. 抽 `RewriteBubbleMenu`，只替换动作按钮区域。
4. 抽 `RewriteDialogShell`，保持现有 Dialog/Drawer 能力但统一 shell。
5. 抽 `RewriteStatusView` 与 `RewriteCandidateList`，让 `AiRewritePanel` 成为组合容器。
6. 更新 `useRewriteSession` 状态类型和 `useAiRewrite` 的等待 JD 流程。
7. 运行类型检查和必要 lint，再做桌面/移动手动验证。

## 12. 成功标准

- `ai-rewrite-bubble.tsx` 不再直接渲染候选内容和状态块，只保留顶层编排。
- `ai-rewrite-panel.tsx` 不再包含复杂布局和所有状态 UI 的内联实现。
- `align_jd` 待填写 JD 是显式状态，不依赖 `success + []`。
- 组件间通过清晰 props 通信，没有新增全局 store。
- `npx tsc --noEmit` 通过，且手动验证覆盖桌面和移动端主要流程。
