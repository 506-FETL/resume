# AI 助手 S7 画布与推理体验优化 设计规格

> 状态：已批准设计，待编写实现计划
> 日期：2026-08-06
> 关联：S6 实时画布（`docs/superpowers/specs/2026-08-06-ai-assistant-s6-live-canvas-design.md`）

## 0. 硬约束（沿用仓库规则）

- 能用现成组件就不自造。本轮**必须复用**：`@/components/ai/shimmer`（Shimmer）、`@/components/ai/reasoning`（Reasoning/ReasoningTrigger/ReasoningContent，内含 Shimmer「Thinking…」）、`@/components/ai/chain-of-thought`（可选，用于思考链步骤展示）、`Collapsible`/`Badge`/`ScrollArea`/`Button`/`Tooltip`、`motion/react` + `useReducedMotion`。
- `className` 只用于布局，不覆盖组件配色。
- 不写测试文件；用 `pnpm exec eslint`、`pnpm exec tsc --noEmit`、`pnpm build`、`git diff --check` + 人工验收替代。
- 当前分支内联工作；最终验证通过前不 `git commit`、不 `git push`。
- 不改无关页面。

## 1. 背景与问题

用户反馈四类问题（附截图）：

1. **画布 UX**：画布太窄且宽度固定；顶部有两个重复的折叠/画布图标；展开无动画；不应允许手选简历（应只读展示当前对话正在编辑的简历）；应支持鼠标拖拽改宽。
2. **变更呈现**：当前「变更记录」只显示一行摘要 JSON（`{"ok":true,"resumeId":"..."}`），应改为 Codex 式红绿逐行 diff；对话内工具调用当前是「Used 1 tool」折叠块，应改为 Codex 式活动列表（`思考 Ns / 读取 X / 修改 简历·工作经历 +3 -1`）。
3. **深度思考**：当前思考过程完全不展示，流式时只有一个点阵 `WaveSpinner` 图标；需改用 shadcn shimmer 文案 + 展示 GPT 式思考链；并在 composer 增加「深度思考」开关，用户可手动开启。
4. **Codex 差距**：希望对比 Codex 分析我们还缺哪些功能。

### 1.1 根因勘查结论（真相源：代码）

- **深度思考一直是关的（真 bug）**：`src/lib/ai/agent/agent-loop.ts:25` 的 `thinking` 默认 `false`；唯一调用点 `src/pages/assistant/hooks/use-chat-stream.ts:112` 从未传 `thinking` → API 恒为 `{ type: 'disabled' }`。所以模型根本不产出 `reasoning_content`。
- **推理气泡从不进入 streaming 态**：`src/pages/assistant/components/message-bubble/index.tsx:41` 渲染 `<ReasoningPart text=...>` 未传 `streaming` prop（默认 `false`），导致 `reasoning.tsx` 里现成的 `Shimmer`「Thinking…」触发器永不激活；`ReasoningPart` 还写死 `defaultOpen={false}`。
- **流式初始态是 `WaveSpinner`**：`message-list/index.tsx:151-160`，当 `streaming===true && streamingParts.length===0` 渲染 `Sparkles` 头像 + `<WaveSpinner />`（点阵动画，即截图里的图标）。
- **对话内工具块**：`ToolCallPartGroup`（`tool-call-part.tsx`）→ `ToolCallsSection`（`@/components/ui/tool-calls-section`），折叠头「Used N tools」，展开后按 `CompactMarkdown` 渲染 `output = JSON.stringify(result)`，**不是 diff**。
- **画布**：`assistant-canvas/index.tsx:62-67` 桌面 `motion.aside` 宽度写死 `animate={{ width: 420 }}` 且 `initial={false}`（无进出动画）；`resume-preview` 顶部有 `Select` 简历选择器。仓库**无** `resizable` 组件（grep 确认），拖拽改宽需自建 pointer 手柄。
- **变更 diff 缺 before**：持久化的 `tool-call` part 只有 `args`/`result`，写操作 result 形如 `{ ok, resumeId }`，**不含 before/after**，因此 `deriveCanvasModel` 只能出 `summary` 而非 `diff`。
- 现有确认卡 diff：`confirm-card/resume-field-diff.tsx` 是「原内容 | 箭头 | 新内容」双栏纯文本，非红绿逐行。

## 2. 目标（本轮范围）

实现 Part 1/2/3；Part 4 仅产出分析章节（见 §7），不实现具体缺口功能。

## 3. Part 1 · 画布 UX

### 3.1 可拖拽改宽

