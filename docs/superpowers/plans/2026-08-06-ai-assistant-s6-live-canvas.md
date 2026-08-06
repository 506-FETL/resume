# AI 助手 S6 实时画布（预览 + 变更追踪）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 `/assistant` 对话右侧新增常驻可折叠的第三栏「画布」，实时预览对话中正在编辑的简历，并按对象类型（简历/看板/版本）与统一「变更记录」展示本轮 AI 的读取与增删改；同时把对话内工具调用升级为可展开、可联动画布的条目。

**架构：** 布局改为 `会话侧栏 | 对话区 | 画布` 三栏；画布 UI 状态入 `store.ts`，画布数据由纯函数 `deriveCanvasModel(messages)` 从会话消息的 `tool-call` parts 推导（会话级，不新增表）；简历预览按 `previewResumeId` 从持久化 `getResumeById` 拉取（不读内存 store）并用 `ScaledReadonlyPreview` 只读渲染；修正 `update_current_resume_field` 为直接 `updateResumeConfig` 落库。UI 一律复用现成组件（Tabs/Select/Card/Badge/Collapsible/ScrollArea/Sheet/Empty/Skeleton），看板表格用 shadcn `table`。

**技术栈：** React + TypeScript、Zustand、Radix/shadcn UI、motion/react、Supabase 数据层、既有 `ScaledReadonlyPreview` / `buildResumeSnapshot` / `buildTemplateResumeData`。

**规格：** `docs/superpowers/specs/2026-08-06-ai-assistant-s6-live-canvas-design.md`

**仓库覆盖规则（重要）：**
- 本仓库不写测试文件；用 `pnpm exec eslint <file>`、`pnpm exec tsc --noEmit`、`pnpm build`、`git diff --check` + 人工验收替代 TDD。
- 当前分支内联工作，不新建分支；最终验证通过前不 `git commit`、不 `git push`。
- 每个任务末尾用"验证步骤"替代"commit 步骤"。
- 能用现成组件就不自造；`className` 只用于布局，不覆盖组件配色/排版。

---

## 文件结构与职责

**修改：**
- `src/pages/assistant/const.ts` — 新增画布相关常量（storage key、tab key、刷新常量）。
- `src/pages/assistant/types.ts` — 新增 `CanvasTabKey`/`CanvasChange`/`CanvasModel` 类型。
- `src/pages/assistant/store.ts` — 新增画布 UI 状态与 setter；`reset` 纳入画布态。
- `src/pages/assistant/utils.ts` — 新增 `TOOL_CANVAS_META`、`deriveCanvasModel`、摘要/diff 提取工具。
- `src/pages/assistant/index.tsx` — 布局改三栏，挂载画布。
- `src/pages/assistant/components/chat-header/index.tsx` — 新增「画布」切换按钮。
- `src/pages/assistant/components/message-bubble/tool-call-part.tsx` — 内联条目升级 + 联动画布，改用 `TOOL_CANVAS_META`。
- `src/lib/ai/tools/resume.ts` — `update_current_resume_field` 写入改为 `updateResumeConfig` 直接落库。

**创建：**
- `src/pages/assistant/hooks/use-canvas-model.ts` — `messages + streamingParts → CanvasModel`（memo）。
- `src/pages/assistant/hooks/use-canvas-preview.ts` — `previewResumeId` 解析/拉取/刷新/下拉数据。
- `src/pages/assistant/components/assistant-canvas/index.tsx` — 画布壳（桌面列/移动 Sheet + Tabs 装配）。
- `src/pages/assistant/components/assistant-canvas/canvas-tabs.tsx` — 顶部 Tabs 条（按 model 动态显示）。
- `src/pages/assistant/components/assistant-canvas/resume-preview/index.tsx` — 简历预览 tab。
- `src/pages/assistant/components/assistant-canvas/board-snapshot/index.tsx` — 看板只读表 tab。
- `src/pages/assistant/components/assistant-canvas/version-timeline/index.tsx` — 版本时间线 tab。
- `src/pages/assistant/components/assistant-canvas/change-log/index.tsx` — 变更记录 tab。
- `src/components/ui/table.tsx` — 经 shadcn CLI 引入（任务 4）。

---

## 任务 1：常量、类型、Store 画布状态、三栏布局骨架

**文件：**
- 修改：`src/pages/assistant/const.ts`
- 修改：`src/pages/assistant/types.ts`
- 修改：`src/pages/assistant/store.ts`
- 修改：`src/pages/assistant/index.tsx`
- 修改：`src/pages/assistant/components/chat-header/index.tsx`
- 创建：`src/pages/assistant/components/assistant-canvas/index.tsx`

