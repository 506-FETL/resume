# AI 助手 · S2 对话页面骨架 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 交付一个「能看、能聊、能存」的纯流式对话页 `/assistant`——会话列表 + 消息流 + Composer（GAIA UI），接 S1 数据层做真流式对话与持久化。不含 agent loop / 工具 / 图片。

**架构：** 新增 `src/pages/assistant/` 页面模块（history-style），页面级 Zustand store 持有会话/消息/流式状态；`use-chat-stream` hook 编排"发送→callLLM(stream)→增量渲染→S1 落库"；UI 用 GAIA registry（Composer / MessageBubble / WaveSpinner）落地，Hugeicons→lucide。保留 dashboard 外壳（决策 A），页面内部再分会话列表侧栏 + 对话区。

**技术栈：** React 19 · TypeScript · Zustand · motion/react · GAIA UI（shadcn registry）· 复用 `src/lib/llm/call.ts` + `src/lib/supabase/ai`（S1）

**验证约定：** 本仓库不写测试。门槛 = `pnpm lint` + `pnpm build` + 手动清单。按用户偏好，实现期间**不 commit**。依赖 S1 已交付（类型/数据访问层/llm-proxy 流式，均已验证）。规格：`docs/superpowers/specs/2026-08-04-ai-assistant-s2-chat-shell-design.md`。

---

## 文件结构

**修改：**
- `components.json` — `registries` 加 `@gaia`

**新增（GAIA 落地，经 shadcn add 生成后改 lucide）：**
- `src/components/ui/composer.tsx`
- `src/components/ui/message-bubble.tsx`
- `src/components/ui/wave-spinner.tsx`

**新增（页面模块）：**
- `src/pages/assistant/const.ts`
- `src/pages/assistant/types.ts`
- `src/pages/assistant/store.ts`
- `src/pages/assistant/hooks/use-chat-stream.ts`
- `src/pages/assistant/components/conversation-list/index.tsx`
- `src/pages/assistant/components/conversation-list/conversation-item.tsx`
- `src/pages/assistant/components/message-list/index.tsx`
- `src/pages/assistant/components/message-bubble/index.tsx`（气泡壳 + part 分派）
- `src/pages/assistant/components/message-bubble/text-part.tsx`
- `src/pages/assistant/components/composer/index.tsx`
- `src/pages/assistant/components/composer/send-button.tsx`
- `src/pages/assistant/index.tsx`

> 说明：`src/components/ui/message-bubble.tsx` 是 GAIA 原子组件（iMessage 气泡）；`src/pages/assistant/components/message-bubble/` 是页面级封装（用前者作壳 + part 分派），两者不同层，命名不冲突。

---

## 任务 1：接入 GAIA registry 并拉取组件

**文件：**
- 修改：`components.json`
- 创建：`src/components/ui/composer.tsx`、`message-bubble.tsx`、`wave-spinner.tsx`（由 shadcn add 生成）

- [ ] **步骤 1：加 registry**

`components.json` 的 `registries` 增加一项：

```json
  "registries": {
    "@magicui": "https://magicui.design/r/{name}.json",
    "@supabase": "https://supabase.com/ui/r/{name}.json",
    "@animate-ui": "https://animate-ui.com/r/{name}.json",
    "@gaia": "https://ui.heygaia.io/r/{name}.json"
  }
```

- [ ] **步骤 2：拉取三个组件**

运行（网络操作，若沙箱拦截需放行）：

```bash
pnpm dlx shadcn@latest add https://ui.heygaia.io/r/composer.json
pnpm dlx shadcn@latest add https://ui.heygaia.io/r/message-bubble.json
pnpm dlx shadcn@latest add https://ui.heygaia.io/r/wave-spinner.json
```

预期：`src/components/ui/composer.tsx`、`message-bubble.tsx`、`wave-spinner.tsx` 生成；shadcn 自动装依赖。
若某组件拉取失败或引入 Hugeicons 依赖不便，回退：从 GAIA 组件页 "Code" 标签手动复制到对应文件。

- [ ] **步骤 3：Hugeicons → lucide**

检查三个新文件的图标引用：

```bash
grep -rn "hugeicons\|Hugeicons" src/components/ui/composer.tsx src/components/ui/message-bubble.tsx src/components/ui/wave-spinner.tsx
```

