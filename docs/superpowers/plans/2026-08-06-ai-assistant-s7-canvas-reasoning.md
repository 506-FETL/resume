# AI 助手 S7 画布与推理体验优化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复深度思考恒关的 bug 并加 composer 开关与 Shimmer 思考链；把对话内工具块改为 Codex 式活动列表；用统一红绿 `DiffView` 呈现变更记录与确认卡；画布支持拖拽改宽、去简历选择器、去重头部图标与进出动画。

**架构：** store 新增 `deepThinking`/`canvasWidth` 两个持久化 UI 态；`use-chat-stream` 把 `deepThinking` 传入既有 `runAgent({ thinking })`；新建 `compute-line-diff.ts`（LCS 行差分）+ `diff-view.tsx`/`DiffStat` 统一 diff 呈现，复用到画布变更记录与确认卡；写工具 `apply` 结果补 `before/after` 让持久化的 tool-call part 可还原 diff；`deriveCanvasModel` 据此产出 `diff`+`stat`；`ToolCallPartGroup` 改渲染逐行活动列表；画布壳加 pointer 拖拽手柄 + `AnimatePresence`。

**技术栈：** React + TypeScript、Zustand、motion/react、既有 `@/components/ai/{shimmer,reasoning}`、`getToolCategoryIcon`、shadcn `Collapsible/Badge/ScrollArea/Button/Tooltip`。

**规格：** `docs/superpowers/specs/2026-08-06-ai-assistant-s7-canvas-reasoning-design.md`

**仓库覆盖规则（重要）：**
- 本仓库不写测试文件；用 `pnpm exec eslint <file>`、`pnpm exec tsc --noEmit`、`pnpm build`、`git diff --check` + 人工验收替代 TDD。
- 当前分支内联工作，不新建分支；最终验证通过前不 `git commit`、不 `git push`。
- 每个任务末尾用"验证步骤"替代"commit 步骤"。
- 能用现成组件就不自造；`className` 只用于布局，不覆盖组件配色/排版。
- 仓库使用 `perfectionist/sort-imports`（type import 在前、字母序）与 antfu 风格：出现 import 顺序/`jsx-one-expression-per-line`/`max-statements-per-line` 报错时用 `pnpm exec eslint --fix` 修，无法自动修的手改。

---

## 文件结构与职责

**修改：**
- `src/pages/assistant/const.ts` — 新增深度思考 / 画布宽度常量。
- `src/pages/assistant/store.ts` — 新增 `deepThinking`/`canvasWidth` 状态与 setter。
- `src/pages/assistant/types.ts` — `CanvasChange` 增 `stat?`。
- `src/pages/assistant/hooks/use-chat-stream.ts` — `runAgent` 传 `thinking: deepThinking`。
- `src/components/ui/composer.tsx` — 加可选 `leadingActions?: ReactNode` 插槽。
- `src/pages/assistant/components/composer/index.tsx` — 传入「深度思考」开关按钮。
- `src/pages/assistant/components/message-bubble/index.tsx` — `renderAssistantParts` 支持 streaming 判定；传 `streaming` 给 `ReasoningPart`。
- `src/pages/assistant/components/message-bubble/reasoning-part.tsx` — 流式默认展开 + 中文 thinking 文案。
- `src/pages/assistant/components/message-list/index.tsx` — 流式初始态用 Shimmer 替换 WaveSpinner。
- `src/pages/assistant/components/confirm-card/resume-field-diff.tsx` — 内部改用 `DiffView`。
- `src/pages/assistant/utils.ts` — `summarizeChange` 产出 diff+stat；`deriveCanvasModel` 填 `stat`。
- `src/pages/assistant/components/message-bubble/tool-call-part.tsx` — 改渲染活动列表。
- `src/pages/assistant/components/assistant-canvas/change-log/index.tsx` — 卡片头 stat + 展开 `DiffView`。
- `src/pages/assistant/components/assistant-canvas/resume-preview/index.tsx` — 去 Select 改只读标题。
- `src/pages/assistant/hooks/use-canvas-preview.ts` — 暴露当前简历名，去手选。
- `src/pages/assistant/components/assistant-canvas/index.tsx` — 拖拽手柄 + 宽度 + AnimatePresence。
- `src/pages/assistant/components/chat-header/index.tsx` — 画布按钮桌面端仅折叠时显示。
- `src/lib/ai/tools/resume.ts` — `update_current_resume_field.apply` 结果带 `before/after`。
- `src/lib/ai/tools/crud.ts` — 相关写工具结果尽力带 `before/after`。

**创建：**
- `src/pages/assistant/components/diff/compute-line-diff.ts` — LCS 行差分 + `diffStat`。
- `src/pages/assistant/components/diff/diff-view.tsx` — 红绿逐行 `DiffView` + `DiffStat`。

---

## 任务 1：深度思考接通 + composer 开关 + 思考链 Shimmer