- store 新增 `canvasWidth: number`（初值从 localStorage 读，默认 **480**）与 `setCanvasWidth(px)`（clamp 后写 store + localStorage）。
- 常量：`ASSISTANT_CANVAS_WIDTH_STORAGE_KEY = 'gresume:assistant:canvas-width'`、`CANVAS_MIN_WIDTH = 380`、`CANVAS_DEFAULT_WIDTH = 480`、`CANVAS_MAX_WIDTH = 760`（运行时再与 `60vw` 取 min）。
- 桌面 `motion.aside` 左边框渲染一个拖拽手柄 `<div role="separator" aria-orientation="vertical">`：`onPointerDown` 捕获指针，`onPointerMove` 按 `startWidth + (startX - clientX)` 更新宽度（右栏向左拖变宽），`onPointerUp` 释放并持久化。手柄 hover/active 有可见高亮（用 `bg-border`/`bg-primary`，仅布局类）。
- 拖拽期间关闭宽度过渡动画（避免抖动）；非拖拽期用过渡。
- 移动端仍走 `Sheet`，不受宽度影响。

### 3.2 移除简历选择器 → 只读展示

- `resume-preview/index.tsx` 删除 `Select`；`use-canvas-preview` 不再暴露 `options/setPreviewResumeId` 供选择。
- 顶部改为只读标题条：展示当前预览简历名（从 `getAllResumesFromUser` 结果里按 `previewResumeId` 找 `display_name`，或从快照里取姓名兜底），无名时展示占位文案。
- `previewResumeId` 仍由 `useCurrentResumeStore.resumeId` 联动种子（保持 S6 行为），只是不再手选。

### 3.3 去重顶部图标

- 规则：**画布展开时**，只有画布头部保留一个折叠按钮（`PanelRightClose`）。
- **chat-header 的画布按钮**：桌面端仅当 `!canvasOpen` 时显示（用于重新打开）；`canvasOpen` 时隐藏。移动端始终显示（唤起 Sheet）。
- 结果：画布展开时不再出现两个重复图标。

### 3.4 展开/收起动画

- 用 `AnimatePresence`（`initial` 允许）包裹桌面 `motion.aside`：进入 `width: 0→canvasWidth, opacity: 0→1`，退出反向。`useReducedMotion` 时 `duration: 0`。

## 4. Part 2 · 对话内活动列表 + 画布红绿 diff

### 4.1 统一 diff 基建（复用到多处）

- 新建 `src/pages/assistant/components/diff/compute-line-diff.ts`：`computeLineDiff(before: unknown, after: unknown): DiffLine[]`。
  - 先把任意值规范为文本行：字符串按 `\n` 拆；对象 `JSON.stringify(v, null, 2)` 后拆行；`null/undefined` → `（空）`。
  - 用简单 LCS 求最长公共子序列 → 输出 `{ type: 'context'|'add'|'remove', text }[]`。
  - 导出 `diffStat(lines): { additions, deletions }`。
- 新建 `src/pages/assistant/components/diff/diff-view.tsx`：`<DiffView before after />`，渲染红绿逐行（`add` 绿底、`remove` 红底、`context` 常规），行首 `+`/`-`/空格，`ScrollArea` 限高，等宽字体（`font-mono` 布局类）。
- 新建 `<DiffStat additions deletions />`：`+N`（绿）`-N`（红）小徽标，供活动行与卡片头复用。
- **`confirm-card/resume-field-diff.tsx` 升级**：内部改用 `DiffView`（替换现有双栏纯文本），保持导出签名 `{ before, after }` 不变。

### 4.2 写工具 result 带 before/after（数据修正）

- 让写操作的 `apply` 返回结果携带 `before`/`after`，使持久化 tool-call part 可还原 diff：
  - `update_current_resume_field`（`src/lib/ai/tools/resume.ts`）：`apply` 返回 `{ ok, sectionKey, before, after }`（`before` 为落库前值，已在 execute 顶部取到）。
  - 其余写工具（`crud.ts` 的 `create_resume`/`update_resume_meta`/`delete_resume`/版本类/`update_job`/`create_job`/`delete_job`）：尽力返回可摘要或可 diff 的字段；无 before 语义的（如 create/delete）走 `summary`（标题 + `+N`/`-N` 由内容行数估算或省略）。
- `deriveCanvasModel`（`utils.ts`）升级 `summarizeChange`：当 result 含 `before`/`after` → 产出 `{ kind: 'diff', before, after }`；否则 `summary`。同时计算每条 change 的 `stat?: { additions, deletions }`（对 diff 类用 `diffStat`；create/delete 用内容行数）。`CanvasChange` 类型加可选 `stat`。