将 `@hugeicons/*` 图标替换为 lucide 等价物（如 `AttachmentIcon`→`Paperclip`、`Image01Icon`→`Image`、`SentIcon`/发送→`ArrowUp`/`Send`、`Add01Icon`→`Plus`）。移除 `@hugeicons/*` import。

- [ ] **步骤 4：验证**

运行：`pnpm lint src/components/ui/composer.tsx src/components/ui/message-bubble.tsx src/components/ui/wave-spinner.tsx`
预期：无 error，无残留 hugeicons import。

---

## 任务 2：页面局部类型与常量

**文件：**
- 创建：`src/pages/assistant/types.ts`
- 创建：`src/pages/assistant/const.ts`

- [ ] **步骤 1：types.ts**

```ts
import type { AiConversation, AiMessage } from '@/lib/ai/types'

export type { AiConversation, AiMessage }

// 消息流渲染项：已落库消息 + 可选的"进行中"流式助手气泡
export interface StreamingDraft {
  text: string
}
```

- [ ] **步骤 2：const.ts**

```ts
export const DEFAULT_CONVERSATION_TITLE = '新对话'
export const CONVERSATION_TITLE_MAX_LEN = 24
export const COMPOSER_PLACEHOLDER = '给 AI 助手发消息…'
```

- [ ] **步骤 3：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 3：页面级 Zustand store

**文件：**
- 创建：`src/pages/assistant/store.ts`

- [ ] **步骤 1：写 store**（对齐 `src/pages/optimize/store.ts` 的 `create<T>()` 范式）

```ts
import type { AiConversation, AiMessage } from '@/lib/ai/types'
import { create } from 'zustand'

interface AssistantStore {
  conversations: AiConversation[]
  activeConversationId: string | null
  messages: AiMessage[]
  streaming: boolean
  streamingText: string
  loadingConversations: boolean
  loadingMessages: boolean
  abortController: AbortController | null

  setConversations: (list: AiConversation[]) => void
  upsertConversation: (conv: AiConversation) => void
  removeConversationLocal: (id: string) => void
  setActiveConversationId: (id: string | null) => void
  setMessages: (list: AiMessage[]) => void
  appendMessage: (msg: AiMessage) => void
  setStreaming: (value: boolean) => void
  setStreamingText: (text: string) => void
  setLoadingConversations: (value: boolean) => void
  setLoadingMessages: (value: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  reset: () => void
}

const useAssistantStore = create<AssistantStore>()(set => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  streaming: false,
  streamingText: '',
  loadingConversations: false,
  loadingMessages: false,
  abortController: null,

  setConversations: list => set({ conversations: list }),
  upsertConversation: conv => set((state) => {
    const exists = state.conversations.some(c => c.id === conv.id)
    const conversations = exists
      ? state.conversations.map(c => (c.id === conv.id ? conv : c))
      : [conv, ...state.conversations]
    // 按 updatedAt desc 维持列表顺序
    conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return { conversations }
  }),
  removeConversationLocal: id => set(state => ({
    conversations: state.conversations.filter(c => c.id !== id),
    activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    messages: state.activeConversationId === id ? [] : state.messages,
  })),
  setActiveConversationId: id => set({ activeConversationId: id }),
  setMessages: list => set({ messages: list }),
  appendMessage: msg => set(state => ({ messages: [...state.messages, msg] })),
  setStreaming: value => set({ streaming: value }),
  setStreamingText: text => set({ streamingText: text }),
  setLoadingConversations: value => set({ loadingConversations: value }),
  setLoadingMessages: value => set({ loadingMessages: value }),
  setAbortController: controller => set({ abortController: controller }),
  reset: () => set({ activeConversationId: null, messages: [], streaming: false, streamingText: '' }),
}))

export default useAssistantStore
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 4：流式对话核心 hook

**文件：**
- 创建：`src/pages/assistant/hooks/use-chat-stream.ts`

- [ ] **步骤 1：写 hook**（复用 `callLLM`；DB 走 S1 数据层；SSE 只在此解析）

```ts
import type { AiMessage } from '@/lib/ai/types'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { callLLM } from '@/lib/llm/call'
import {
  createConversation,
  insertMessage,
  renameConversation,
  touchConversation,
} from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import { CONVERSATION_TITLE_MAX_LEN, DEFAULT_CONVERSATION_TITLE } from '../const'
import useAssistantStore from '../store'

