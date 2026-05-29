# AI Rewrite 组合式重构实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 将 `src/components/ai-rewrite` 重构为职责清晰的组合式组件，同时补齐显式 `waiting_jd` 状态、移动端弹层体验和基础可访问性。

**架构：** `AiRewriteBubble` 保留为顶层编排层，负责 editor、selection、session 和 apply；请求生命周期留在 `useAiRewrite`；弹层、状态视图、候选列表、动作按钮拆成纯展示组件。`align_jd` 待填写 JD 从隐式 `success + []` 改为显式 `waiting_jd` 状态。

**技术栈：** React 19、TypeScript 5.9、Tiptap BubbleMenu、shadcn/ui、lucide-react、Node 24 内置 test runner、项目本地 `tsc`/`eslint`。

---

关联设计文档：`docs/superpowers/specs/2026-05-30-ai-rewrite-composition-design.md`

## 执行约束

- 当前工作区已有与本任务无关的修改和暂存文件；执行时不得 `git reset`、`git checkout --` 或还原未确认的用户改动。
- 每个提交必须使用路径限定，例如 `git commit --only <paths> -m "..."`，避免包含其他 staged 文件。
- 当前环境没有 `npm`/`npx` 命令；验证优先使用项目本地二进制：`./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src/components/ai-rewrite`。
- 若执行者环境存在 `npx`，仍需先尝试仓库要求的 `npx tsc --noEmit`，并把真实结果记录到本计划。
- 不引入 Vitest/Jest；状态机测试使用 Node 24 内置 test runner：`node --test src/components/ai-rewrite/rewrite-session-state.test.ts`。

## 文件职责图

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/components/ai-rewrite/types.ts` | 修改 | 增加 `waiting_jd` 状态类型，补充 UI 组件 props 需要的类型 |
| `src/components/ai-rewrite/rewrite-session-state.ts` | 新建 | 纯状态转移 helper 与 `canRetry` 派生逻辑 |
| `src/components/ai-rewrite/rewrite-session-state.test.ts` | 新建 | Node 内置 runner 覆盖状态转移 |
| `src/components/ai-rewrite/use-rewrite-session.ts` | 修改 | 使用纯 helper 管理 React state |
| `src/components/ai-rewrite/use-ai-rewrite.ts` | 修改 | 暴露 `waitForJd`，保留请求/取消/重试职责 |
| `src/components/ai-rewrite/use-rewrite-selection.ts` | 新建 | 读取并序列化 Tiptap 选区 |
| `src/components/ai-rewrite/rewrite-bubble-menu.tsx` | 新建 | 渲染 action 按钮组 |
| `src/components/ai-rewrite/rewrite-dialog-shell.tsx` | 新建 | 响应式弹层 shell，固定 header/footer |
| `src/components/ai-rewrite/rewrite-panel-footer.tsx` | 新建 | 重试 footer 操作区 |
| `src/components/ai-rewrite/rewrite-status-view.tsx` | 新建 | loading / waiting / error / empty 状态视图 |
| `src/components/ai-rewrite/rewrite-candidate-list.tsx` | 新建 | 候选列表响应式布局 |
| `src/components/ai-rewrite/ai-rewrite-panel.tsx` | 修改 | 变为组合容器，只拼装 JD、状态、候选列表 |
| `src/components/ai-rewrite/ai-rewrite-bubble.tsx` | 修改 | 只保留顶层编排与 editor 写回 |
| `src/components/ai-rewrite/candidate-card.tsx` | 修改 | 小幅可访问性和样式整理 |
| `src/components/ai-rewrite/jd-context-input.tsx` | 修改 | 小幅可访问性和状态文案整理 |
| `src/components/ai-rewrite/index.ts` | 修改 | 如有必要导出新增类型；不暴露内部 UI 组件 |

## 任务 1：显式状态机与状态测试

**文件：**
- 修改：`src/components/ai-rewrite/types.ts`
- 新建：`src/components/ai-rewrite/rewrite-session-state.ts`
- 新建：`src/components/ai-rewrite/rewrite-session-state.test.ts`
- 修改：`src/components/ai-rewrite/use-rewrite-session.ts`

- [x] **步骤 1：先写失败测试**

新建 `src/components/ai-rewrite/rewrite-session-state.test.ts`：

```ts
/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  failRewriteSession,
  getRewriteCanRetry,
  INITIAL_REWRITE_SESSION_STATE,
  setRewriteJdDraft,
  startRewriteStreaming,
  succeedRewriteSession,
  waitForRewriteJd,
} from './rewrite-session-state.ts'