**文件：**
- 修改：`src/pages/assistant/const.ts`
- 修改：`src/pages/assistant/store.ts`
- 修改：`src/pages/assistant/hooks/use-chat-stream.ts`
- 修改：`src/components/ui/composer.tsx`
- 修改：`src/pages/assistant/components/composer/index.tsx`
- 修改：`src/pages/assistant/components/message-bubble/index.tsx`
- 修改：`src/pages/assistant/components/message-bubble/reasoning-part.tsx`
- 修改：`src/pages/assistant/components/message-list/index.tsx`

- [ ] **步骤 1：常量**

在 `src/pages/assistant/const.ts` 末尾追加：
```ts
export const ASSISTANT_DEEP_THINKING_STORAGE_KEY = 'gresume:assistant:deep-thinking'
```

- [ ] **步骤 2：store 增 deepThinking**

`src/pages/assistant/store.ts`：
1. 顶部 import 常量合并追加 `ASSISTANT_DEEP_THINKING_STORAGE_KEY`：
```ts
import { ASSISTANT_CANVAS_STORAGE_KEY, ASSISTANT_DEEP_THINKING_STORAGE_KEY, ASSISTANT_SIDEBAR_STORAGE_KEY } from './const'
```
2. `interface AssistantStore` 在 `searchOpen: boolean` 附近加：
```ts
  deepThinking: boolean
```
3. setter 声明（在 `setSearchOpen` 附近）：
```ts
  setDeepThinking: (v: boolean) => void
```
4. 初始值（在 `searchOpen: false,` 附近）：
```ts
  deepThinking: readStoredBoolean(ASSISTANT_DEEP_THINKING_STORAGE_KEY, false),
```
5. setter 实现（在 `setSearchOpen` 实现附近）：
```ts
  setDeepThinking: (v) => {
    writeStoredBoolean(ASSISTANT_DEEP_THINKING_STORAGE_KEY, v)
    set({ deepThinking: v })
  },
```
（`reset` 不动——深度思考是持久化偏好。）

- [ ] **步骤 3：把 deepThinking 传给 runAgent**

`src/pages/assistant/hooks/use-chat-stream.ts` 第 112 行 `runAgent({...})` 调用，增加 `thinking`：
```ts
      const finalParts = await runAgent({
        history: useAssistantStore.getState().messages,
        signal: controller.signal,
        thinking: useAssistantStore.getState().deepThinking,
        context,
        callbacks: {
```
（其余回调不变。）

- [ ] **步骤 4：composer 加 leadingActions 插槽**

`src/components/ui/composer.tsx`：
1. `ComposerProps` 接口内追加（放在 `isLoading?` 附近）：
```ts
	/** Extra action nodes rendered at the left of the toolbar (before send) */
	leadingActions?: ReactNode;
```
2. 解构 props（函数签名内 `isLoading = false,` 后）追加：
```ts
	leadingActions,
```
3. 工具栏左簇：在 Tools 按钮块之后、左簇 `</div>` 之前插入渲染。定位到：
```tsx
					{/* Tools Button */}
					{showToolsButton && (
```
其所在的外层 `<div className="flex items-center gap-1">` 闭合处（Tools 按钮 `)}` 之后）追加：
```tsx
						{leadingActions}
```
即结构变为 `<div flex gap-1> …context按钮… {showToolsButton && Tools按钮} {leadingActions} </div>`。

- [ ] **步骤 5：助手 composer 传入深度思考开关**

重写 `src/pages/assistant/components/composer/index.tsx`：
```tsx
import { Brain } from 'lucide-react'
import { Composer as GaiaComposer } from '@/components/ui/composer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'

export default function Composer() {
  const { streaming, composerDraft: draft, initializing, loadingMessages, deepThinking, setDeepThinking } = useAssistantStore()
  const { sendMessage } = useChatStream()
  const disabled = streaming || initializing || loadingMessages

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8">
      <GaiaComposer
        value={draft}
        placeholder={COMPOSER_PLACEHOLDER}
        disabled={disabled}
        showToolsButton={false}
        leadingActions={(
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="深度思考"
                aria-pressed={deepThinking}
                onClick={() => setDeepThinking(!deepThinking)}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors',
                  deepThinking
                    ? 'bg-primary/15 text-primary'
                    : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400',
                )}
              >
                <Brain className="size-4" />
                深度思考
              </button>
            </TooltipTrigger>
            <TooltipContent>{deepThinking ? '已开启深度思考' : '开启深度思考（更慢更细）'}</TooltipContent>
          </Tooltip>
        )}
        onChange={value => useAssistantStore.getState().setComposerDraft(value)}
        onSubmit={(message) => {
          const text = message.trim()
          if (text && !disabled) {
            useAssistantStore.getState().setComposerDraft('')
            sendMessage(text)
          }
        }}
      />
    </div>
  )
}
```

- [ ] **步骤 6：message-bubble 传 streaming 给 ReasoningPart**