### 4.3 对话内活动列表（替换 Used N tools）

- `ToolCallPartGroup` 改为渲染 **活动列表**（对齐 Codex / 截图 Image #4）：
  - 每个 tool-call 一行：`图标（按 TOOL_CANVAS_META.iconCategory）+ 动作标签（label/title）+ DiffStat（若有 stat）`。
  - `state==='call'|'awaiting-confirm'`（进行中）：图标处显示 Shimmer 文案或 loading（见 §5 收敛，加载时只显示 loading，不与其它图标重叠）。
  - `cancelled`/`error` 有轻量标记。
  - 组底部保留「在画布中查看」按钮（当组内有 `targetTab`），点击联动画布 tab（沿用 S6）。
- 是否保留可折叠：默认全部平铺展示（Codex 风），不再用「Used N tools」聚合折叠头。读取类不显示行数徽标。

### 4.4 画布「变更记录」红绿 diff

- `change-log/index.tsx`：每条写操作卡片头显示 `标题 + DiffStat + 状态徽标`；展开 `CollapsibleContent`：
  - `detail.kind==='diff'` → `<DiffView before after />`（红绿逐行）。
  - `detail.kind==='summary'` → 文本。
- 移除当前直接展示 `JSON.stringify(result)` 的行为。

## 5. Part 3 · 深度思考 + 思考链

### 5.1 接通深度思考开关

- store 新增 `deepThinking: boolean`（`readStoredBoolean(ASSISTANT_DEEP_THINKING_STORAGE_KEY, false)`，默认 **关**）+ `setDeepThinking(v)`（写 store + localStorage）。
- 常量 `ASSISTANT_DEEP_THINKING_STORAGE_KEY = 'gresume:assistant:deep-thinking'`。
- `use-chat-stream.ts` 调 `runAgent({ ..., thinking: useAssistantStore.getState().deepThinking })`。

### 5.2 composer 深度思考开关按钮

- GAIA `Composer`（`src/components/ui/composer.tsx`）最小侵入加一个可选插槽 `leadingActions?: ReactNode`，渲染在工具栏左侧（`+` 按钮之后、发送按钮之前的左簇）。不改其它默认行为。
- 助手 `composer/index.tsx` 传入一个「深度思考」toggle 按钮：`Brain` 图标 + 文案「深度思考」，激活态高亮（用现成 `Button` variant + `data-active`/条件类，仅布局/状态类）；点击 `setDeepThinking(!deepThinking)`；`Tooltip` 说明。

### 5.3 思考链展示 + Shimmer

- `message-bubble/index.tsx`：给 `<ReasoningPart>` 传 `streaming`——仅当该 part 属于**当前流式消息**（`message.id === 'streaming'`）且是最后一个 reasoning 且尚无后续 text 时为 `true`。实现上：`renderAssistantParts(parts, { streamingMessage })`，据此判断。
- `ReasoningPart`：改 `defaultOpen`——流式时默认展开（`defaultOpen={streaming}`），结束后 `Reasoning` 组件自身的 auto-close 逻辑收起。透传 `isStreaming` → 触发 `Shimmer`「思考中…」（可将默认英文 `Thinking...` 文案本地化为中文，通过 `ReasoningTrigger` 的 `getThinkingMessage` 定制）。
- **流式初始态**：`message-list/index.tsx` 的空态分支（`streamingParts.length===0`）把 `WaveSpinner` 换成 Shimmer 文案（如 `<Shimmer>正在思考…</Shimmer>`），与 Sparkles 头像并存；避免点阵图标。
- 思考链内容即 `Reasoning` 的 `Streamdown` 渲染的推理 markdown，可展开/收起（对齐 Image #7）。**本轮定案：只用 `Reasoning`（单块思考文本 + Shimmer + 展开/收起），不引入 `chain-of-thought.tsx` 的步骤式展示**（步骤式需要结构化 reasoning 事件，超出本轮范围，列入 §7 后续）。

## 6. Store / 类型 / 常量 汇总

- `const.ts`：`ASSISTANT_CANVAS_WIDTH_STORAGE_KEY`、`CANVAS_MIN_WIDTH`、`CANVAS_DEFAULT_WIDTH`、`CANVAS_MAX_WIDTH`、`ASSISTANT_DEEP_THINKING_STORAGE_KEY`。
- `store.ts`：新增 `canvasWidth`、`deepThinking` 及 setter；`reset` 不重置这两项持久化偏好。
- `types.ts`：`CanvasChange` 增 `stat?: { additions: number, deletions: number }`；`CanvasChangeDetail` 的 `diff` 分支已存在。