- [ ] **步骤 1：新增常量**

在 `src/pages/assistant/const.ts` 末尾追加：

```ts
export const ASSISTANT_CANVAS_STORAGE_KEY = 'gresume:assistant:canvas-open'
export const CANVAS_TABS = ['resume', 'board', 'version', 'changes'] as const
```

- [ ] **步骤 2：新增类型**

在 `src/pages/assistant/types.ts` 末尾追加（`AiToolCallState` 从 `@/lib/ai/types` 导入）：

```ts
import type { AiToolCallState } from '@/lib/ai/types'

export type CanvasTabKey = 'resume' | 'board' | 'version' | 'changes'

export type CanvasChangeCategory = 'resume' | 'board' | 'version' | 'read'
export type CanvasChangeAction = 'read' | 'create' | 'update' | 'delete' | 'restore'

export type CanvasChangeDetail =
  | { kind: 'diff', before: unknown, after: unknown }
  | { kind: 'summary', text: string }

export interface CanvasChange {
  id: string
  toolName: string
  category: CanvasChangeCategory
  action: CanvasChangeAction
  title: string
  detail?: CanvasChangeDetail
  state: AiToolCallState
  targetTab?: Exclude<CanvasTabKey, 'changes'>
}

export interface CanvasModel {
  changes: CanvasChange[]
  writes: CanvasChange[]
  touchedBoard: boolean
  touchedVersion: boolean
  hasWrites: boolean
}
```

若 `types.ts` 顶部已有从 `@/lib/ai/types` 的 import，合并而非重复引入。

- [ ] **步骤 3：Store 增画布状态**

在 `src/pages/assistant/store.ts`：
1. 顶部 import 增加常量：
```ts
import { ASSISTANT_CANVAS_STORAGE_KEY, ASSISTANT_SIDEBAR_STORAGE_KEY } from './const'
```
2. `import type` 增加 `CanvasTabKey`：
```ts
import type { CanvasTabKey } from './types'
```
3. `interface AssistantStore` 增字段与 setter：
```ts
  canvasOpen: boolean
  canvasMobileOpen: boolean
  canvasActiveTab: CanvasTabKey
  previewResumeId: string | null

  setCanvasOpen: (v: boolean) => void
  setCanvasMobileOpen: (v: boolean) => void
  setCanvasActiveTab: (tab: CanvasTabKey) => void
  setPreviewResumeId: (id: string | null) => void
```
4. 初始值（放在 `sidebarExpanded` 附近）：
```ts
  canvasOpen: readStoredBoolean(ASSISTANT_CANVAS_STORAGE_KEY, true),
  canvasMobileOpen: false,
  canvasActiveTab: 'resume',
  previewResumeId: null,
```
5. setter 实现：
```ts
  setCanvasOpen: (v) => {
    writeStoredBoolean(ASSISTANT_CANVAS_STORAGE_KEY, v)
    set({ canvasOpen: v })
  },
  setCanvasMobileOpen: v => set({ canvasMobileOpen: v }),
  setCanvasActiveTab: tab => set({ canvasActiveTab: tab }),
  setPreviewResumeId: id => set({ previewResumeId: id }),
```
6. `reset` 内追加 `canvasMobileOpen: false, canvasActiveTab: 'resume'`（不重置 `canvasOpen` 持久化偏好，不重置 `previewResumeId`——由 bootstrap 重新种子）。

- [ ] **步骤 4：画布空壳组件**

创建 `src/pages/assistant/components/assistant-canvas/index.tsx`（本任务先出空壳，tab 内容在后续任务填充）：

```tsx
import { PanelRightClose } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import useAssistantStore from '../../store'

function CanvasInner() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* tab 条与内容在任务 2-4 填充 */}
      <div className="flex-1 min-h-0" />
    </div>
  )
}

export default function AssistantCanvas() {
  const { canvasOpen, canvasMobileOpen, setCanvasOpen, setCanvasMobileOpen } = useAssistantStore()
  const isMobile = useIsMobile()
  const shouldReduceMotion = useReducedMotion()

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

  if (!canvasOpen)
    return null

  return (
    <motion.aside
      initial={false}
      animate={{ width: 420 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
      className="hidden h-dvh shrink-0 flex-col overflow-hidden border-l bg-muted/25 md:flex"
    >
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
  )
}
```

- [ ] **步骤 5：页面挂载画布 + Chat Header 切换按钮**