`src/pages/assistant/components/message-bubble/index.tsx`：
1. `renderAssistantParts` 增加第二参数 `isStreamingMessage`，并对「最后一个 part 且为 reasoning」时判定流式：
```tsx
function renderAssistantParts(parts: AiMessagePart[], isStreamingMessage: boolean) {
  const nodes: ReactNode[] = []
  let buffer: ToolCallPart[] = []
  const keyOccurrences = new Map<string, number>()
  const createPartKey = (prefix: string, content: string) => {
    const baseKey = `${prefix}-${content}`
    const occurrence = keyOccurrences.get(baseKey) ?? 0
    keyOccurrences.set(baseKey, occurrence + 1)
    return `${baseKey}-${occurrence}`
  }
  const flush = (key: string) => {
    if (buffer.length) {
      nodes.push(<ToolCallPartGroup key={key} calls={buffer} />)
      buffer = []
    }
  }
  const lastIndex = parts.length - 1
  parts.forEach((p, index) => {
    if (p.type === 'tool-call') {
      buffer.push(p)
      return
    }
    flush(createPartKey('tool-group', buffer.map(call => call.toolCallId).join('-')))
    if (p.type === 'reasoning') {
      const streaming = isStreamingMessage && index === lastIndex
      nodes.push(<ReasoningPart key={createPartKey('reasoning', p.text)} text={p.text} streaming={streaming} />)
    }
    else if (p.type === 'text') {
      nodes.push(<TextPart key={createPartKey('text', p.text)} text={p.text} />)
    }
  })
  flush('tc-end')
  return nodes
}
```
2. 组件体内调用处（助手分支）改为：
```tsx
          {renderAssistantParts(message.parts, message.id === 'streaming')}
```

- [ ] **步骤 7：reasoning-part 流式默认展开 + 中文文案**

重写 `src/pages/assistant/components/message-bubble/reasoning-part.tsx`：
```tsx
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai/reasoning'
import { Shimmer } from '@/components/ai/shimmer'

interface ReasoningPartProps {
  text: string
  streaming?: boolean
}

function getThinkingMessage(isStreaming: boolean, duration?: number) {
  if (isStreaming || duration === 0)
    return <Shimmer duration={1}>正在思考…</Shimmer>
  if (duration === undefined)
    return <span>已完成思考</span>
  return (
    <span>
      思考了
      {duration}
      {' '}
      秒
    </span>
  )
}

export function ReasoningPart({ text, streaming = false }: ReasoningPartProps) {
  return (
    <Reasoning isStreaming={streaming} defaultOpen={streaming} className="mb-1">
      <ReasoningTrigger getThinkingMessage={getThinkingMessage} />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  )
}
```

- [ ] **步骤 8：流式初始态用 Shimmer 替换 WaveSpinner**

`src/pages/assistant/components/message-list/index.tsx`：
1. 顶部把 `WaveSpinner` 的 import 换成 Shimmer：
```ts
import { Shimmer } from '@/components/ai/shimmer'
```
（删除 `import { WaveSpinner } from '@/components/ui/wave-spinner'`。）
2. 流式空态分支（约 151-160 行）把 `<WaveSpinner />` 替换为：
```tsx
                  <div className="min-w-0 flex-1 pt-1 text-sm">
                    <Shimmer duration={1.4}>正在思考…</Shimmer>
                  </div>
```
（保留外层 `flex gap-3` 与 `Sparkles` 头像结构，仅替换 body。）

- [ ] **步骤 9：验证**

```bash
pnpm exec eslint src/pages/assistant/const.ts src/pages/assistant/store.ts src/pages/assistant/hooks/use-chat-stream.ts src/components/ui/composer.tsx src/pages/assistant/components/composer/index.tsx src/pages/assistant/components/message-bubble/index.tsx src/pages/assistant/components/message-bubble/reasoning-part.tsx src/pages/assistant/components/message-list/index.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。`pnpm dev` 下 composer 出现「深度思考」开关，开启后提问助手气泡出现可展开思考链、流式显示 Shimmer「正在思考…」；关闭则无思考输出。

> 注意：`src/components/ui/composer.tsx` 是 GAIA 组件，eslint 可能命中忽略规则（`File ignored`），属正常；用 `--no-warn-ignored` 或忽略该 warning。tsc 仍会检查它。

---

## 任务 2：统一红绿 DiffView + computeLineDiff + 确认卡升级

**文件：**
- 创建：`src/pages/assistant/components/diff/compute-line-diff.ts`
- 创建：`src/pages/assistant/components/diff/diff-view.tsx`
- 修改：`src/pages/assistant/components/confirm-card/resume-field-diff.tsx`

- [ ] **步骤 1：行差分算法**

创建 `src/pages/assistant/components/diff/compute-line-diff.ts`：
```ts
export interface DiffLine {
  type: 'context' | 'add' | 'remove'
  text: string
}

export interface DiffStatValue {
  additions: number
  deletions: number
}

// 把任意值规范为文本行
export function toLines(value: unknown): string[] {
  if (value == null)
    return ['（空）']
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (text === '')
    return ['（空）']
  return text.split('\n')
}