const candidate = {
  id: 'candidate-1',
  title: '结果版本',
  html: '<p>改写结果</p>',
}

describe('rewrite session state', () => {
  it('会用 waiting_jd 明确表示 JD 待填写状态', () => {
    const state = waitForRewriteJd(INITIAL_REWRITE_SESSION_STATE)

    assert.equal(state.status, 'waiting_jd')
    assert.equal(state.action, 'align_jd')
    assert.deepEqual(state.candidates, [])
    assert.equal(state.errorMessage, null)
  })

  it('会根据 JD 字数判断 align_jd 是否可以重试', () => {
    const waitingState = waitForRewriteJd(INITIAL_REWRITE_SESSION_STATE)

    assert.equal(getRewriteCanRetry(waitingState, 10), false)
    assert.equal(getRewriteCanRetry(setRewriteJdDraft(waitingState, '岗位描述内容已经足够长'), 10), true)
  })

  it('会在 streaming、success、error 之间清理候选和错误', () => {
    const streaming = startRewriteStreaming(INITIAL_REWRITE_SESSION_STATE, 'polish')
    const success = succeedRewriteSession(streaming, [candidate])
    const failed = failRewriteSession(success, 'AI 改写失败')

    assert.equal(streaming.status, 'streaming')
    assert.deepEqual(streaming.candidates, [])
    assert.equal(success.status, 'success')
    assert.deepEqual(success.candidates, [candidate])
    assert.equal(failed.status, 'error')
    assert.deepEqual(failed.candidates, [])
    assert.equal(failed.errorMessage, 'AI 改写失败')
  })
})
```

- [x] **步骤 2：运行测试并确认它失败**

运行：`node --test src/components/ai-rewrite/rewrite-session-state.test.ts`

预期：FAIL，报错包含 `Cannot find module` 或 `does not provide an export`，因为 `rewrite-session-state.ts` 尚未实现。

执行记录：已运行 `node --test src/components/ai-rewrite/rewrite-session-state.test.ts`，结果按预期 FAIL，报错 `ERR_MODULE_NOT_FOUND`，因为 `rewrite-session-state.ts` 尚未实现。

- [x] **步骤 3：更新类型契约**

修改 `src/components/ai-rewrite/types.ts`：

```ts
export type RewriteSessionStatus = 'idle' | 'waiting_jd' | 'streaming' | 'success' | 'error'
```

保留现有 `RewriteSessionState` 字段，不引入全局 store。

- [x] **步骤 4：实现纯状态 helper**

新建 `src/components/ai-rewrite/rewrite-session-state.ts`：

```ts
import type { RewriteAction, RewriteCandidate, RewriteSessionState } from './types'

export const INITIAL_REWRITE_SESSION_STATE: RewriteSessionState = {
  status: 'idle',
  action: null,
  candidates: [],
  errorMessage: null,
  jdDraft: '',
}

export function startRewriteStreaming(state: RewriteSessionState, action: RewriteAction): RewriteSessionState {
  return {
    ...state,
    status: 'streaming',
    action,
    candidates: [],
    errorMessage: null,
  }
}

export function succeedRewriteSession(state: RewriteSessionState, candidates: RewriteCandidate[]): RewriteSessionState {
  return {
    ...state,
    status: 'success',
    candidates,
    errorMessage: null,
  }
}

export function failRewriteSession(state: RewriteSessionState, message: string): RewriteSessionState {
  return {
    ...state,
    status: 'error',
    candidates: [],
    errorMessage: message,
  }
}

export function resetRewriteSession(): RewriteSessionState {
  return INITIAL_REWRITE_SESSION_STATE
}

export function setRewriteJdDraft(state: RewriteSessionState, jdDraft: string): RewriteSessionState {
  return {
    ...state,
    jdDraft,
  }
}