`src/pages/assistant/index.tsx`：import 并在对话区右侧渲染画布：
```tsx
import AssistantCanvas from './components/assistant-canvas'
```
把返回结构改为（在最外层 flex 内、`ConversationSearch` 之前追加 `<AssistantCanvas />`）：
```tsx
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
      <AssistantSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader />
        <div className="min-h-0 flex-1 overflow-hidden">
          <MessageList />
        </div>
        <div className="shrink-0 border-t bg-background/90 py-3 backdrop-blur">
          <Composer />
        </div>
      </div>
      <AssistantCanvas />
      <ConversationSearch />
    </div>
```

`src/pages/assistant/components/chat-header/index.tsx`：新增画布切换按钮（放在标题右侧，用 `ml-auto`）。在现有 import 追加：
```tsx
import { Menu, PanelRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
```
组件内从 store 取 `canvasOpen/canvasMobileOpen/setCanvasOpen/setCanvasMobileOpen`，`const isMobile = useIsMobile()`，在标题 `div` 之后追加：
```tsx
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label="切换画布"
            onClick={() => isMobile ? setCanvasMobileOpen(true) : setCanvasOpen(!canvasOpen)}
          >
            <PanelRight />
          </Button>
        </TooltipTrigger>
        <TooltipContent>画布</TooltipContent>
      </Tooltip>
```
（`Tooltip`/`TooltipContent`/`TooltipTrigger` 若未导入则补充 import。）

- [ ] **步骤 6：验证**

运行：
```bash
pnpm exec eslint src/pages/assistant/const.ts src/pages/assistant/types.ts src/pages/assistant/store.ts src/pages/assistant/index.tsx src/pages/assistant/components/chat-header/index.tsx src/pages/assistant/components/assistant-canvas/index.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：eslint 0 error、tsc 0 error、diff-check 无输出。桌面出现可折叠右栏空壳，Chat Header 有画布按钮，窄屏点按钮弹出 Sheet。

---

## 任务 2：变更模型 `deriveCanvasModel` + `use-canvas-model` + 内联条目升级

**文件：**
- 修改：`src/pages/assistant/utils.ts`
- 创建：`src/pages/assistant/hooks/use-canvas-model.ts`
- 修改：`src/pages/assistant/components/message-bubble/tool-call-part.tsx`

- [ ] **步骤 1：工具映射表 + 推导函数**

在 `src/pages/assistant/utils.ts` 顶部追加 import：
```ts
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import type { CanvasChange, CanvasChangeAction, CanvasChangeCategory, CanvasModel } from './types'
```

追加映射表与推导：
```ts
interface ToolCanvasMeta {
  category: CanvasChangeCategory
  action: CanvasChangeAction
  iconCategory: string // 供 tool-icons 取图标
  label: string
  targetTab?: 'resume' | 'board' | 'version'
}

// 单一来源：工具 → 画布分类/动作/图标/标题（替代 tool-call-part 内旧 TOOL_META）
export const TOOL_CANVAS_META: Record<string, ToolCanvasMeta> = {
  list_resumes: { category: 'read', action: 'read', iconCategory: 'documents', label: '读取简历列表' },
  get_resume_detail: { category: 'read', action: 'read', iconCategory: 'documents', label: '读取简历内容' },
  update_current_resume_field: { category: 'resume', action: 'update', iconCategory: 'todos', label: '修改简历', targetTab: 'resume' },
  create_resume: { category: 'resume', action: 'create', iconCategory: 'documents', label: '新建简历', targetTab: 'resume' },
  update_resume_meta: { category: 'resume', action: 'update', iconCategory: 'todos', label: '修改简历信息', targetTab: 'resume' },
  delete_resume: { category: 'resume', action: 'delete', iconCategory: 'todos', label: '删除简历', targetTab: 'resume' },
  open_resume: { category: 'read', action: 'read', iconCategory: 'documents', label: '打开简历', targetTab: 'resume' },
  save_current_resume_version: { category: 'version', action: 'create', iconCategory: 'reminders', label: '保存历史版本', targetTab: 'version' },
  restore_current_resume_version: { category: 'version', action: 'restore', iconCategory: 'reminders', label: '恢复历史版本', targetTab: 'version' },
  delete_resume_version: { category: 'version', action: 'delete', iconCategory: 'reminders', label: '删除历史版本', targetTab: 'version' },
  list_resume_versions: { category: 'read', action: 'read', iconCategory: 'reminders', label: '读取历史版本', targetTab: 'version' },
  list_jobs: { category: 'read', action: 'read', iconCategory: 'goal_tracking', label: '读取求职看板', targetTab: 'board' },
  get_job: { category: 'read', action: 'read', iconCategory: 'goal_tracking', label: '读取职位详情', targetTab: 'board' },
  create_job: { category: 'board', action: 'create', iconCategory: 'goal_tracking', label: '新增职位', targetTab: 'board' },
  update_job: { category: 'board', action: 'update', iconCategory: 'goal_tracking', label: '修改职位', targetTab: 'board' },
  delete_job: { category: 'board', action: 'delete', iconCategory: 'goal_tracking', label: '删除职位', targetTab: 'board' },
  get_ats: { category: 'read', action: 'read', iconCategory: 'development', label: '读取 ATS 评分' },
  get_variant_tree: { category: 'read', action: 'read', iconCategory: 'memory', label: '读取派生血缘' },
  list_templates: { category: 'read', action: 'read', iconCategory: 'creative', label: '读取模板' },
  get_user_profile: { category: 'read', action: 'read', iconCategory: 'general', label: '读取用户资料' },
  get_current_time: { category: 'read', action: 'read', iconCategory: 'reminders', label: '获取当前时间' },
}