// 经典 LCS 行级 diff：输出 remove（旧独有）+ add（新独有）+ context（共有）
export function computeLineDiff(before: unknown, after: unknown): DiffLine[] {
  const a = toLines(before)
  const b = toLines(after)
  const m = a.length
  const n = b.length
  // dp[i][j] = LCS(a[i:], b[j:]) 长度
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push({ type: 'context', text: a[i] })
      i++
      j++
    }
    else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'remove', text: a[i] })
      i++
    }
    else {
      lines.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < m) {
    lines.push({ type: 'remove', text: a[i] })
    i++
  }
  while (j < n) {
    lines.push({ type: 'add', text: b[j] })
    j++
  }
  return lines
}

export function diffStat(lines: DiffLine[]): DiffStatValue {
  return {
    additions: lines.filter(l => l.type === 'add').length,
    deletions: lines.filter(l => l.type === 'remove').length,
  }
}
```

- [ ] **步骤 2：DiffView + DiffStat 组件**

创建 `src/pages/assistant/components/diff/diff-view.tsx`：
```tsx
import { computeLineDiff } from './compute-line-diff'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export function DiffStat({ additions, deletions, className }: { additions: number, deletions: number, className?: string }) {
  if (additions === 0 && deletions === 0)
    return null
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-xs', className)}>
      {additions > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{additions}</span>}
      {deletions > 0 && <span className="text-rose-600 dark:text-rose-400">-{deletions}</span>}
    </span>
  )
}

export function DiffView({ before, after, className }: { before: unknown, after: unknown, className?: string }) {
  const lines = computeLineDiff(before, after)
  return (
    <ScrollArea className={cn('max-h-72 rounded-lg border', className)}>
      <pre className="min-w-full font-mono text-xs leading-relaxed">
        {lines.map((line, idx) => (
          <div
            key={`${line.type}-${idx}-${line.text}`}
            className={cn(
              'flex gap-2 px-2 py-0.5',
              line.type === 'add' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              line.type === 'remove' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
              line.type === 'context' && 'text-muted-foreground',
            )}
          >
            <span className="select-none text-muted-foreground/60">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <span className="whitespace-pre-wrap break-words">{line.text}</span>
          </div>
        ))}
      </pre>
    </ScrollArea>
  )
}
```

- [ ] **步骤 3：确认卡 diff 升级为红绿逐行**

重写 `src/pages/assistant/components/confirm-card/resume-field-diff.tsx`（保持导出 `ResumeFieldDiff({ before, after })` 不变）：
```tsx
import { DiffView } from '../diff/diff-view'

interface ResumeFieldDiffProps {
  before: unknown
  after: unknown
}

export function ResumeFieldDiff({ before, after }: ResumeFieldDiffProps) {
  return <DiffView before={before} after={after} />
}
```

- [ ] **步骤 4：验证**

```bash
pnpm exec eslint src/pages/assistant/components/diff/compute-line-diff.ts src/pages/assistant/components/diff/diff-view.tsx src/pages/assistant/components/confirm-card/resume-field-diff.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。确认卡内简历字段修改显示为红绿逐行 diff。

---

## 任务 3：写工具带 before/after + deriveCanvasModel 产 diff + 画布变更记录红绿 diff

**文件：**
- 修改：`src/lib/ai/tools/resume.ts`
- 修改：`src/lib/ai/tools/crud.ts`
- 修改：`src/pages/assistant/types.ts`
- 修改：`src/pages/assistant/utils.ts`
- 修改：`src/pages/assistant/components/assistant-canvas/change-log/index.tsx`

- [ ] **步骤 1：update_current_resume_field 结果带 before/after**

`src/lib/ai/tools/resume.ts` 的 `apply`（当前为 `updateResumeConfig(currentId, { [sectionKey]: after })` 后 `return { ok, sectionKey }`）改为：
```ts
      apply: async () => {
        await updateResumeConfig(currentId, { [sectionKey]: after })
        return { ok: true, sectionKey, before, after }
      },
```
（`before`/`after` 已在 execute 顶部定义，闭包可捕获。）

- [ ] **步骤 2：update_resume_meta 结果带 before/after**

`src/lib/ai/tools/crud.ts` 的 `update_resume_meta.apply` 改为带前后摘要文本（`before` 无历史值则用空串，`after` 用已拼好的 `parts`）：
```ts
      apply: async () => {
        await updateResumeConfig(resumeId, patch)
        return { ok: true, resumeId, before: '', after: parts.join('\n') }
      },
```

- [ ] **步骤 3：CanvasChange 增 stat**

`src/pages/assistant/types.ts` 的 `CanvasChange` 接口增可选字段：
```ts
export interface CanvasChange {
  id: string
  toolName: string
  category: CanvasChangeCategory
  action: CanvasChangeAction
  title: string
  detail?: CanvasChangeDetail
  stat?: { additions: number, deletions: number }
  state: AiToolCallState
  targetTab?: Exclude<CanvasTabKey, 'changes'>
}
```

- [ ] **步骤 4：deriveCanvasModel 产出 diff + stat**