// 已落库消息 → DeepSeek messages（S2 纯文本：text part 拼成 content 字符串）
function toApiMessages(messages: AiMessage[]): { role: string, content: string }[] {
  return messages.map(m => ({
    role: m.role,
    content: m.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n'),
  }))
}

export function useChatStream() {
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed)
      return

    const store = useAssistantStore.getState()
    if (store.streaming)
      return

    // 1. 确保有会话
    let conversationId = store.activeConversationId
    let isNewConversation = false
    try {
      if (!conversationId) {
        const conv = await createConversation(DEFAULT_CONVERSATION_TITLE)
        conversationId = conv.id
        isNewConversation = true
        useAssistantStore.getState().upsertConversation(conv)
        useAssistantStore.getState().setActiveConversationId(conv.id)
      }
    }
    catch (error) {
      toast.error('创建会话失败', { description: getErrorMessage(error) })
      return
    }

    // 2. 落库 user 消息（乐观追加 + 落库）
    let userMessage: AiMessage
    try {
      userMessage = await insertMessage(conversationId, {
        role: 'user',
        parts: [{ type: 'text', text: trimmed }],
      })
      useAssistantStore.getState().appendMessage(userMessage)
    }
    catch (error) {
      toast.error('发送失败', { description: getErrorMessage(error) })
      return
    }

    // 3. 起流
    const controller = new AbortController()
    useAssistantStore.setState({ streaming: true, streamingText: '', abortController: controller })

    const apiMessages = toApiMessages(useAssistantStore.getState().messages)

    try {
      const stream = await callLLM(
        // 纯对话：关闭 thinking（V4-pro 默认开），只要 content
        { messages: apiMessages as any, stream: true, thinking: { type: 'disabled' } } as any,
        controller,
      )

      let full = ''
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as { content?: string } | undefined
        const content = typeof delta?.content === 'string' ? delta.content : ''
        if (content) {
          full += content
          useAssistantStore.getState().setStreamingText(full)
        }
      }

      // 4. 落库 assistant 消息
      if (full) {
        const assistantMessage = await insertMessage(conversationId, {
          role: 'assistant',
          parts: [{ type: 'text', text: full }],
        })
        useAssistantStore.getState().appendMessage(assistantMessage)
      }

      // 5. 刷新排序；首条消息生成标题
      await touchConversation(conversationId)
      if (isNewConversation) {
        const title = trimmed.slice(0, CONVERSATION_TITLE_MAX_LEN)
        const updated = await renameConversation(conversationId, title)
        useAssistantStore.getState().upsertConversation(updated)
      }
    }
    catch (error) {
      // abort 不算错误
      if ((error as Error)?.name !== 'AbortError') {
        toast.error('回复失败', { description: getErrorMessage(error) })
      }
      // 进行中的助手回复不落库（streamingText 直接丢弃）
    }
    finally {
      useAssistantStore.setState({ streaming: false, streamingText: '', abortController: null })
    }
  }, [])

  const stopStreaming = useCallback(() => {
    const { abortController } = useAssistantStore.getState()
    abortController?.abort()
  }, [])

  return { sendMessage, stopStreaming }
}
```

> 注：`renameConversation` 是 S1 `updateConversation` 的语义封装——若 S1 未导出该名，改用 `updateConversation(id, { title })`。**落地时对齐 S1 实际导出名。**（S1 导出的是 `updateConversation`；本 hook 用 `updateConversation(conversationId, { title })`，见步骤 2 修正。）

- [ ] **步骤 2：对齐 S1 导出名**

S1 `src/lib/supabase/ai/conversations.ts` 导出的是 `updateConversation`（非 `renameConversation`）。将 hook 中：
- import 改为 `import { createConversation, insertMessage, touchConversation, updateConversation } from '@/lib/supabase/ai'`
- 标题更新处改为 `const updated = await updateConversation(conversationId, { title })`

- [ ] **步骤 3：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep use-chat-stream`
预期：无 error（`as any` 用于桥接 `callLLM` 的 openai 类型与我们的简化 messages；若 tsc 报 `thinking` 不在类型上，`callLLM` 的 `...rest` 已透传，保留 `as any`）。