function summarizeChange(toolName: string, meta: ToolCanvasMeta, args: Record<string, unknown>, result: unknown): CanvasChange['detail'] {
  // 简历字段修改：优先 diff（before 取自 args 不可得时降级 summary）
  if (toolName === 'update_current_resume_field') {
    const sectionKey = String(args.sectionKey ?? '')
    return { kind: 'summary', text: `修改了简历模块「${sectionKey || '未知'}」` }
  }
  const resultText = result && typeof result === 'object'
    ? JSON.stringify(result)
    : String(result ?? '')
  return { kind: 'summary', text: resultText.slice(0, 200) }
}

function buildTitle(meta: ToolCanvasMeta, args: Record<string, unknown>): string {
  if (meta.label === '新增职位' && args.data && typeof args.data === 'object') {
    const d = args.data as Record<string, unknown>
    if (d.company || d.position)
      return `新增职位 ${d.company ?? ''} · ${d.position ?? ''}`.trim()
  }
  if (meta.label === '新建简历' && args.display_name)
    return `新建简历「${String(args.display_name)}」`
  return meta.label
}

export function deriveCanvasModel(messages: AiMessage[], streamingParts: AiMessagePart[] = []): CanvasModel {
  const allParts: AiMessagePart[] = [
    ...messages.flatMap(m => m.parts),
    ...streamingParts,
  ]
  const changes: CanvasChange[] = []

  for (const part of allParts) {
    if (part.type !== 'tool-call')
      continue
    const meta = TOOL_CANVAS_META[part.toolName] ?? {
      category: 'read' as const,
      action: 'read' as const,
      iconCategory: 'general',
      label: part.toolName,
    }
    const args = (part.args ?? {}) as Record<string, unknown>
    changes.push({
      id: part.toolCallId,
      toolName: part.toolName,
      category: meta.category,
      action: meta.action,
      title: buildTitle(meta, args),
      detail: meta.category === 'read' ? undefined : summarizeChange(part.toolName, meta, args, part.result),
      state: part.state,
      targetTab: meta.targetTab,
    })
  }

  const writes = changes.filter(c => c.category !== 'read')
  return {
    changes,
    writes,
    touchedBoard: changes.some(c => c.targetTab === 'board'),
    touchedVersion: changes.some(c => c.targetTab === 'version'),
    hasWrites: writes.length > 0,
  }
}
```

- [ ] **步骤 2：`use-canvas-model` hook**

创建 `src/pages/assistant/hooks/use-canvas-model.ts`：
```ts
import { useMemo } from 'react'
import type { CanvasModel } from '../types'
import useAssistantStore from '../store'
import { deriveCanvasModel } from '../utils'

export function useCanvasModel(): CanvasModel {
  const { messages, streamingParts } = useAssistantStore()
  return useMemo(() => deriveCanvasModel(messages, streamingParts), [messages, streamingParts])
}
```

- [ ] **步骤 3：内联条目升级 + 联动画布**

改 `src/pages/assistant/components/message-bubble/tool-call-part.tsx`：删除文件内旧 `TOOL_META`，改用 `TOOL_CANVAS_META`；每个工具项映射时带 `targetTab`，并在 `ToolCallsSection` 的条目上支持「在画布中查看」。因 `ToolCallsSection` 的 `message`/`show_category` 已支持自定义文案，最小改动为：用 `TOOL_CANVAS_META[c.toolName]?.label ?? c.toolName` 作 `tool_name`/`message`，`tool_category` 取 `iconCategory`；并在分组下方追加一行"在画布中查看"入口（当该组存在任一 `targetTab`）：

```tsx
import type { AiMessagePart } from '@/lib/ai/types'
import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolCallsSection } from '@/components/ui/tool-calls-section'
import { TOOL_CANVAS_META } from '../../utils'
import useAssistantStore from '../../store'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