`src/pages/assistant/utils.ts`：
1. 顶部 import 追加（合并到已有的相对 import 区）：
```ts
import { computeLineDiff, diffStat } from './components/diff/compute-line-diff'
```
2. 重写 `summarizeChange`：当 result 含 `before`/`after`（含空串）→ diff，否则 summary：
```ts
function summarizeChange(toolName: string, args: Record<string, unknown>, result: unknown): CanvasChange['detail'] {
  if (result && typeof result === 'object' && 'before' in result && 'after' in result) {
    const r = result as { before: unknown, after: unknown }
    return { kind: 'diff', before: r.before, after: r.after }
  }
  if (toolName === 'update_current_resume_field') {
    const sectionKey = String(args.sectionKey ?? '')
    return { kind: 'summary', text: `修改了简历模块「${sectionKey || '未知'}」` }
  }
  const resultText = result && typeof result === 'object'
    ? JSON.stringify(result)
    : String(result ?? '')
  return { kind: 'summary', text: resultText.slice(0, 200) }
}
```
3. 在 `deriveCanvasModel` 的 `changes.push({...})` 处计算 `stat`：把该块改为先算 detail，再据 detail 算 stat：
```ts
    const args = (part.args ?? {}) as Record<string, unknown>
    const detail = meta.category === 'read' ? undefined : summarizeChange(part.toolName, args, part.result)
    const stat = detail?.kind === 'diff' ? diffStat(computeLineDiff(detail.before, detail.after)) : undefined
    changes.push({
      id: part.toolCallId,
      toolName: part.toolName,
      category: meta.category,
      action: meta.action,
      title: buildTitle(meta, args),
      detail,
      stat: stat && (stat.additions > 0 || stat.deletions > 0) ? stat : undefined,
      state: part.state,
      targetTab: meta.targetTab,
    })
```

- [ ] **步骤 5：画布变更记录用 DiffView + stat**

重写 `src/pages/assistant/components/assistant-canvas/change-log/index.tsx`：
```tsx
import type { CanvasChange, CanvasModel } from '../../../types'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DiffStat, DiffView } from '../../diff/diff-view'

function StateBadge({ state }: { state: CanvasChange['state'] }) {
  if (state === 'cancelled')
    return <Badge variant="outline">已取消</Badge>
  if (state === 'error')
    return <Badge variant="destructive">失败</Badge>
  return <Badge variant="secondary">已应用</Badge>
}

export default function ChangeLog({ model }: { model: CanvasModel }) {
  if (model.writes.length === 0) {
    return <Empty><EmptyHeader><EmptyTitle>本轮暂无变更</EmptyTitle></EmptyHeader></Empty>
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="flex flex-col gap-2 p-3">
        {model.writes.map(change => (
          <Collapsible key={change.id} className="rounded-lg border bg-background">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-2.5 text-left text-sm">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{change.title}</span>
                {change.stat && <DiffStat additions={change.stat.additions} deletions={change.stat.deletions} />}
              </span>
              <StateBadge state={change.state} />
            </CollapsibleTrigger>
            {change.detail && (
              <CollapsibleContent className="border-t p-2.5 text-xs">
                {change.detail.kind === 'diff'
                  ? <DiffView before={change.detail.before} after={change.detail.after} />
                  : <p className="text-muted-foreground">{change.detail.text}</p>}
              </CollapsibleContent>
            )}
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  )
}
```

- [ ] **步骤 6：验证**

```bash
pnpm exec eslint src/lib/ai/tools/resume.ts src/lib/ai/tools/crud.ts src/pages/assistant/types.ts src/pages/assistant/utils.ts src/pages/assistant/components/assistant-canvas/change-log/index.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。AI 改简历字段并确认后，画布「变更记录」该条展开为红绿逐行 diff，卡片头显示 `+N -N`。

---

## 任务 4：对话内活动列表（替换 Used N tools）

**文件：**
- 修改：`src/pages/assistant/components/message-bubble/tool-call-part.tsx`

- [ ] **步骤 1：改渲染逐行活动列表**

重写 `src/pages/assistant/components/message-bubble/tool-call-part.tsx`。要点：每个 tool-call 一行（图标 + 标签 + DiffStat + 状态）；进行中（`call`/`awaiting-confirm`）只显示 loading 图标不与类目图标重叠；保留组底部「在画布中查看」。图标复用 `getToolCategoryIcon(iconCategory, { showBackground: false, size: 16 })`。
```tsx
import type { AiMessagePart } from '@/lib/ai/types'
import { Loader2, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getToolCategoryIcon } from '@/lib/utils/tool-icons'
import { computeLineDiff, diffStat } from '../diff/compute-line-diff'
import { DiffStat } from '../diff/diff-view'
import useAssistantStore from '../../store'
import { TOOL_CANVAS_META } from '../../utils'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

interface ToolCallPartProps {
  calls: ToolCallPart[]
}