---

## 任务 5：会话列表（容器 + 单项）

**文件：**
- 创建：`src/pages/assistant/components/conversation-list/conversation-item.tsx`
- 创建：`src/pages/assistant/components/conversation-list/index.tsx`

- [ ] **步骤 1：conversation-item.tsx**（单行：选中/重命名内联/删除确认；仅接自己那条数据 + 专属回调，不下钻全局）

```tsx
import type { AiConversation } from '@/lib/ai/types'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ConversationItemProps {
  conversation: AiConversation
  active: boolean
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function ConversationItem({ conversation, active, onSelect, onRename, onDelete }: ConversationItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const [pendingDelete, setPendingDelete] = useState(false)

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== conversation.title)
      onRename(conversation.id, next)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5">
        <Input
          value={draft}
          autoFocus
          className="h-7 flex-1"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')
              commitRename()
            if (e.key === 'Escape')
              setEditing(false)
          }}
        />
        <Button variant="ghost" size="icon-sm" aria-label="确认" onClick={commitRename}><Check className="size-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="取消" onClick={() => setEditing(false)}><X className="size-3.5" /></Button>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60',
          active && 'bg-muted font-medium',
        )}
        onClick={() => onSelect(conversation.id)}
      >
        <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="重命名"
            onClick={(e) => { e.stopPropagation(); setDraft(conversation.title); setEditing(true) }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="删除"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setPendingDelete(true) }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={pendingDelete} onOpenChange={open => !open && setPendingDelete(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该会话？</AlertDialogTitle>
            <AlertDialogDescription>
              {`「${conversation.title}」及其全部消息将被永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setPendingDelete(false); onDelete(conversation.id) }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **步骤 2：index.tsx**（容器：列表 + 新建 + 空态；从 store 取状态，DB 操作调 S1）

```tsx
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteConversation, listMessages, updateConversation } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../../store'
import { ConversationItem } from './conversation-item'

export default function ConversationList() {
  const conversations = useAssistantStore(s => s.conversations)
  const activeId = useAssistantStore(s => s.activeConversationId)
  const loading = useAssistantStore(s => s.loadingConversations)

  const handleNew = () => {
    // 新会话延迟到首次发送时建库；这里仅清空当前选择进入空态
    useAssistantStore.getState().setActiveConversationId(null)
    useAssistantStore.getState().setMessages([])
  }

  const handleSelect = async (id: string) => {
    if (id === activeId)
      return
    useAssistantStore.getState().setActiveConversationId(id)
    useAssistantStore.getState().setLoadingMessages(true)
    try {
      const msgs = await listMessages(id)
      useAssistantStore.getState().setMessages(msgs)
    }
    catch (error) {
      toast.error('加载消息失败', { description: getErrorMessage(error) })
    }
    finally {
      useAssistantStore.getState().setLoadingMessages(false)
    }
  }

  const handleRename = async (id: string, title: string) => {
    try {
      const updated = await updateConversation(id, { title })
      useAssistantStore.getState().upsertConversation(updated)
    }
    catch (error) {
      toast.error('重命名失败', { description: getErrorMessage(error) })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id)
      useAssistantStore.getState().removeConversationLocal(id)
      toast.success('已删除会话')
    }
    catch (error) {
      toast.error('删除失败', { description: getErrorMessage(error) })
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <Button className="w-full justify-start gap-2" variant="outline" onClick={handleNew}>
        <Plus className="size-4" />
        新对话
      </Button>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {loading
          ? [1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)
          : conversations.length === 0
            ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">还没有对话，点上方开始</p>
            : conversations.map(c => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  onSelect={handleSelect}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 6：消息气泡（页面级壳 + text part 渲染器）

**文件：**
- 创建：`src/pages/assistant/components/message-bubble/text-part.tsx`
- 创建：`src/pages/assistant/components/message-bubble/index.tsx`

- [ ] **步骤 1：text-part.tsx**

```tsx
interface TextPartProps {
  text: string
}

export function TextPart({ text }: TextPartProps) {
  return <span className="whitespace-pre-wrap break-words">{text}</span>
}
```

- [ ] **步骤 2：index.tsx**（用 GAIA `MessageBubble` 作壳，children 按 part.type 分派；S2 只 text）

```tsx
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { MessageBubble as GaiaBubble } from '@/components/ui/message-bubble'
import { TextPart } from './text-part'