export function waitForRewriteJd(state: RewriteSessionState): RewriteSessionState {
  return {
    ...state,
    status: 'waiting_jd',
    action: 'align_jd',
    candidates: [],
    errorMessage: null,
  }
}

export function getRewriteCanRetry(state: RewriteSessionState, jdMinChars: number): boolean {
  if (!state.action || state.status === 'streaming')
    return false

  return state.action !== 'align_jd' || state.jdDraft.trim().length >= jdMinChars
}
```

- [x] **步骤 5：让 hook 使用状态 helper**

修改 `src/components/ai-rewrite/use-rewrite-session.ts`，用 helper 替换内联 `setState` 逻辑：

```ts
import type { RewriteAction, RewriteCandidate } from './types'
import { useCallback, useState } from 'react'
import {
  failRewriteSession,
  INITIAL_REWRITE_SESSION_STATE,
  resetRewriteSession,
  setRewriteJdDraft,
  startRewriteStreaming,
  succeedRewriteSession,
  waitForRewriteJd,
} from './rewrite-session-state'

export function useRewriteSession() {
  const [state, setState] = useState(INITIAL_REWRITE_SESSION_STATE)

  const startStreaming = useCallback((action: RewriteAction) => {
    setState(prev => startRewriteStreaming(prev, action))
  }, [])

  const succeed = useCallback((candidates: RewriteCandidate[]) => {
    setState(prev => succeedRewriteSession(prev, candidates))
  }, [])

  const fail = useCallback((message: string) => {
    setState(prev => failRewriteSession(prev, message))
  }, [])

  const reset = useCallback(() => {
    setState(resetRewriteSession())
  }, [])

  const setJdDraft = useCallback((jdDraft: string) => {
    setState(prev => setRewriteJdDraft(prev, jdDraft))
  }, [])

  const waitForJd = useCallback(() => {
    setState(prev => waitForRewriteJd(prev))
  }, [])

  return { state, startStreaming, succeed, fail, reset, setJdDraft, waitForJd }
}
```

- [x] **步骤 6：再次运行测试并确认通过**

运行：`node --test src/components/ai-rewrite/rewrite-session-state.test.ts`

预期：PASS，3 个测试通过。

执行记录：已运行 `node --test src/components/ai-rewrite/rewrite-session-state.test.ts`，结果 PASS，1 个 suite、3 个测试全部通过。

- [x] **步骤 7：运行类型检查**

运行：`./node_modules/.bin/tsc --noEmit`

预期：PASS。

执行记录：首次运行 `./node_modules/.bin/tsc --noEmit` 失败，报错 `use-ai-rewrite.ts` 仍引用旧的 `openWaitingJd`。已在 `useRewriteSession` 暂时保留兼容别名，等待任务 6 移除；再次运行同一命令，结果 PASS。

- [x] **步骤 8：提交**

```bash
git add src/components/ai-rewrite/types.ts src/components/ai-rewrite/rewrite-session-state.ts src/components/ai-rewrite/rewrite-session-state.test.ts src/components/ai-rewrite/use-rewrite-session.ts docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only src/components/ai-rewrite/types.ts src/components/ai-rewrite/rewrite-session-state.ts src/components/ai-rewrite/rewrite-session-state.test.ts src/components/ai-rewrite/use-rewrite-session.ts docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "refactor(ai-rewrite): add explicit session state"
```

## 任务 2：抽离 Tiptap 选区读取

**文件：**
- 新建：`src/components/ai-rewrite/use-rewrite-selection.ts`
- 修改：`src/components/ai-rewrite/ai-rewrite-bubble.tsx`

- [x] **步骤 1：创建选区读取 hook**

新建 `src/components/ai-rewrite/use-rewrite-selection.ts`：

```ts
import type { Editor } from '@tiptap/react'
import type { RewriteSelection } from './types'
import { DOMSerializer } from '@tiptap/pm/model'
import { useCallback } from 'react'
import { SELECTION_MIN_CHARS } from './const'