interface ToolCallPartProps {
  calls: ToolCallPart[]
}

export function ToolCallPartGroup({ calls }: ToolCallPartProps) {
  const entries = calls.map((c) => {
    const meta = TOOL_CANVAS_META[c.toolName]
    return {
      tool_name: meta?.label ?? c.toolName,
      tool_category: meta?.iconCategory ?? 'general',
      tool_call_id: c.toolCallId,
      inputs: (c.args ?? {}) as Record<string, unknown>,
      output: c.result === undefined ? '' : JSON.stringify(c.result),
      show_category: false,
    }
  })

  // 该组涉及的画布目标 tab（取第一个有 targetTab 的工具）
  const targetTab = calls
    .map(c => TOOL_CANVAS_META[c.toolName]?.targetTab)
    .find(Boolean)

  return (
    <div className="flex flex-col gap-1">
      <ToolCallsSection toolCalls={entries} />
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

> 说明：直接 `setState` 同时设桌面/移动开与目标 tab，桌面忽略 `canvasMobileOpen`、移动忽略 `canvasOpen`，无副作用。

- [ ] **步骤 4：验证**

运行：
```bash
pnpm exec eslint src/pages/assistant/utils.ts src/pages/assistant/hooks/use-canvas-model.ts src/pages/assistant/components/message-bubble/tool-call-part.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。对话内每组工具调用下出现「在画布中查看」（当涉及简历/看板/版本）。

---

## 任务 3：简历预览 tab + 画布 Tabs 条 + 写入路径修正

**文件：**
- 创建：`src/pages/assistant/hooks/use-canvas-preview.ts`
- 创建：`src/pages/assistant/components/assistant-canvas/resume-preview/index.tsx`
- 创建：`src/pages/assistant/components/assistant-canvas/canvas-tabs.tsx`
- 修改：`src/pages/assistant/components/assistant-canvas/index.tsx`
- 修改：`src/lib/ai/tools/resume.ts`

- [ ] **步骤 1：写入路径修正**

`src/lib/ai/tools/resume.ts`：
1. 顶部 import 增加 `updateResumeConfig`：
```ts
import { getAllResumesFromUser, getResumeById, updateResumeConfig } from '@/lib/supabase/resume'
```
2. `update_current_resume_field.execute` 内用闭包捕获 `currentId`，`apply` 改为直接落库：
```ts
    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'update_current_resume_field',
      preview: {
        kind: 'resume-field',
        title: `修改【${SECTION_LABELS[sectionKey] ?? sectionKey}】`,
        sectionKey,
        before,
        after,
      },
      apply: async () => {
        await updateResumeConfig(currentId, { [sectionKey]: after })
        return { ok: true, sectionKey }
      },
    })
```
（保留原 `before` 取值；`currentId` 已在函数开头声明。）

- [ ] **步骤 2：预览数据 hook**

创建 `src/pages/assistant/hooks/use-canvas-preview.ts`：
```ts
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { useEffect, useMemo, useState } from 'react'
import { buildResumeSnapshot } from '@/pages/history/utils'
import { getAllResumesFromUser, getResumeById } from '@/lib/supabase/resume'
import useCurrentResumeStore from '@/store/resume/current'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../store'
import { useCanvasModel } from './use-canvas-model'

interface ResumeOption { resumeId: string, name: string }