function statOf(part: ToolCallPart): { additions: number, deletions: number } | null {
  const result = part.result
  if (result && typeof result === 'object' && 'before' in result && 'after' in result) {
    const r = result as { before: unknown, after: unknown }
    const s = diffStat(computeLineDiff(r.before, r.after))
    if (s.additions > 0 || s.deletions > 0)
      return s
  }
  return null
}

export function ToolCallPartGroup({ calls }: ToolCallPartProps) {
  const targetTab = calls
    .map(c => TOOL_CANVAS_META[c.toolName]?.targetTab)
    .find(Boolean)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-0.5">
        {calls.map((c) => {
          const meta = TOOL_CANVAS_META[c.toolName]
          const label = meta?.label ?? c.toolName
          const pending = c.state === 'call' || c.state === 'awaiting-confirm'
          const stat = statOf(c)
          return (
            <div key={c.toolCallId} className="flex items-center gap-2 py-0.5 text-sm text-muted-foreground">
              <span className="flex size-4 shrink-0 items-center justify-center">
                {pending
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : getToolCategoryIcon(meta?.iconCategory ?? 'general', { showBackground: false, size: 16 })}
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {stat && <DiffStat additions={stat.additions} deletions={stat.deletions} />}
              {c.state === 'cancelled' && <span className="text-xs">已取消</span>}
              {c.state === 'error' && <span className="text-xs text-rose-500">失败</span>}
            </div>
          )
        })}
      </div>
      {targetTab && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-fit gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => useAssistantStore.setState({ canvasOpen: true, canvasMobileOpen: true, canvasActiveTab: targetTab })}
        >
          <PanelRight className="size-3.5" />
          在画布中查看
        </Button>
      )}
    </div>
  )
}
```

- [ ] **步骤 2：验证**

```bash
pnpm exec eslint src/pages/assistant/components/message-bubble/tool-call-part.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。对话内工具调用变成逐行活动（图标+标签+增删计数），进行中只显示旋转 loading；组下方保留「在画布中查看」。

---

## 任务 5：画布可拖拽改宽 + 去选择器 + 去重头部图标 + 进出动画

**文件：**
- 修改：`src/pages/assistant/const.ts`
- 修改：`src/pages/assistant/store.ts`
- 修改：`src/pages/assistant/hooks/use-canvas-preview.ts`
- 修改：`src/pages/assistant/components/assistant-canvas/resume-preview/index.tsx`
- 修改：`src/pages/assistant/components/assistant-canvas/index.tsx`
- 修改：`src/pages/assistant/components/chat-header/index.tsx`

- [ ] **步骤 1：宽度常量**

`src/pages/assistant/const.ts` 末尾追加：
```ts
export const ASSISTANT_CANVAS_WIDTH_STORAGE_KEY = 'gresume:assistant:canvas-width'
export const CANVAS_MIN_WIDTH = 380
export const CANVAS_DEFAULT_WIDTH = 480
export const CANVAS_MAX_WIDTH = 760
```

- [ ] **步骤 2：store 增 canvasWidth**

`src/pages/assistant/store.ts`：
1. 顶部新增读数字的工具（若 `utils.ts` 无 `readStoredNumber` 则内联读取）。这里直接在 store 顶部 import 常量并加一个模块内 helper：
```ts
import { ASSISTANT_CANVAS_STORAGE_KEY, ASSISTANT_CANVAS_WIDTH_STORAGE_KEY, ASSISTANT_DEEP_THINKING_STORAGE_KEY, ASSISTANT_SIDEBAR_STORAGE_KEY, CANVAS_DEFAULT_WIDTH, CANVAS_MAX_WIDTH, CANVAS_MIN_WIDTH } from './const'
```
2. 在 `const useAssistantStore = create...` 之前加 helper：
```ts
function readStoredCanvasWidth(): number {
  try {
    const raw = Number(localStorage.getItem(ASSISTANT_CANVAS_WIDTH_STORAGE_KEY))
    if (Number.isFinite(raw) && raw > 0)
      return Math.min(CANVAS_MAX_WIDTH, Math.max(CANVAS_MIN_WIDTH, raw))
  }
  catch {}
  return CANVAS_DEFAULT_WIDTH
}
```
3. 接口加字段与 setter（在 `canvasOpen` 附近）：
```ts
  canvasWidth: number
```
```ts
  setCanvasWidth: (px: number) => void
```
4. 初始值（`canvasOpen` 附近）：
```ts
  canvasWidth: readStoredCanvasWidth(),
```
5. setter 实现（`setCanvasOpen` 附近）：
```ts
  setCanvasWidth: (px) => {
    const clamped = Math.min(CANVAS_MAX_WIDTH, Math.max(CANVAS_MIN_WIDTH, Math.round(px)))
    try {
      localStorage.setItem(ASSISTANT_CANVAS_WIDTH_STORAGE_KEY, String(clamped))
    }
    catch {}
    set({ canvasWidth: clamped })
  },
```

- [ ] **步骤 3：预览 hook 暴露当前简历名、去手选**