export function useRewriteSelection(editor: Editor) {
  return useCallback((): RewriteSelection | null => {
    const { from, to } = editor.state.selection
    if (from === to)
      return null

    const text = editor.state.doc.textBetween(from, to, '\n').trim()
    if (text.length < SELECTION_MIN_CHARS)
      return null

    const slice = editor.state.doc.slice(from, to)
    const div = document.createElement('div')
    const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content)
    div.appendChild(fragment)

    return { from, to, text, html: div.innerHTML }
  }, [editor])
}
```

- [x] **步骤 2：替换 `ai-rewrite-bubble.tsx` 内联函数**

修改 `src/components/ai-rewrite/ai-rewrite-bubble.tsx`：

- 删除 `DOMSerializer` import。
- 删除 `getSelectionPayload()`。
- 引入 `useRewriteSelection`。
- 在组件中添加 `const readSelection = useRewriteSelection(editor)`。
- `handleAction` 内改为 `const sel = readSelection()`。

- [x] **步骤 3：运行类型检查**

运行：`./node_modules/.bin/tsc --noEmit`

预期：PASS。

执行记录：已运行 `./node_modules/.bin/tsc --noEmit`，结果 PASS。

- [x] **步骤 4：提交**

```bash
git add src/components/ai-rewrite/use-rewrite-selection.ts src/components/ai-rewrite/ai-rewrite-bubble.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only src/components/ai-rewrite/use-rewrite-selection.ts src/components/ai-rewrite/ai-rewrite-bubble.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "refactor(ai-rewrite): extract selection reader"
```

## 任务 3：抽离 BubbleMenu 动作按钮组

**文件：**
- 新建：`src/components/ai-rewrite/rewrite-bubble-menu.tsx`
- 修改：`src/components/ai-rewrite/ai-rewrite-bubble.tsx`

- [x] **步骤 1：创建动作按钮组件**

新建 `src/components/ai-rewrite/rewrite-bubble-menu.tsx`：

```tsx
import type { RewriteAction } from './types'
import { Button } from '@/components/ui/button'
import { REWRITE_ACTION_LIST, REWRITE_ACTION_META } from './const'

interface RewriteBubbleMenuProps {
  onAction: (action: RewriteAction) => void
}