export function useCanvasPreview() {
  const { previewResumeId, setPreviewResumeId } = useAssistantStore()
  const currentResumeId = useCurrentResumeStore(s => s.resumeId)
  const { writes } = useCanvasModel()
  const [options, setOptions] = useState<ResumeOption[]>([])
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle')

  // 简历类写操作次数变化 → 触发刷新
  const resumeWriteCount = useMemo(
    () => writes.filter(w => w.category === 'resume').length,
    [writes],
  )

  // 下拉选项
  useEffect(() => {
    getAllResumesFromUser()
      .then((rows) => {
        const list = (rows ?? []).map((r: Record<string, unknown>) => ({
          resumeId: String(r.resume_id),
          name: String(r.display_name ?? '未命名'),
        }))
        setOptions(list)
      })
      .catch(() => setOptions([]))
  }, [resumeWriteCount])

  // 种子：previewResumeId 为空时跟随全局当前编辑简历
  useEffect(() => {
    if (!previewResumeId && currentResumeId)
      setPreviewResumeId(currentResumeId)
  }, [currentResumeId, previewResumeId, setPreviewResumeId])

  // AI open/create 改了当前编辑简历 → 联动切换预览
  useEffect(() => {
    if (currentResumeId && currentResumeId !== previewResumeId)
      setPreviewResumeId(currentResumeId)
    // 仅在 currentResumeId 变化时联动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentResumeId])

  // 拉取被预览简历
  useEffect(() => {
    if (!previewResumeId) {
      setSnapshot(null)
      setStatus(options.length === 0 ? 'empty' : 'idle')
      return
    }
    let cancelled = false
    setStatus('loading')
    getResumeById(previewResumeId, '*')
      .then((data) => {
        if (cancelled)
          return
        setSnapshot(buildResumeSnapshot(data))
        setStatus('idle')
      })
      .catch((error) => {
        if (cancelled)
          return
        getErrorMessage(error)
        setSnapshot(null)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [previewResumeId, resumeWriteCount, options.length])

  return { previewResumeId, setPreviewResumeId, options, snapshot, status }
}
```

- [ ] **步骤 3：预览 tab 组件**

创建 `src/pages/assistant/components/assistant-canvas/resume-preview/index.tsx`：
```tsx
import { useMemo } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText } from 'lucide-react'
import { useCanvasPreview } from '../../../hooks/use-canvas-preview'

export default function ResumePreview() {
  const { previewResumeId, setPreviewResumeId, options, snapshot, status } = useCanvasPreview()
  const previewData = useMemo(() => snapshot ? buildTemplateResumeData(snapshot) : null, [snapshot])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b p-2">
        <Select value={previewResumeId ?? undefined} onValueChange={setPreviewResumeId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择要预览的简历" />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o.resumeId} value={o.resumeId}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
                <EmptyDescription>让 AI 帮你新建一份，或在上方选择一份简历。</EmptyDescription>
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

- [ ] **步骤 4：Tabs 条**

创建 `src/pages/assistant/components/assistant-canvas/canvas-tabs.tsx`：
```tsx
import { FileText, GitBranch, ListChecks, Table2 } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CanvasModel } from '../../types'

export function CanvasTabs({ model }: { model: CanvasModel }) {
  return (
    <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
      <TabsTrigger value="resume" className="gap-1.5"><FileText className="size-4" />简历预览</TabsTrigger>
      {model.touchedBoard && <TabsTrigger value="board" className="gap-1.5"><Table2 className="size-4" />求职看板</TabsTrigger>}
      {model.touchedVersion && <TabsTrigger value="version" className="gap-1.5"><GitBranch className="size-4" />历史版本</TabsTrigger>}
      {model.hasWrites && <TabsTrigger value="changes" className="gap-1.5"><ListChecks className="size-4" />变更记录</TabsTrigger>}
    </TabsList>
  )
}
```

- [ ] **步骤 5：画布壳接入 Tabs（预览可用，其余占位）**

改 `src/pages/assistant/components/assistant-canvas/index.tsx` 的 `CanvasInner`：
```tsx
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useCanvasModel } from '../../hooks/use-canvas-model'
import { CanvasTabs } from './canvas-tabs'
import ResumePreview from './resume-preview'

function CanvasInner() {
  const model = useCanvasModel()
  const { canvasActiveTab, setCanvasActiveTab } = useAssistantStore()

  return (
    <Tabs value={canvasActiveTab} onValueChange={v => setCanvasActiveTab(v as typeof canvasActiveTab)} className="flex h-full min-h-0 flex-col gap-0">
      <CanvasTabs model={model} />
      <TabsContent value="resume" className="min-h-0 flex-1 overflow-hidden">
        <ResumePreview />
      </TabsContent>
      <TabsContent value="board" className="min-h-0 flex-1 overflow-hidden" />
      <TabsContent value="version" className="min-h-0 flex-1 overflow-hidden" />
      <TabsContent value="changes" className="min-h-0 flex-1 overflow-hidden" />
    </Tabs>
  )
}
```
（`useAssistantStore` 已在文件顶部导入。若 `canvasActiveTab` 指向已隐藏的 tab，Radix Tabs 会无选中内容；任务 4 补齐三个 tab 后即完整。为稳妥，`setCanvasActiveTab` 仅由按钮触发有效 tab。）

- [ ] **步骤 6：验证**

运行：
```bash
pnpm exec eslint src/lib/ai/tools/resume.ts src/pages/assistant/hooks/use-canvas-preview.ts src/pages/assistant/components/assistant-canvas
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。桌面画布「简历预览」tab 显示当前编辑简历，下拉可切换。

---

## 任务 4：看板快照 tab + 版本时间线 tab + 变更记录 tab

**文件：**
- 创建：`src/components/ui/table.tsx`（shadcn CLI）
- 创建：`src/pages/assistant/components/assistant-canvas/board-snapshot/index.tsx`
- 创建：`src/pages/assistant/components/assistant-canvas/version-timeline/index.tsx`
- 创建：`src/pages/assistant/components/assistant-canvas/change-log/index.tsx`
- 修改：`src/pages/assistant/components/assistant-canvas/index.tsx`

- [ ] **步骤 1：引入 shadcn table 组件（不自造）**

运行：
```bash
pnpm dlx shadcn@latest add table
```
预期：生成 `src/components/ui/table.tsx`（导出 `Table/TableHeader/TableBody/TableRow/TableHead/TableCell`）。若 CLI 交互失败，从 shadcn 文档取同款源码手动落到该路径。

- [ ] **步骤 2：看板快照 tab**

创建 `src/pages/assistant/components/assistant-canvas/board-snapshot/index.tsx`：
```tsx
import { useEffect, useState } from 'react'
import type { JobApplication } from '@/pages/tracker/types'
import { getCompanies } from '@/lib/supabase/resume'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CanvasModel } from '../../../types'

const STATUS_LABELS: Record<string, string> = {
  saved: '已保存', applied: '已投递', screen: '筛选中', interview: '面试中', offer: '已录用', rejected: '已终止',
}

export default function BoardSnapshot({ model }: { model: CanvasModel }) {
  const [jobs, setJobs] = useState<JobApplication[] | null>(null)

  const boardWriteCount = model.writes.filter(w => w.category === 'board').length
  useEffect(() => {
    getCompanies().then(setJobs).catch(() => setJobs([]))
  }, [boardWriteCount])

  const deleted = model.writes.filter(w => w.action === 'delete' && w.targetTab === 'board')

  if (!jobs)
    return <div className="p-3"><Skeleton className="h-64 w-full" /></div>

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="p-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>公司</TableHead>
              <TableHead>岗位</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map(job => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.company}</TableCell>
                <TableCell>{job.position}</TableCell>
                <TableCell><Badge variant="secondary">{STATUS_LABELS[job.status] ?? job.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {deleted.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            本轮已删除：{deleted.map(d => d.title).join('；')}
          </p>
        )}
      </div>
    </ScrollArea>
  )
}
```

- [ ] **步骤 3：版本时间线 tab**

创建 `src/pages/assistant/components/assistant-canvas/version-timeline/index.tsx`：
```tsx
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { listResumeHistoryVersions } from '@/lib/supabase/resume'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import useAssistantStore from '../../../store'
import type { CanvasModel } from '../../../types'

export default function VersionTimeline({ model }: { model: CanvasModel }) {
  const previewResumeId = useAssistantStore(s => s.previewResumeId)
  const [versions, setVersions] = useState<Array<Record<string, unknown>> | null>(null)
  const versionWriteCount = model.writes.filter(w => w.category === 'version').length

  useEffect(() => {
    if (!previewResumeId) {
      setVersions([])
      return
    }
    listResumeHistoryVersions(previewResumeId)
      .then(rows => setVersions(rows as unknown as Array<Record<string, unknown>>))
      .catch(() => setVersions([]))
  }, [previewResumeId, versionWriteCount])

  if (!versions)
    return <div className="p-3"><Skeleton className="h-64 w-full" /></div>

  if (versions.length === 0) {
    return (
      <Empty>
        <EmptyHeader><EmptyTitle>暂无历史版本</EmptyTitle></EmptyHeader>
      </Empty>
    )
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <ol className="flex flex-col gap-2 p-3">
        {versions.map(v => (
          <li key={String(v.id)} className="rounded-lg border bg-background p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">V{String(v.version_no)}</span>
              <span className="text-xs text-muted-foreground">{dayjs(String(v.created_at)).format('MM-DD HH:mm')}</span>
            </div>
            {v.milestone_name ? <p className="text-xs text-muted-foreground">{String(v.milestone_name)}</p> : null}
          </li>
        ))}
      </ol>
    </ScrollArea>
  )
}
```

- [ ] **步骤 4：变更记录 tab**

创建 `src/pages/assistant/components/assistant-canvas/change-log/index.tsx`：
```tsx
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ResumeFieldDiff } from '../../confirm-card/resume-field-diff'
import type { CanvasChange, CanvasModel } from '../../../types'

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
              <span className="min-w-0 flex-1 truncate font-medium">{change.title}</span>
              <StateBadge state={change.state} />
            </CollapsibleTrigger>
            {change.detail && (
              <CollapsibleContent className="border-t p-2.5 text-xs">
                {change.detail.kind === 'diff'
                  ? <ResumeFieldDiff before={change.detail.before} after={change.detail.after} />
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

- [ ] **步骤 5：画布壳填充三个 tab 内容**

改 `src/pages/assistant/components/assistant-canvas/index.tsx` 的 `CanvasInner`，为三个 `TabsContent` 填入组件（传 `model`）：
```tsx
import BoardSnapshot from './board-snapshot'
import ChangeLog from './change-log'
import VersionTimeline from './version-timeline'
```
```tsx
      <TabsContent value="board" className="min-h-0 flex-1 overflow-hidden">
        {model.touchedBoard && <BoardSnapshot model={model} />}
      </TabsContent>
      <TabsContent value="version" className="min-h-0 flex-1 overflow-hidden">
        {model.touchedVersion && <VersionTimeline model={model} />}
      </TabsContent>
      <TabsContent value="changes" className="min-h-0 flex-1 overflow-hidden">
        {model.hasWrites && <ChangeLog model={model} />}
      </TabsContent>
```

- [ ] **步骤 6：验证**

运行：
```bash
pnpm exec eslint src/pages/assistant/components/assistant-canvas src/components/ui/table.tsx
pnpm exec tsc --noEmit
git diff --check
```
预期：全绿。AI 动看板/版本后对应 tab 出现并展示数据；变更记录汇总写操作、可展开 diff/摘要。

---

## 任务 5：全量验证与人工验收

**文件：** 仅验证，不改代码（如发现缺陷回到对应任务修复）。

- [ ] **步骤 1：全量静态检查 + 构建**

运行：
```bash
pnpm exec eslint --no-warn-ignored \
  src/pages/assistant \
  src/lib/ai/tools/resume.ts \
  src/components/ui/table.tsx
pnpm exec tsc --noEmit
pnpm build
git diff --check
```
预期：eslint 0 error；tsc 0 error；build 显示 `✓ built`（仅既有 chunk-size 警告允许）；diff-check 无输出。

- [ ] **步骤 2：桌面人工验收清单**

在 `pnpm dev` 下逐项确认：
- 三栏布局；画布可折叠、刷新后保持折叠状态；Chat Header 按钮可开合。
- 简历预览默认显示当前编辑简历；下拉切换任意简历生效。
- AI `open_resume`/`create_resume` 后预览联动切换到该简历。
- AI 改简历字段并确认后：进入编辑器该字段已变（落库生效），画布预览刷新出新内容。
- AI 动看板 → 「求职看板」tab 出现，表格展示实时职位；删除的职位在"本轮已删除"列出。
- AI 动版本 → 「历史版本」tab 出现，时间线展示；变更记录 tab 汇总全部写操作，可展开。
- 对话内每组工具调用出现「在画布中查看」，点击联动到正确 tab。

- [ ] **步骤 3：窄屏与回归验收**

- 窄屏画布为全屏 Sheet，由 Chat Header 唤起，无 ARIA 告警。
- 切换会话/新建对话/返回工作台：画布随消息重建，无残留；进行中 run 正确中止。
- 读操作不弹确认；写操作走确认卡；取消的写操作在变更记录标注"已取消"。

- [ ] **步骤 4：完成报告**

汇总：改动文件清单、各验证命令结果、人工验收结论；明确未 commit/未 push；`update_current_resume_field` 落库路径已修正。

---

## 规格覆盖自检

| 规格要求 | 对应任务 |
| --- | --- |
| 三栏布局 + 桌面可折叠 + 折叠持久化 | 任务 1 |
| 窄屏全屏 Sheet + Chat Header 按钮 | 任务 1 |
| Store 画布状态（open/mobile/activeTab/previewResumeId） | 任务 1 |
| `deriveCanvasModel` 会话级推导（不新表） | 任务 2 |
| 内联条目升级 + 「在画布中查看」联动 | 任务 2 |
| 📄 简历预览：按 id 从持久化拉取、下拉、联动、刷新 | 任务 3 |
| 写入路径修正 `updateResumeConfig` 落库 | 任务 3 |
| 📊 看板 / 🕑 版本 / 🧾 变更记录 tab | 任务 4 |
| tab 按需显隐（touchedBoard/Version/hasWrites） | 任务 3、4 |
| UI 组件复用（Tabs/Select/Card/Badge/Collapsible/ScrollArea/Sheet/Empty/Skeleton/Table） | 任务 1-4 |
| 看板表格用 shadcn table（不自造） | 任务 4 |
| 错误/空态/加载/reduced-motion | 任务 3、4 |
| 全量验证 + 桌面/窄屏/回归验收 | 任务 5 |
| 不新增测试、不提交、不改无关页面 | 全计划覆盖规则 |