`src/pages/assistant/hooks/use-canvas-preview.ts`：
1. 返回值增加 `currentName`（按 `previewResumeId` 在 `options` 里找 `name`）：在 `return` 前计算：
```ts
  const currentName = options.find(o => o.resumeId === previewResumeId)?.name ?? null
```
2. `return` 改为：
```ts
  return { previewResumeId, options, snapshot, status, currentName }
```
（不再返回 `setPreviewResumeId`；`options` 仍保留供取名。其余逻辑不变。）

- [ ] **步骤 4：预览组件去 Select 改只读标题**

重写 `src/pages/assistant/components/assistant-canvas/resume-preview/index.tsx`：
```tsx
import { FileText } from 'lucide-react'
import { useMemo } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useCanvasPreview } from '../../../hooks/use-canvas-preview'

export default function ResumePreview() {
  const { snapshot, status, currentName } = useCanvasPreview()
  const previewData = useMemo(() => (snapshot ? buildTemplateResumeData(snapshot) : null), [snapshot])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 text-sm">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{currentName ?? '当前简历'}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {status === 'loading' && <Skeleton className="h-[560px] w-full rounded-lg" />}
          {status === 'error' && <p className="py-10 text-center text-sm text-muted-foreground">该简历加载失败，请重试或切换其它简历。</p>}
          {(status === 'empty' || (!previewData && status === 'idle')) && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText /></EmptyMedia>
                <EmptyTitle>还没有可预览的简历</EmptyTitle>
                <EmptyDescription>在编辑器打开一份简历，或让 AI 新建，这里会实时预览。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {previewData && status === 'idle' && <ScaledReadonlyPreview data={previewData} appearance={snapshot} />}
        </div>
      </ScrollArea>
    </div>
  )
}
```

- [ ] **步骤 5：画布壳拖拽手柄 + 宽度 + 进出动画**

重写 `src/pages/assistant/components/assistant-canvas/index.tsx` 的 `AssistantCanvas`（`CanvasInner` 不变）。要点：`AnimatePresence` 包裹桌面 aside；宽度取 `canvasWidth`；左边框拖拽手柄用 pointer 事件调 `setCanvasWidth`；拖拽中关过渡。
```tsx
import { PanelRightClose } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCanvasModel } from '../../hooks/use-canvas-model'
import useAssistantStore from '../../store'
import BoardSnapshot from './board-snapshot'
import { CanvasTabs } from './canvas-tabs'
import ChangeLog from './change-log'
import ResumePreview from './resume-preview'
import VersionTimeline from './version-timeline'

function CanvasInner() {
  const model = useCanvasModel()
  const { canvasActiveTab, setCanvasActiveTab } = useAssistantStore()

  return (
    <Tabs value={canvasActiveTab} onValueChange={v => setCanvasActiveTab(v as typeof canvasActiveTab)} className="flex h-full min-h-0 flex-col gap-0">
      <CanvasTabs model={model} />
      <TabsContent value="resume" className="min-h-0 flex-1 overflow-hidden">
        <ResumePreview />
      </TabsContent>
      <TabsContent value="board" className="min-h-0 flex-1 overflow-hidden">
        {model.touchedBoard && <BoardSnapshot model={model} />}
      </TabsContent>
      <TabsContent value="version" className="min-h-0 flex-1 overflow-hidden">
        {model.touchedVersion && <VersionTimeline model={model} />}
      </TabsContent>
      <TabsContent value="changes" className="min-h-0 flex-1 overflow-hidden">
        {model.hasWrites && <ChangeLog model={model} />}
      </TabsContent>
    </Tabs>
  )
}

export default function AssistantCanvas() {
  const { canvasOpen, canvasMobileOpen, canvasWidth, setCanvasOpen, setCanvasMobileOpen, setCanvasWidth } = useAssistantStore()
  const isMobile = useIsMobile()
  const shouldReduceMotion = useReducedMotion()
  const [dragging, setDragging] = useState(false)
  const dragState = useRef<{ startX: number, startWidth: number } | null>(null)

  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startWidth: canvasWidth }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current)
      return
    // 右栏：向左拖变宽
    const next = dragState.current.startWidth + (dragState.current.startX - e.clientX)
    setCanvasWidth(next)
  }
  const onHandlePointerUp = (e: React.PointerEvent) => {
    dragState.current = null
    setDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (isMobile) {
    return (
      <Sheet open={canvasMobileOpen} onOpenChange={setCanvasMobileOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b pr-12 text-left">
            <SheetTitle>画布</SheetTitle>
            <SheetDescription>实时预览简历与本轮变更</SheetDescription>
          </SheetHeader>
          <CanvasInner />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AnimatePresence initial={false}>
      {canvasOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: canvasWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={shouldReduceMotion || dragging ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
          style={{ width: canvasWidth }}
          className="relative hidden h-dvh shrink-0 flex-col overflow-hidden border-l bg-muted/25 md:flex"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整画布宽度"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 active:bg-primary/50"
          />
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            <span className="text-sm font-medium">画布</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="收起画布" onClick={() => setCanvasOpen(false)}>
                  <PanelRightClose />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">收起画布</TooltipContent>
            </Tooltip>
          </div>
          <CanvasInner />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **步骤 6：chat-header 画布按钮桌面端仅折叠时显示**

`src/pages/assistant/components/chat-header/index.tsx`，把画布按钮外层包一层显隐条件：桌面端仅 `!canvasOpen` 显示、移动端始终显示。改按钮渲染为：
```tsx
      {(isMobile || !canvasOpen) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label="切换画布"
              onClick={() => (isMobile ? setCanvasMobileOpen(true) : setCanvasOpen(!canvasOpen))}
            >
              <PanelRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>画布</TooltipContent>
        </Tooltip>
      )}