## 7. Part 4 · Codex 差距分析（仅记录，不实现）

对比 Codex/ChatGPT，当前助手候选缺口（按“成本/收益”粗排，供后续单独立项）：

1. **停止生成 / 重新生成上一条**：Composer 在 `streaming` 时应变「停止」按钮（已有 `stopStreaming`，仅缺 UI）；助手消息 actions 已有 retry，可补「重新生成」。（低成本高收益）
2. **消息编辑后重跑**：编辑历史用户消息并从该点重新生成。
3. **工具失败重试 / 单步重试**：失败的 tool-call 提供「重试」。
4. **@ 引用**：`@简历` / `@职位` 快速把上下文对象带入 prompt。
5. **附件多图**：Composer 已具备 `attachedFiles` 能力，未接入多模态图片输入链路。
6. **快捷指令模板 / Slash 命令**：GAIA Composer 支持 `tools`/slash，可注入「优化这段经历 / 生成 STAR / 匹配 JD」等模板。
7. **成本 / token 显示**：流式 usage 已在 chunk 里（`usage`），可展示。
8. **diff 一键回滚 / 采纳**：变更记录里对写操作提供「撤销」。
9. **画布多对象 tab 记忆 / 固定**：多简历/看板对象并存与持久化选中。
10. **引用来源 / 联网结果卡**：Link Preview 已在其它 spec，可整合。

## 8. 分期（内联执行，全绿前不 commit）

- **T1**：深度思考接通（store+const+use-chat-stream 传 thinking）+ composer `leadingActions` 插槽与开关按钮 + 推理流式/Shimmer 修复（message-bubble 传 streaming、ReasoningPart defaultOpen、message-list 空态换 Shimmer）。
- **T2**：统一 diff 基建（`compute-line-diff.ts` + `diff-view.tsx` + `DiffStat`）；升级 `resume-field-diff` 用 `DiffView`。
- **T3**：写工具 result 带 before/after（`resume.ts` + `crud.ts`）；`deriveCanvasModel` 产出 diff + stat；画布「变更记录」红绿 diff。
- **T4**：对话内活动列表替换 `ToolCallsSection`（含 DiffStat、进行中态收敛、保留“在画布中查看”）。
- **T5**：画布可拖拽改宽（store `canvasWidth` + 手柄）+ 去简历选择器（只读标题）+ 去重头部图标（chat-header 条件显示）+ 进出动画（AnimatePresence）。
- **T6**：全量验证（eslint/tsc/build/diff-check）+ 人工验收清单 + Codex 差距分析落档。

## 9. 验收清单（人工，pnpm dev）

- 画布：可拖拽改宽并刷新后保持；宽度受 min/max clamp；展开/收起有动画；顶部只有一个折叠按钮；chat-header 画布按钮仅在折叠时出现（桌面）；简历为只读展示当前对话简历名，无选择器。
- 变更：AI 改简历字段并确认后，画布变更记录展开为红绿逐行 diff；确认卡也是红绿 diff；对话内该操作显示 `修改 <模块> +N -N`。
- 深度思考：composer 有「深度思考」开关，可开合并记忆；开启后再问，助手气泡出现可展开思考链，流式时显示 Shimmer「思考中…」而非点阵图标；关闭后不产出思考。
- 活动列表：对话内工具调用为逐行活动（图标+标签+增删计数），进行中只显示 loading 不与其它图标重叠；读取类无行数徽标；「在画布中查看」正常联动。
- 回归：窄屏画布为全屏 Sheet 且无 ARIA 告警；切换/新建会话画布随消息重建；读操作不弹确认、写操作走确认卡、取消标注「已取消」。

## 10. 规格覆盖自检

| 需求 | 章节 | 任务 |
| --- | --- | --- |
| 画布可拖拽改宽（非固定） | §3.1 | T5 |
| 只读展示当前对话简历（去选择器） | §3.2 | T5 |
| 去重顶部图标 | §3.3 | T5 |
| 展开/收起动画 | §3.4 | T5 |
| 变更记录红绿 diff | §4.4 | T3 |
| 确认卡升级红绿 diff | §4.1 | T2 |
| 对话内活动列表（替换 Used N tools） | §4.3 | T4 |
| 写工具带 before/after 以支撑 diff | §4.2 | T3 |
| 深度思考接通（修复 bug） | §5.1 | T1 |
| composer 深度思考开关 | §5.2 | T1 |
| 思考链 + Shimmer（替换点阵图标） | §5.3 | T1 |
| Codex 差距分析 | §7 | T6 |
| 复用现成组件、不覆盖配色、不写测试、不提交 | §0 | 全程 |