interface MessageBubbleProps {
  message: AiMessage
}

function renderPart(part: AiMessagePart, index: number) {
  switch (part.type) {
    case 'text':
      return <TextPart key={index} text={part.text} />
    // reasoning / tool-call / image 渲染器由 S3/S4/S6 追加
    default:
      return null
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const variant = message.role === 'user' ? 'sent' : 'received'
  return (
    <GaiaBubble variant={variant}>
      {message.parts.map(renderPart)}
    </GaiaBubble>
  )
}
```

> 若 GAIA `MessageBubble` 的实际 children 渲染要求纯 `message` prop，落地时改为 `<GaiaBubble variant={variant} message={textOnly} />` 并把非 text part 另行渲染在气泡外——以 add 后的真实组件签名为准（已查证支持 `children`，优先用 children）。

- [ ] **步骤 3：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 7：Composer（输入区 + 发送/停止按钮）

**文件：**
- 创建：`src/pages/assistant/components/composer/send-button.tsx`
- 创建：`src/pages/assistant/components/composer/index.tsx`

- [ ] **步骤 1：send-button.tsx**（streaming 时切停止态）

```tsx
import { ArrowUp, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SendButtonProps {
  streaming: boolean
  disabled: boolean
  onSend: () => void
  onStop: () => void
}

export function SendButton({ streaming, disabled, onSend, onStop }: SendButtonProps) {
  if (streaming) {
    return (
      <Button size="icon" aria-label="停止" onClick={onStop}>
        <Square className="size-4" />
      </Button>
    )
  }
  return (
    <Button size="icon" aria-label="发送" disabled={disabled} onClick={onSend}>
      <ArrowUp className="size-4" />
    </Button>
  )
}
```

- [ ] **步骤 2：index.tsx**（本地受控输入；共享状态从 store 取；发送委托 hook）

```tsx
import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'
import { SendButton } from './send-button'

export default function Composer() {
  const [value, setValue] = useState('')
  const streaming = useAssistantStore(s => s.streaming)
  const { sendMessage, stopStreaming } = useChatStream()

  const submit = () => {
    const text = value.trim()
    if (!text || streaming)
      return
    setValue('')
    void sendMessage(text)
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm">
      <Textarea
        value={value}
        placeholder={COMPOSER_PLACEHOLDER}
        rows={1}
        className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        onChange={e => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <SendButton
        streaming={streaming}
        disabled={!value.trim()}
        onSend={submit}
        onStop={stopStreaming}
      />
    </div>
  )
}
```

> 说明：S2 用 shadcn `Textarea` 手搭 Composer 骨架（轻、可控、贴合 stone 主题），GAIA `Composer` 的富能力（tools/attachments/slash）留给 S4/S6 接线时再切换或增强。若希望本任务直接用 GAIA `Composer`，替换本组件 body 为 `<Composer value={value} onChange={setValue} onSubmit={submit} disabled={streaming} placeholder={COMPOSER_PLACEHOLDER} />`（二选一，落地时按观感定；两者都满足 S2 纯文本需求）。

- [ ] **步骤 3：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 8：消息流

**文件：**
- 创建：`src/pages/assistant/components/message-list/index.tsx`

- [ ] **步骤 1：写消息流**（渲染已落库消息 + 进行中的流式助手气泡 + 自动滚到底）

```tsx
import { MessageBubble as GaiaBubble } from '@/components/ui/message-bubble'
import { WaveSpinner } from '@/components/ui/wave-spinner'
import { useEffect, useRef } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import useAssistantStore from '../../store'
import { MessageBubble } from '../message-bubble'

export default function MessageList() {
  const messages = useAssistantStore(s => s.messages)
  const streaming = useAssistantStore(s => s.streaming)
  const streamingText = useAssistantStore(s => s.streamingText)
  const loading = useAssistantStore(s => s.loadingMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-2/3 rounded-2xl" />)}
      </div>
    )
  }

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">开始一段新对话吧</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map(m => <MessageBubble key={m.id} message={m} />)}
      {streaming && (
        <GaiaBubble variant="received">
          {streamingText
            ? <span className="whitespace-pre-wrap break-words">{streamingText}</span>
            : <WaveSpinner />}
        </GaiaBubble>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 9：页面容器与布局

**文件：**
- 创建：`src/pages/assistant/index.tsx`

- [ ] **步骤 1：写页面容器**（装配布局 + 初始化加载会话；移动端会话列表进 Sheet）

```tsx
import { PanelLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { listConversations } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import ComposerPanel from './components/composer'
import ConversationList from './components/conversation-list'
import MessageList from './components/message-list'
import useAssistantStore from './store'

export default function Assistant() {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      useAssistantStore.getState().setLoadingConversations(true)
      try {
        const list = await listConversations()
        useAssistantStore.getState().setConversations(list)
      }
      catch (error) {
        toast.error('加载会话失败', { description: getErrorMessage(error) })
      }
      finally {
        useAssistantStore.getState().setLoadingConversations(false)
      }
    }
    void load()
  }, [])

  const conversationPanel = <ConversationList />

  return (
    <div className="flex h-full min-h-0 gap-4">
      {!isMobile && (
        <aside className="w-64 shrink-0 border-r pr-4">
          {conversationPanel}
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isMobile && (
          <div className="mb-2">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <PanelLeft className="size-4" />
                  会话
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-4">
                {conversationPanel}
              </SheetContent>
            </Sheet>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card/40">
          <MessageList />
        </div>
        <div className="pt-3">
          <ComposerPanel />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：验证路由生成**

运行：`pnpm build`
预期：构建成功；`/assistant` 路由由 vite-plugin-pages 自动注册（`src/pages/assistant/index.tsx` → `/assistant`）。

---

## 任务 10：最终验证

- [ ] **步骤 1：lint + build**

运行：`pnpm lint && pnpm build`
预期：无新增 error；build 成功。

- [ ] **步骤 2：类型检查**

运行：`pnpm exec tsc --noEmit`
预期：0 错误。

- [ ] **步骤 3：手动清单**（`pnpm dev` 访问 `/assistant`，需已登录）

- [ ] 首次进入：会话列表加载；空态提示
- [ ] 发一条消息：自动建会话 → user 气泡（sent，右）→ 助手逐字流式（received，左）→ 结束落库
- [ ] 会话标题自动取首条消息前 24 字
- [ ] 刷新页面：会话列表 + 当前会话消息完整重现
- [ ] 新建/切换/内联重命名/删除会话（删当前 active 会清空主区）
- [ ] 流式中点"停止"：中断且不落半截；流式中切换会话：旧流 abort、不串台
- [ ] 移动端（窄屏）：会话列表进 Sheet 抽屉，主区全宽
- [ ] 组件粒度自查：无 >150 行巨组件；跨组件状态均走 store，无 ≥2 层 props 下钻

---

## 自检记录

- **规格覆盖度：** GAIA 接入(任务1)、类型/常量(任务2)、store(任务3)、流式 hook(任务4)、会话列表容器+单项(任务5)、气泡壳+part分派(任务6)、Composer+发送/停止(任务7)、消息流(任务8)、页面容器+移动端 Sheet(任务9)、验证(任务10)——规格全部章节均有对应任务。
- **占位符扫描：** 无 TODO/待定；每步含完整代码。GAIA add 为网络操作、有手动复制回退。
- **类型一致性：** 复用 S1 `AiConversation`/`AiMessage`/`AiMessagePart`；数据层调用名与 S1 实际导出对齐（`createConversation`/`insertMessage`/`updateConversation`/`touchConversation`/`listConversations`/`listMessages`/`deleteConversation`）——任务4 步骤2 显式修正 `renameConversation`→`updateConversation`；store action 名前后一致。
- **边界：** hook 管流式编排 + SSE 解析；store 纯状态；DB 在 `src/lib/supabase/ai`；三层不越界。props 仅 `conversation-item` 局部传参，其余走 store selector。
- **已知落地判断点（非缺陷，标注供执行者）：** (a) GAIA `MessageBubble` children vs message prop 以 add 后真实签名为准；(b) Composer 用 shadcn Textarea 手搭 vs 直接用 GAIA Composer 二选一，均满足 S2；(c) `callLLM` 的 `thinking` 透传用 `as any` 桥接 openai 类型。