export function RewriteBubbleMenu({ onAction }: RewriteBubbleMenuProps) {
  return (
    <div className="tiptap-toolbar" data-variant="floating">
      {REWRITE_ACTION_LIST.map((action) => {
        const meta = REWRITE_ACTION_META[action]
        const Icon = meta.icon

        return (
          <Button
            key={action}
            type="button"
            size="sm"
            variant="ghost"
            title={meta.description}
            onMouseDown={event => event.preventDefault()}
            onClick={() => onAction(action)}
            className="h-8 gap-1"
          >
            <Icon className="size-4" />
            <span className="text-xs">{meta.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
```

- [x] **步骤 2：在顶层组件中使用动作按钮组件**

修改 `src/components/ai-rewrite/ai-rewrite-bubble.tsx`：

- 删除 `Button` import。
- 删除 `REWRITE_ACTION_LIST` import。
- 引入 `RewriteBubbleMenu`。
- portal 内容替换为 `<RewriteBubbleMenu onAction={handleAction} />`。

- [x] **步骤 3：运行类型检查**

运行：`./node_modules/.bin/tsc --noEmit`

预期：PASS。

执行记录：已运行 `./node_modules/.bin/tsc --noEmit`，结果 PASS。

- [x] **步骤 4：提交**

```bash
git add src/components/ai-rewrite/rewrite-bubble-menu.tsx src/components/ai-rewrite/ai-rewrite-bubble.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only src/components/ai-rewrite/rewrite-bubble-menu.tsx src/components/ai-rewrite/ai-rewrite-bubble.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "refactor(ai-rewrite): extract bubble actions"
```

## 任务 4：抽离响应式弹层 shell 与 footer

**文件：**
- 新建：`src/components/ai-rewrite/rewrite-dialog-shell.tsx`
- 新建：`src/components/ai-rewrite/rewrite-panel-footer.tsx`
- 修改：`src/components/ai-rewrite/ai-rewrite-bubble.tsx`

- [x] **步骤 1：创建 Dialog shell**

新建 `src/components/ai-rewrite/rewrite-dialog-shell.tsx`：

```tsx
import type { ComponentType, ReactNode } from 'react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'

interface RewriteDialogShellProps {
  children: ReactNode
  description?: string
  footer: ReactNode
  icon?: ComponentType<{ className?: string }>
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function RewriteDialogShell({
  children,
  description,
  footer,
  icon: Icon,
  onOpenChange,
  open,
  title,
}: RewriteDialogShellProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:h-[85vh] sm:max-h-[85vh] sm:max-w-3xl">
        <ResponsiveDialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <ResponsiveDialogTitle className="flex items-center gap-2 text-base">
            {Icon ? <Icon className="size-4" /> : null}
            {title}
          </ResponsiveDialogTitle>
          {description && (
            <ResponsiveDialogDescription>
              {description}
            </ResponsiveDialogDescription>
          )}
        </ResponsiveDialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>

        {footer}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
```

- [x] **步骤 2：创建 footer 组件**

新建 `src/components/ai-rewrite/rewrite-panel-footer.tsx`：

```tsx
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveDialogFooter } from '@/components/ui/responsive-dialog'

interface RewritePanelFooterProps {
  canRetry: boolean
  isStreaming: boolean
  onRetry: () => void
}

export function RewritePanelFooter({ canRetry, isStreaming, onRetry }: RewritePanelFooterProps) {
  return (
    <ResponsiveDialogFooter className="shrink-0 gap-2 border-t bg-muted/30 px-6 py-3 sm:justify-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canRetry || isStreaming}
        onClick={onRetry}
      >
        <RotateCw className="size-4" />
        重新生成
      </Button>
    </ResponsiveDialogFooter>
  )
}
```

- [x] **步骤 3：在 `ai-rewrite-bubble.tsx` 中接入 shell**

修改 `src/components/ai-rewrite/ai-rewrite-bubble.tsx`：

- 删除 `ResponsiveDialog*` imports。
- 引入 `getRewriteCanRetry`、`RewriteDialogShell`、`RewritePanelFooter`。
- 派生：

```ts
const title = meta ? `${meta.label}候选` : 'AI 改写候选'
const description = meta ? `${meta.description}；选择满意的版本点击「应用」即可替换原文。` : undefined
const canRetry = getRewriteCanRetry(state, JD_MIN_CHARS)
```

- 用 `RewriteDialogShell` 包裹 `AiRewritePanel`。
- footer 传入 `<RewritePanelFooter canRetry={canRetry} isStreaming={state.status === 'streaming'} onRetry={handleRetry} />`。

- [x] **步骤 4：运行类型检查**

运行：`./node_modules/.bin/tsc --noEmit`

预期：PASS。

执行记录：已运行 `./node_modules/.bin/tsc --noEmit`，结果 PASS。

- [x] **步骤 5：提交**

```bash
git add src/components/ai-rewrite/rewrite-dialog-shell.tsx src/components/ai-rewrite/rewrite-panel-footer.tsx src/components/ai-rewrite/ai-rewrite-bubble.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only src/components/ai-rewrite/rewrite-dialog-shell.tsx src/components/ai-rewrite/rewrite-panel-footer.tsx src/components/ai-rewrite/ai-rewrite-bubble.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "refactor(ai-rewrite): extract rewrite dialog shell"
```

## 任务 5：拆分状态视图和候选列表

**文件：**
- 新建：`src/components/ai-rewrite/rewrite-status-view.tsx`
- 新建：`src/components/ai-rewrite/rewrite-candidate-list.tsx`
- 修改：`src/components/ai-rewrite/ai-rewrite-panel.tsx`
- 修改：`src/components/ai-rewrite/candidate-card.tsx`
- 修改：`src/components/ai-rewrite/jd-context-input.tsx`

- [x] **步骤 1：创建状态视图组件**

新建 `src/components/ai-rewrite/rewrite-status-view.tsx`：

```tsx
import type { RewriteSessionState } from './types'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface RewriteStatusViewProps {
  state: RewriteSessionState
}

export function RewriteStatusView({ state }: RewriteStatusViewProps) {
  if (state.status === 'streaming') {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>AI 正在生成候选，请稍候...</span>
      </div>
    )
  }

  if (state.status === 'waiting_jd') {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>请先填写岗位描述（JD），然后点击「重新生成」</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>AI 改写失败</AlertTitle>
        {state.errorMessage && (
          <AlertDescription>{state.errorMessage}</AlertDescription>
        )}
      </Alert>
    )
  }

  if (state.status === 'success' && state.candidates.length === 0) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>AI 未生成有效候选，请重新生成</span>
      </div>
    )
  }

  return null
}
```

- [x] **步骤 2：创建候选列表组件**

新建 `src/components/ai-rewrite/rewrite-candidate-list.tsx`：

```tsx
import type { RewriteCandidate } from './types'
import { CandidateCard } from './candidate-card'

interface RewriteCandidateListProps {
  candidates: RewriteCandidate[]
  onApply: (candidate: RewriteCandidate) => void
}

export function RewriteCandidateList({ candidates, onApply }: RewriteCandidateListProps) {
  if (candidates.length === 0)
    return null

  return (
    <div className="grid items-start gap-4 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
      {candidates.map(candidate => (
        <CandidateCard key={candidate.id} candidate={candidate} onApply={onApply} />
      ))}
    </div>
  )
}
```

- [x] **步骤 3：简化 `AiRewritePanel`**

修改 `src/components/ai-rewrite/ai-rewrite-panel.tsx`：

- 删除 `ResponsiveDialogFooter`、`Button`、`RotateCw`、`Alert*`、`Loader2`、`Sparkles` imports。
- 删除 footer 渲染。
- 使用 `RewriteStatusView` 和 `RewriteCandidateList`。
- 保留 `selection` guard，避免 selection 丢失时展示无效内容。

目标结构：

```tsx
return (
  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
    {isAlignJd && (
      <JdContextInput value={state.jdDraft} onChange={onJdDraftChange} />
    )}

    <RewriteStatusView state={state} />
    <RewriteCandidateList candidates={state.candidates} onApply={onApply} />
  </div>
)
```

- [x] **步骤 4：整理候选卡和 JD 输入可访问性**

修改 `src/components/ai-rewrite/candidate-card.tsx`：

- 给应用按钮增加 `aria-label={`应用 ${candidate.title}`}`。
- 保持 card 不嵌套其他 card，不引入新状态。

修改 `src/components/ai-rewrite/jd-context-input.tsx`：

- 给 `Textarea` 增加 `aria-invalid={!valid}`。
- 计数文本保留，避免新增说明性大段文案。

- [x] **步骤 5：运行类型检查**

运行：`./node_modules/.bin/tsc --noEmit`

预期：PASS。

执行记录：已运行 `./node_modules/.bin/tsc --noEmit`，结果 PASS。

- [x] **步骤 6：提交**

```bash
git add src/components/ai-rewrite/rewrite-status-view.tsx src/components/ai-rewrite/rewrite-candidate-list.tsx src/components/ai-rewrite/ai-rewrite-panel.tsx src/components/ai-rewrite/candidate-card.tsx src/components/ai-rewrite/jd-context-input.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only src/components/ai-rewrite/rewrite-status-view.tsx src/components/ai-rewrite/rewrite-candidate-list.tsx src/components/ai-rewrite/ai-rewrite-panel.tsx src/components/ai-rewrite/candidate-card.tsx src/components/ai-rewrite/jd-context-input.tsx docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "refactor(ai-rewrite): split panel presentation"
```

## 任务 6：串联显式 JD 等待流程

**文件：**
- 修改：`src/components/ai-rewrite/use-ai-rewrite.ts`
- 修改：`src/components/ai-rewrite/ai-rewrite-bubble.tsx`
- 修改：`src/components/ai-rewrite/rewrite-session-state.test.ts`

- [x] **步骤 1：补充重试行为测试**

在 `src/components/ai-rewrite/rewrite-session-state.test.ts` 增加：

```ts
it('streaming 时不会允许重复重试', () => {
  const streaming = startRewriteStreaming(INITIAL_REWRITE_SESSION_STATE, 'polish')

  assert.equal(getRewriteCanRetry(streaming, 10), false)
})
```

- [x] **步骤 2：运行测试并确认当前行为**

运行：`node --test src/components/ai-rewrite/rewrite-session-state.test.ts`

预期：PASS；如果失败，先修状态 helper，不能继续 UI 串联。

执行记录：已运行 `node --test src/components/ai-rewrite/rewrite-session-state.test.ts`，结果 PASS，1 个 suite、4 个测试全部通过。

- [x] **步骤 3：更新 `useAiRewrite` 命名与返回值**

修改 `src/components/ai-rewrite/use-ai-rewrite.ts`：

- 将 `openWaitingJd` 改为 `waitForJd`。
- 内部调用 `session.waitForJd()`。
- 返回对象暴露 `waitForJd`。
- 保持 `run`、`retry`、`cancel` 职责不变。

示例：

```ts
const waitForJd = useCallback(() => {
  cancel()
  session.waitForJd()
}, [cancel, session])
```

- [x] **步骤 4：更新 `AiRewriteBubble` 调用点**

修改 `src/components/ai-rewrite/ai-rewrite-bubble.tsx`：

- 解构 `waitForJd`。
- `align_jd` 且 JD 不足时调用 `waitForJd()`。
- `handleAction` 依赖列表移除旧 `openWaitingJd`。
- `activeSelection` 继续在非 idle 时使用 `savedSelection`。

- [x] **步骤 5：运行测试和类型检查**

运行：

```bash
node --test src/components/ai-rewrite/rewrite-session-state.test.ts
./node_modules/.bin/tsc --noEmit
```

预期：两条命令均 PASS。

执行记录：已运行 `node --test src/components/ai-rewrite/rewrite-session-state.test.ts && ./node_modules/.bin/tsc --noEmit`，结果 PASS，Node 测试 1 个 suite、4 个测试通过，类型检查通过。

- [x] **步骤 6：提交**

```bash
git add src/components/ai-rewrite/use-ai-rewrite.ts src/components/ai-rewrite/ai-rewrite-bubble.tsx src/components/ai-rewrite/rewrite-session-state.test.ts docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only src/components/ai-rewrite/use-ai-rewrite.ts src/components/ai-rewrite/ai-rewrite-bubble.tsx src/components/ai-rewrite/rewrite-session-state.test.ts docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "refactor(ai-rewrite): wire waiting jd flow"
```

## 任务 7：最终整理与验证

**文件：**
- 修改：`src/components/ai-rewrite/index.ts`（如需要）
- 修改：`src/components/ai-rewrite/ai-rewrite.scss`（仅当注释已过期）
- 修改：`docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md`

- [x] **步骤 1：清理导出和过期注释**

检查：

- `src/components/ai-rewrite/index.ts` 仍只导出 `AiRewriteBubble` 与 public types。
- 内部 UI 组件不从 barrel 导出，避免扩大公共 API。
- `src/components/ai-rewrite/ai-rewrite.scss` 注释仍准确；若提到已不存在的结构，更新注释但不新增复杂样式。

- [x] **步骤 2：运行完整静态验证**

先尝试仓库要求命令：

```bash
npx tsc --noEmit
```

若当前环境仍无 `npx`，记录失败原因后运行等价命令：

```bash
./node_modules/.bin/tsc --noEmit
```

然后运行：

```bash
node --test src/components/ai-rewrite/rewrite-session-state.test.ts
./node_modules/.bin/eslint src/components/ai-rewrite
```

预期：测试、类型检查、lint 均通过；如果 lint 因既有全仓配置报错，记录具体文件和错误，不得笼统写“lint 有问题”。

执行记录：`npx tsc --noEmit` 无法启动，当前环境报错 `zsh:1: command not found: npx`。随后运行 `./node_modules/.bin/tsc --noEmit && node --test src/components/ai-rewrite/rewrite-session-state.test.ts && ./node_modules/.bin/eslint src/components/ai-rewrite`，首次 lint 失败于 `rewrite-session-state.test.ts` 的 `test/no-import-node-test`；因本仓库当前无 Vitest/Jest 可执行文件，已对该测试文件添加单条规则禁用。再次运行同一命令，结果 PASS；Node 测试 1 个 suite、4 个测试通过，类型检查和 lint 通过。

- [ ] **步骤 3：启动本地页面做桌面端手动验证**

运行：

```bash
./node_modules/.bin/vite --host 127.0.0.1
```

打开 Vite 输出的本地 URL，验证：

- 在简历编辑富文本字段选中文字，BubbleMenu 出现。
- 点击「润色」或其他非 JD action 后弹层打开，loading/status 区域和 footer 布局正确。
- 成功候选可点击应用；应用后弹层关闭，原文被替换。
- 点击关闭时不会保留旧候选。

执行记录：首次运行 `./node_modules/.bin/vite --host 127.0.0.1` 失败，Rollup native optional package 报 macOS code-signature mismatch。改用 `/Users/shemingcong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/vite/bin/vite.js --host 127.0.0.1` 后成功启动，Vite 输出 `http://127.0.0.1:5174/`，并用 `curl -I http://127.0.0.1:5174/` 确认 HTTP 200。交互式桌面验证未完成：本会话 Browser 工具未暴露，`playwright`/`puppeteer` 不可导入，Computer Use `list_apps` 调用超时。

- [ ] **步骤 4：做移动端手动验证**

用浏览器移动端 viewport 验证：

- 弹层使用 Drawer。
- header/footer 固定，内容区独立滚动。
- 候选卡纵向堆叠，按钮文本不溢出。
- `align_jd` JD 不足时进入等待状态，输入达到 10 字后可重新生成。

执行记录：未完成。原因同桌面端：缺少可用浏览器自动化工具，无法进行移动 viewport 交互验证；已完成静态类型、单元状态测试、lint 和 Vite HTTP 200 验证。

- [x] **步骤 5：检查最终 diff**

运行：

```bash
git diff -- src/components/ai-rewrite docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git status --short
```

确认：

- `ai-rewrite-bubble.tsx` 只保留编排职责。
- `ai-rewrite-panel.tsx` 只保留组合职责。
- 未关联文件仍不被改动或提交。

执行记录：已运行 `git diff -- src/components/ai-rewrite docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md` 和 `git status --short`。最终相关 diff 仅剩 `src/components/ai-rewrite/index.ts` 的 type barrel、`rewrite-session-state.test.ts` 的 lint 规则禁用、以及本计划执行记录；其他显示的 `src/pages/...` 和 `src/utils/error.ts` 为既有未提交改动，不属于本任务提交范围。

- [x] **步骤 6：最终提交**

如果任务 7 有文件改动：

```bash
git add src/components/ai-rewrite/index.ts src/components/ai-rewrite/ai-rewrite.scss docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only src/components/ai-rewrite/index.ts src/components/ai-rewrite/ai-rewrite.scss docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "chore(ai-rewrite): finish composition cleanup"
```

如果任务 7 没有代码改动，只更新了计划执行记录：

```bash
git add docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md
git commit --only docs/superpowers/plans/2026-05-30-ai-rewrite-composition.md -m "docs(ai-rewrite): record composition verification"
```

## 完成标准

- [x] `RewriteSessionStatus` 包含显式 `waiting_jd`。
- [x] `useRewriteSession` 使用纯状态 helper，Node 内置 test runner 覆盖核心状态转移。
- [x] `useRewriteSelection` 独立负责 Tiptap 选区读取和 HTML 序列化。
- [x] `RewriteBubbleMenu` 独立负责动作按钮组。
- [x] `RewriteDialogShell` 和 `RewritePanelFooter` 独立负责弹层外壳与全局操作区。
- [x] `RewriteStatusView` 和 `RewriteCandidateList` 独立负责状态与候选展示。
- [x] `AiRewriteBubble` 不直接渲染候选卡和状态块。
- [x] `AiRewritePanel` 不直接渲染 footer，不包含复杂状态 UI。
- [x] `npx tsc --noEmit` 或已记录的本地等价 `./node_modules/.bin/tsc --noEmit` 通过。
- [ ] 桌面端和移动端手动验证结果已记录在本计划。执行记录：浏览器交互验证受当前工具环境限制未完成；Vite 服务已启动并通过 HTTP 200 检查。