```
（`canvasOpen` 已在 store 解构中；若未解构则在顶部 `useAssistantStore()` 解构里补 `canvasOpen`。当画布展开时该按钮隐藏，`ml-auto` 失效不影响布局——标题的 `min-w-0` 容器保持左对齐即可。）

> 布局补丁：画布展开且按钮隐藏时，标题右侧无 `ml-auto` 撑开。为保持一致，把标题容器改为 `<div className="min-w-0 flex-1">`（占满剩余空间），确保按钮存在与否布局稳定。

- [ ] **步骤 7：验证**

```bash
pnpm exec eslint src/pages/assistant/const.ts src/pages/assistant/store.ts src/pages/assistant/hooks/use-canvas-preview.ts src/pages/assistant/components/assistant-canvas src/pages/assistant/components/chat-header/index.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。桌面画布可从左边框拖拽改宽并刷新保持；展开/收起有动画；顶部仅一个折叠按钮；chat-header 画布按钮仅在折叠时出现；预览为只读标题无选择器。

---

## 任务 6：全量验证与 Codex 差距落档

**文件：** 仅验证 + 追加规格分析章节的执行确认（不改功能代码）。

- [ ] **步骤 1：全量静态检查 + 构建**

```bash
pnpm exec eslint --no-warn-ignored \
  src/pages/assistant \
  src/lib/ai/tools/resume.ts \
  src/lib/ai/tools/crud.ts \
  src/components/ui/composer.tsx
pnpm exec tsc --noEmit
pnpm build
git diff --check
```
预期：eslint 0 error；tsc 0 error；build `✓ built`（仅既有 chunk-size 警告）；diff-check 无输出。

- [ ] **步骤 2：桌面人工验收**

`pnpm dev` 下逐项确认（对照规格 §9）：
- 深度思考：composer 开关可开合并刷新保持；开启后助手出现可展开思考链、流式 Shimmer「正在思考…」；关闭后无思考。
- 活动列表：工具调用逐行（图标+标签+`+N -N`），进行中仅 loading 图标不重叠；「在画布中查看」联动正确 tab。
- diff：改简历字段确认后，确认卡与画布变更记录均为红绿逐行 diff，卡片头 `+N -N`。
- 画布：左边框可拖拽改宽、刷新保持、min/max clamp；展开/收起有动画；顶部仅一个折叠按钮；chat-header 按钮仅折叠时出现；预览为只读当前简历名。

- [ ] **步骤 3：窄屏与回归**

- 窄屏画布为全屏 Sheet，Chat Header 按钮唤起，无 ARIA 告警。
- 切换/新建会话：画布随消息重建；深度思考/画布宽度偏好保持。
- 读操作不弹确认；写操作走确认卡；取消的写操作在活动列表与变更记录标注「已取消」。

- [ ] **步骤 4：完成报告**

汇总：改动文件清单、各验证命令结果、人工验收结论；确认未 commit/未 push；深度思考 bug 已修复；Codex 差距分析见规格 §7（本轮不实现）。

---

## 规格覆盖自检

| 规格要求 | 对应任务 |
| --- | --- |
| 深度思考接通（修复恒关 bug）| 任务 1（步骤 1-3）|
| composer 深度思考开关（默认关+记忆）| 任务 1（步骤 4-5）|
| 思考链 + Shimmer（替换点阵图标）| 任务 1（步骤 6-8）|
| 统一红绿 DiffView + computeLineDiff | 任务 2 |
| 确认卡升级红绿 diff | 任务 2（步骤 3）|
| 写工具带 before/after | 任务 3（步骤 1-2）|
| deriveCanvasModel 产 diff + stat | 任务 3（步骤 3-4）|
| 画布变更记录红绿 diff + stat | 任务 3（步骤 5）|
| 对话内活动列表（替换 Used N tools）| 任务 4 |
| 画布可拖拽改宽（非固定）| 任务 5（步骤 1-2、5）|
| 只读展示当前简历（去选择器）| 任务 5（步骤 3-4）|
| 去重顶部图标 | 任务 5（步骤 6）|
| 展开/收起动画 | 任务 5（步骤 5）|
| Codex 差距分析 | 规格 §7 + 任务 6（步骤 4）|
| 复用现成组件、不覆盖配色、不写测试、不提交 | 全计划覆盖规则 |
