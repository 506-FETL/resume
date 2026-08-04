# AI 助手 · S3 Agent 引擎 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 S2 的单轮流式对话升级为前端多步 agent loop——解析 DeepSeek 流式 `tool_calls`、执行工具、回填 `role:tool`、循环到 `finish_reason=stop`。含 2 个内置只读工具用于端到端验证；工具调用过程用 GAIA `Tool Calls Section` 可视化。

**架构：** 新增 `src/lib/ai/agent/`（纯逻辑：registry / stream-parser / to-api-messages / agent-loop）；`use-chat-stream` 改造为起 loop 并把回调事件映射到 store 的结构化进行中态 `streamingParts`；`message-bubble` 新增 reasoning / tool-call part 渲染器（reasoning 复用现有 `@/components/ai/reasoning`，tool-call 用 GAIA `Tool Calls Section`）。

**技术栈：** React 19 · TypeScript · Zustand · DeepSeek V4-pro（FC）· GAIA UI（Tool Calls Section）· 复用 `callLLM` + `src/lib/supabase/ai`（S1）+ `reasoning.tsx`/`Streamdown`

**验证约定：** 本仓库不写测试。门槛 = `pnpm lint` + `pnpm build` + `tsc --noEmit` + 手动清单。GAIA 优先、禁 props 下钻、组件超阈值拆分为硬约束。实现期间**不 commit**（用户偏好）。规格：`docs/superpowers/specs/2026-08-04-ai-assistant-s3-agent-engine-design.md`。

---

## 已查证的接口事实（落地依据）

- **`callLLM(req, abortController)`**（`src/lib/llm/call.ts`）：返回 openai `Stream<ChatCompletionChunk>`，`...rest` 透传（`tools`/`tool_choice`/`thinking` 可传）。
- **流式契约（S1 实测）**：`delta.reasoning_content` 增量 / `delta.content` 增量 / `delta.tool_calls[]`（按 `index` 归并，首片带 `id`+`function.name`，`function.arguments` 分片拼接）；`finish_reason` ∈ `stop|tool_calls`。
- **现有 `reasoning.tsx`**：compound 导出 `Reasoning`（props `isStreaming`/`defaultOpen`）/`ReasoningTrigger`/`ReasoningContent`（`ReasoningContent` 内部用 Streamdown 渲染其 children 文本）。
- **GAIA `Tool Calls Section`**：`ToolCallsSection({ toolCalls: ToolCallEntry[], defaultExpanded?, className? })`；`ToolCallEntry = { tool_name, tool_category, message?, tool_call_id?, inputs?, output?, ... }`。依赖 `icons` / `compact-markdown` / `tool-icons`，内部用 Hugeicons（落地改 lucide）。**它一次渲染一组工具调用** → 我们的 tool-call-part 渲染器把"同一条 assistant 消息里连续的 tool-call parts"聚合成一个 `ToolCallsSection`。
- **S1 数据层**：`insertMessage(conversationId,{role,parts})` / `createConversation` / `updateConversation` / `touchConversation`。
- **S2 store**：已有 `streaming`/`streamingText`/`messages`/`appendMessage`/`replaceMessage`/`removeMessage`/`composerDraft` 等。

---

## 文件结构

**新增（纯逻辑，无 React）：**
- `src/lib/ai/agent/tool-registry.ts` — `AgentTool` 类型 + 注册/查询 + `toApiToolDefs()`
- `src/lib/ai/agent/builtin-tools.ts` — 2 个只读工具（`get_current_time` / `get_resume_summary`）并注册
- `src/lib/ai/agent/stream-parser.ts` — SSE chunk 累积器
- `src/lib/ai/agent/to-api-messages.ts` — `AiMessage[]` → DeepSeek messages（tool_calls / role:tool 回填 + system 头）
- `src/lib/ai/agent/agent-loop.ts` — 多步循环编排（回调驱动）
- `src/lib/ai/agent/index.ts` — barrel

**新增（GAIA 落地）：**
- `src/components/ui/tool-calls-section.tsx` + `compact-markdown.tsx`（`tool-icons.tsx`/`icons.tsx` S2 已装）

**新增（渲染器）：**
- `src/pages/assistant/components/message-bubble/reasoning-part.tsx`
- `src/pages/assistant/components/message-bubble/tool-call-part.tsx`

**修改：**
- `src/pages/assistant/store.ts` — 加 `streamingParts: AiMessagePart[]` 及其 setter
- `src/pages/assistant/hooks/use-chat-stream.ts` — 改造为起 `agent-loop`、映射回调到 store
- `src/pages/assistant/components/message-bubble/index.tsx` — part 分派新增 reasoning/tool-call（含"连续 tool-call 聚合"）
- `src/pages/assistant/components/message-list/index.tsx` — 进行中气泡改渲染 `streamingParts`

---

## 任务 1：工具注册表

**文件：**
- 创建：`src/lib/ai/agent/tool-registry.ts`

- [ ] **步骤 1：写 registry**

```ts
export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema，对齐 DeepSeek tools.function.parameters
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

const registry = new Map<string, AgentTool>()

export function registerTool(tool: AgentTool): void {
  registry.set(tool.name, tool)
}

export function getTool(name: string): AgentTool | undefined {
  return registry.get(name)
}

export function getTools(): AgentTool[] {
  return [...registry.values()]
}

// 导出为 DeepSeek tools 数组格式
export function toApiToolDefs() {
  return getTools().map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint src/lib/ai/agent/tool-registry.ts`
预期：无 error。

---

## 任务 2：内置只读工具

**文件：**
- 创建：`src/lib/ai/agent/builtin-tools.ts`

- [ ] **步骤 1：确认简历读取入口**

运行：`grep -rn "export .*getAllResumesFromUser\|export .*getResumeById\|export .*getDefaultResume" src/lib/supabase/resume`
用途：`get_resume_summary` 复用现有只读函数（不新增查询）。以实际导出名为准接入。

- [ ] **步骤 2：写内置工具并注册**

```ts
import { getAllResumesFromUser } from '@/lib/supabase/resume'
import { registerTool } from './tool-registry'

registerTool({
  name: 'get_current_time',
  description: '获取当前日期和时间（用户本地时区）。当用户询问现在几点、今天日期时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => {
    return { now: new Date().toLocaleString('zh-CN') }
  },
})

registerTool({
  name: 'get_resume_summary',
  description: '获取当前登录用户的简历列表摘要（数量、名称、类型）。当用户询问自己的简历情况时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => {
    try {
      const resumes = (await getAllResumesFromUser()) as Array<{ display_name?: string, type?: string }>
      if (!resumes || resumes.length === 0)
        return { count: 0, message: '用户还没有任何简历' }
      return {
        count: resumes.length,
        resumes: resumes.map(r => ({ name: r.display_name ?? '未命名', type: r.type ?? 'unknown' })),
      }
    }
    catch (error) {
      // 只读失败不 throw 出循环，返回可读错误给模型
      return { error: error instanceof Error ? error.message : '读取简历失败' }
    }
  },
})
```

> 若 `getAllResumesFromUser` 导出名/形状与步骤 1 不符，按实际调整（保持"只读、失败返回 error 对象不 throw"）。

- [ ] **步骤 3：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep builtin-tools`
预期：无 error。

---

## 任务 3：流式解析器

**文件：**
- 创建：`src/lib/ai/agent/stream-parser.ts`

- [ ] **步骤 1：写 parser**

```ts
export interface ParsedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface StreamParserCallbacks {
  onText?: (delta: string, full: string) => void
  onReasoning?: (delta: string, full: string) => void
}

// 累积 DeepSeek SSE：content / reasoning_content / tool_calls（按 index 归并分片）
export class StreamParser {
  private text = ''
  private reasoning = ''
  private toolAcc = new Map<number, { id: string, name: string, argsText: string }>()
  private finishReason: string | null = null

  constructor(private callbacks: StreamParserCallbacks = {}) {}

  push(chunk: any): void {
    const choice = chunk?.choices?.[0]
    if (!choice)
      return
    const delta = choice.delta ?? {}

    if (typeof delta.content === 'string' && delta.content) {
      this.text += delta.content
      this.callbacks.onText?.(delta.content, this.text)
    }
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      this.reasoning += delta.reasoning_content
      this.callbacks.onReasoning?.(delta.reasoning_content, this.reasoning)
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0
        const cur = this.toolAcc.get(idx) ?? { id: '', name: '', argsText: '' }
        if (tc.id)
          cur.id = tc.id
        if (tc.function?.name)
          cur.name = tc.function.name
        if (typeof tc.function?.arguments === 'string')
          cur.argsText += tc.function.arguments
        this.toolAcc.set(idx, cur)
      }
    }
    if (choice.finish_reason)
      this.finishReason = choice.finish_reason
  }

  result(): { text: string, reasoning: string, toolCalls: ParsedToolCall[], finishReason: string | null } {
    const toolCalls: ParsedToolCall[] = [...this.toolAcc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => {
        let args: Record<string, unknown> = {}
        try {
          args = v.argsText ? JSON.parse(v.argsText) : {}
        }
        catch {
          args = {}
        }
        return { id: v.id, name: v.name, args }
      })
    return { text: this.text, reasoning: this.reasoning, toolCalls, finishReason: this.finishReason }
  }
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep stream-parser`
预期：无 error。

---

## 任务 4：messages 转换（tool_calls / role:tool 回填）

**文件：**
- 创建：`src/lib/ai/agent/to-api-messages.ts`

- [ ] **步骤 1：写转换**

```ts
import type { AiMessage } from '@/lib/ai/types'

const SYSTEM_PROMPT = '你是简历与求职助手，可调用工具读取用户数据来更准确地回答。回答用中文，简洁清晰。'

interface ApiMessage {
  role: string
  content: string | null
  tool_calls?: Array<{ id: string, type: 'function', function: { name: string, arguments: string } }>
  tool_call_id?: string
}

// AiMessage[]（parts）→ DeepSeek messages（含 system 头 + tool_calls + role:tool 回填）
export function toApiMessages(messages: AiMessage[]): ApiMessage[] {
  const out: ApiMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  for (const m of messages) {
    const textContent = m.parts
      .filter(p => p.type === 'text')
      .map(p => (p as { text: string }).text)
      .join('\n')

    const toolCallParts = m.parts.filter(p => p.type === 'tool-call') as Array<{
      toolCallId: string
      toolName: string
      args: unknown
      result?: unknown
    }>

    if (m.role === 'assistant' && toolCallParts.length > 0) {
      out.push({
        role: 'assistant',
        content: textContent || null,
        tool_calls: toolCallParts.map(tc => ({
          id: tc.toolCallId,
          type: 'function',
          function: { name: tc.toolName, arguments: JSON.stringify(tc.args ?? {}) },
        })),
      })
      for (const tc of toolCallParts) {
        out.push({
          role: 'tool',
          tool_call_id: tc.toolCallId,
          content: JSON.stringify(tc.result ?? {}),
        })
      }
    }
    else {
      out.push({ role: m.role, content: textContent })
    }
    // reasoning part 不回传模型（仅本地展示）
  }

  return out
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep to-api-messages`
预期：无 error。

---

## 任务 5：agent 多步循环

**文件：**
- 创建：`src/lib/ai/agent/agent-loop.ts`

- [ ] **步骤 1：写 loop**

```ts
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { callLLM } from '@/lib/llm/call'
import { StreamParser } from './stream-parser'
import { toApiMessages } from './to-api-messages'
import { getTool, toApiToolDefs } from './tool-registry'

export interface AgentCallbacks {
  onReasoning?: (full: string) => void
  onText?: (full: string) => void
  onToolCallStart?: (call: { id: string, name: string, args: Record<string, unknown> }) => void
  onToolResult?: (id: string, result: unknown, isError: boolean) => void
}

export interface AgentRunOptions {
  history: AiMessage[] // 含刚追加的用户消息
  signal: AbortSignal
  thinking?: boolean // 默认关
  maxSteps?: number // 默认 8
  callbacks?: AgentCallbacks
}

// 运行多步 agent，返回最终 assistant 消息的 parts（供落库）
export async function runAgent(options: AgentRunOptions): Promise<AiMessagePart[]> {
  const { history, signal, thinking = false, maxSteps = 8, callbacks = {} } = options
  const apiMessages = toApiMessages(history)
  const finalParts: AiMessagePart[] = []

  for (let step = 0; step < maxSteps; step++) {
    if (signal.aborted)
      throw new DOMException('aborted', 'AbortError')

    const parser = new StreamParser({
      onReasoning: (_d, full) => callbacks.onReasoning?.(full),
      onText: (_d, full) => callbacks.onText?.(full),
    })

    const req: Record<string, unknown> = {
      messages: apiMessages,
      stream: true,
      tools: toApiToolDefs(),
      thinking: thinking ? { type: 'enabled' } : { type: 'disabled' },
    }
    const stream = await callLLM(req as any, undefined)

    for await (const chunk of stream) {
      if (signal.aborted)
        throw new DOMException('aborted', 'AbortError')
      parser.push(chunk)
    }

    const { text, reasoning, toolCalls, finishReason } = parser.result()

    if (reasoning)
      finalParts.push({ type: 'reasoning', text: reasoning })

    // 需要调用工具
    if (finishReason === 'tool_calls' && toolCalls.length > 0) {
      // 记录 assistant 的 tool_calls 到 api 上下文
      apiMessages.push({
        role: 'assistant',
        content: text || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      } as any)
      if (text)
        finalParts.push({ type: 'text', text })

      for (const tc of toolCalls) {
        callbacks.onToolCallStart?.(tc)
        const tool = getTool(tc.name)
        let result: unknown
        let isError = false
        if (!tool) {
          result = { error: `工具不存在: ${tc.name}` }
          isError = true
        }
        else {
          try {
            result = await tool.execute(tc.args)
            if (result && typeof result === 'object' && 'error' in (result as any))
              isError = true
          }
          catch (e) {
            result = { error: e instanceof Error ? e.message : '工具执行失败' }
            isError = true
          }
        }
        callbacks.onToolResult?.(tc.id, result, isError)
        finalParts.push({
          type: 'tool-call',
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.args,
          result,
          state: isError ? 'error' : 'result',
        })
        apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) } as any)
      }
      // 继续下一轮
      continue
    }

    // 正常结束
    if (text)
      finalParts.push({ type: 'text', text })
    return finalParts
  }

  // 到达步数上限
  finalParts.push({ type: 'text', text: '（已达到工具调用步数上限，以上为当前进展）' })
  return finalParts
}
```

- [ ] **步骤 2：barrel**

创建 `src/lib/ai/agent/index.ts`：

```ts
import './builtin-tools' // 注册内置工具（副作用导入）

export * from './agent-loop'
export * from './tool-registry'
```

- [ ] **步骤 3：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep "ai/agent"`
预期：无 error。

---

## 任务 6：store 增加结构化进行中态

**文件：**
- 修改：`src/pages/assistant/store.ts`

- [ ] **步骤 1：接口加字段**

在 `AssistantStore` 接口 `streamingText` 下加：

```ts
  streamingText: string
  streamingParts: import('@/lib/ai/types').AiMessagePart[]
```

在 actions 区加：

```ts
  setStreamingParts: (parts: import('@/lib/ai/types').AiMessagePart[]) => void
```

- [ ] **步骤 2：初始值与实现**

初始状态 `streamingText: ''` 下加 `streamingParts: [],`；实现区 `setStreamingText` 下加：

```ts
  setStreamingParts: parts => set({ streamingParts: parts }),
```

`reset` 里补 `streamingParts: []`。

- [ ] **步骤 3：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep assistant/store`
预期：无 error。

---

## 任务 7：use-chat-stream 改造为消费 agent-loop

**文件：**
- 修改：`src/pages/assistant/hooks/use-chat-stream.ts`

- [ ] **步骤 1：替换起流逻辑**

将原"直接 callLLM 读 content"段（S2 的第 4 步起流 + 第 5 步落库）替换为调用 `runAgent`，并把回调映射到 `streamingParts`。核心替换：import 加 `import { runAgent } from '@/lib/ai/agent'`；起流段改为：

```ts
    // 4. 起 agent 循环
    const controller = new AbortController()
    useAssistantStore.setState({ streaming: true, streamingText: '', streamingParts: [], abortController: controller })

    // 进行中：用可变 parts 草稿实时渲染（reasoning / tool-call / text）
    const draft: AiMessagePart[] = []
    const pushDraft = () => useAssistantStore.getState().setStreamingParts([...draft])
    let reasoningIdx = -1
    let textIdx = -1

    try {
      const finalParts = await runAgent({
        history: useAssistantStore.getState().messages,
        signal: controller.signal,
        callbacks: {
          onReasoning: (full) => {
            if (reasoningIdx < 0) { draft.push({ type: 'reasoning', text: full }); reasoningIdx = draft.length - 1 }
            else draft[reasoningIdx] = { type: 'reasoning', text: full }
            pushDraft()
          },
          onText: (full) => {
            if (textIdx < 0) { draft.push({ type: 'text', text: full }); textIdx = draft.length - 1 }
            else draft[textIdx] = { type: 'text', text: full }
            pushDraft()
          },
          onToolCallStart: (call) => {
            draft.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, args: call.args, state: 'call' })
            // 下一段文本/推理应另起新块
            textIdx = -1
            reasoningIdx = -1
            pushDraft()
          },
          onToolResult: (id, result, isError) => {
            const i = draft.findIndex(p => p.type === 'tool-call' && (p as any).toolCallId === id)
            if (i >= 0) draft[i] = { ...(draft[i] as any), result, state: isError ? 'error' : 'result' }
            pushDraft()
          },
        },
      })

      // 5. 落库 assistant 消息（整轮完整 parts），原子关闭 streaming
      const assistantMessage = await insertMessage(conversationId, { role: 'assistant', parts: finalParts })
      useAssistantStore.setState(state => ({
        messages: [...state.messages, assistantMessage],
        streaming: false,
        streamingText: '',
        streamingParts: [],
        abortController: null,
      }))

      // 6. 刷新排序 + 首条标题（沿用原逻辑）
      await touchConversation(conversationId)
      if (isNewConversation) {
        const title = trimmed.slice(0, CONVERSATION_TITLE_MAX_LEN)
        const updated = await updateConversation(conversationId, { title })
        useAssistantStore.getState().upsertConversation(updated)
      }
    }
    catch (error) {
      if ((error as Error)?.name !== 'AbortError')
        toast.error('回复失败', { description: getErrorMessage(error) })
      useAssistantStore.setState({ streaming: false, streamingText: '', streamingParts: [], abortController: null })
    }
```

同步：文件顶部 import 增加 `import type { AiMessagePart } from '@/lib/ai/types'`；移除不再使用的 `toApiMessages` 本地函数与 `callLLM` import（改由 agent 内部处理）。`stopStreaming`/`retryLast`/乐观上屏用户消息逻辑保持不变。

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep use-chat-stream`
预期：无 error。

---

## 任务 8：GAIA Tool Calls Section 落地

**文件：**
- 创建：`src/components/ui/tool-calls-section.tsx`、`src/components/ui/compact-markdown.tsx`（`tool-icons.tsx`/`icons.tsx` S2 已装）

- [ ] **步骤 1：拉取组件**

先试 CLI（clean 依赖）：

```bash
pnpm dlx shadcn@latest add "https://ui.heygaia.io/r/compact-markdown.json" --yes --overwrite
```

`tool-calls-section` 因 `registryDependencies:["icons"]` 会命中 S2 已知的 bare-name 404，改用手写回退（从 registry JSON 内联 content 写文件）：

```bash
node -e "const fs=require('fs');const j=JSON.parse(require('child_process').execSync('curl -s https://ui.heygaia.io/r/tool-calls-section.json'));for(const f of j.files){if(!f.content)continue;let d;const p=f.path;if(p.startsWith('registry/new-york/ui/'))d='src/components/ui/'+p.replace('registry/new-york/ui/','');else if(p.startsWith('lib/'))d='src/'+p;else d='src/components/ui/'+p.split('/').pop();fs.mkdirSync(require('path').dirname(d),{recursive:true});fs.writeFileSync(d,f.content);console.log('wrote',d);}"
```

若 `compact-markdown` CLI 也失败，同法手写。

- [ ] **步骤 2：Vite 适配 + 图标替换**

对新建的 `tool-calls-section.tsx` / `compact-markdown.tsx`：

```bash
for f in src/components/ui/tool-calls-section.tsx src/components/ui/compact-markdown.tsx; do
  [ -f "$f" ] || continue
  perl -0pi -e 's{\@/components/icons}{\@/components/ui/icons}g' "$f"
  perl -0pi -e 's{\@/registry/new-york/ui/}{\@/components/ui/}g' "$f"
  perl -0pi -e 's{^import Image from "next/image";\n}{}m' "$f"
  perl -0pi -e 's{<Image\b}{<img}g' "$f"
done
grep -rn "next/\|@/components/icons\|@/registry\|hugeicons" src/components/ui/tool-calls-section.tsx src/components/ui/compact-markdown.tsx || echo "(clean)"
```

Hugeicons 若残留（`@/components/ui/icons` 是 GAIA 的 Hugeicons 再导出，S2 已保留该文件与依赖），可保留其 Hugeicons 用法（与 S2 的 composer 一致，deps 已装）。

- [ ] **步骤 3：验证**

运行：`pnpm exec tsc --noEmit 2>&1 | grep -E "tool-calls-section|compact-markdown"`
预期：无 error（`src/components/ui/**` 在 eslint ignore 内，tsc 为准）。

---

## 任务 9：reasoning-part 渲染器

**文件：**
- 创建：`src/pages/assistant/components/message-bubble/reasoning-part.tsx`

- [ ] **步骤 1：写渲染器**（复用现有 `@/components/ai/reasoning` compound）

```tsx
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai/reasoning'

interface ReasoningPartProps {
  text: string
  streaming?: boolean
}

export function ReasoningPart({ text, streaming = false }: ReasoningPartProps) {
  return (
    <Reasoning isStreaming={streaming} defaultOpen={false} className="mb-1">
      <ReasoningTrigger />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  )
}
```

> 以 `reasoning.tsx` 实际的 `ReasoningTrigger`/`ReasoningContent` props 为准；若 `ReasoningContent` 需要非 children 形式，按其签名调整（已确认内部用 Streamdown 渲染 children 文本）。

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 10：tool-call-part 渲染器（GAIA Tool Calls Section）

**文件：**
- 创建：`src/pages/assistant/components/message-bubble/tool-call-part.tsx`

- [ ] **步骤 1：写渲染器**（把一组 tool-call parts 映射为 `ToolCallEntry[]`）

```tsx
import type { AiMessagePart } from '@/lib/ai/types'
import { ToolCallsSection } from '@/components/ui/tool-calls-section'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

interface ToolCallPartProps {
  calls: ToolCallPart[]
}

export function ToolCallPartGroup({ calls }: ToolCallPartProps) {
  const entries = calls.map(c => ({
    tool_name: c.toolName,
    tool_category: 'resume',
    tool_call_id: c.toolCallId,
    inputs: (c.args ?? {}) as Record<string, unknown>,
    output: c.result === undefined ? '' : JSON.stringify(c.result),
    show_category: false,
  }))
  return <ToolCallsSection toolCalls={entries} />
}
```

> `ToolCallEntry` 字段（`tool_name`/`tool_category`/`inputs`/`output`/`tool_call_id`）已查证。`tool_category` 暂固定 `'resume'`，S4 可按工具分组细化。

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep tool-call-part`
预期：无 error。

---

## 任务 11：message-bubble part 分派（聚合连续 tool-call）

**文件：**
- 修改：`src/pages/assistant/components/message-bubble/index.tsx`

- [ ] **步骤 1：重写助手侧 parts 渲染为"分组分派"**

助手消息把 `parts` 按顺序分组渲染：连续的 `tool-call` 合并成一个 `ToolCallPartGroup`；`reasoning`→`ReasoningPart`；`text`→`TextPart`。替换助手分支的 `message.parts.map(...)` 为一个分组函数：

```tsx
import { ReasoningPart } from './reasoning-part'
import { ToolCallPartGroup } from './tool-call-part'
// ...
function renderAssistantParts(parts: AiMessage['parts']) {
  const nodes: React.ReactNode[] = []
  let buffer: Extract<AiMessagePart, { type: 'tool-call' }>[] = []
  const flush = (key: string) => {
    if (buffer.length) {
      nodes.push(<ToolCallPartGroup key={key} calls={buffer} />)
      buffer = []
    }
  }
  parts.forEach((p, i) => {
    if (p.type === 'tool-call') {
      buffer.push(p)
      return
    }
    flush(`tc-${i}`)
    if (p.type === 'reasoning')
      nodes.push(<ReasoningPart key={i} text={p.text} />)
    else if (p.type === 'text')
      nodes.push(<TextPart key={i} text={p.text} />)
  })
  flush('tc-end')
  return nodes
}
```

助手分支 body 用 `{renderAssistantParts(message.parts)}`。用户分支不变（纯文本）。文件顶部按字母序补 import。

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep message-bubble`
预期：无 error。

---

## 任务 12：进行中气泡渲染 streamingParts

**文件：**
- 修改：`src/pages/assistant/components/message-list/index.tsx`

- [ ] **步骤 1：进行中气泡改用 streamingParts**

将原来只渲染 `streamingText` 的进行中气泡，改为渲染 `streamingParts`（复用与已落库消息同一套渲染：构造一个临时 assistant AiMessage 交给 `MessageBubble`，或直接用分组渲染）。最小改动：读 `streamingParts`，为空且无文本时显示 `WaveSpinner`，否则用一个"进行中"的 assistant 气泡渲染这些 parts。

```tsx
  const streamingParts = useAssistantStore(s => s.streamingParts)
  // ...
  {streaming && (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {streamingParts.length > 0
          ? <MessageBubble message={{ id: 'streaming', conversationId: '', userId: '', role: 'assistant', parts: streamingParts, createdAt: new Date().toISOString() }} />
          : <WaveSpinner />}
      </div>
    </div>
  )}
```

> 注：`MessageBubble` 内部已处理 assistant 分组渲染；`id:'streaming'` 非 `local-` 前缀但也不落操作栏——微调 `MessageBubble`：`id==='streaming'` 时同样隐藏 actions（把 `isLocal` 判定改为 `id.startsWith('local-') || id === 'streaming'`）。或更简单：进行中直接调用 `renderAssistantParts` 导出的函数。落地时择一，优先复用 `MessageBubble` 并扩展隐藏 actions 条件。

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep message-list`
预期：无 error。

---

## 任务 13：最终验证

- [ ] **步骤 1：全量 lint + tsc + build**

运行：`pnpm lint && pnpm exec tsc --noEmit && pnpm build`
预期：lint 无新增 error；tsc 0 错误；build 成功。

- [ ] **步骤 2：手动清单**（`pnpm dev` → `/assistant`，已登录、S1 迁移已执行）

- [ ] 问"现在几点" → 出现 Tool Calls Section（get_current_time 调用+结果）→ 最终中文回答
- [ ] 问"我有几份简历/我的简历情况" → get_resume_summary 调用+结果 → 回答
- [ ] 多步：一句话需连调两个工具 → 顺序展示（聚合成一个 Tool Calls Section 或多段）→ 汇总回答
- [ ] 刷新页面：tool-call / text（/reasoning）parts 完整重现
- [ ] 流式中点停止：中断、无半截脏数据落库
- [ ] 未登录态调 get_resume_summary（或制造错误）：tool-call 显示错误态，循环仍给兜底回答
- [ ] 纯闲聊（不触发工具）：正常流式文本，无工具区
- [ ] 无双气泡、仅消息区滚动、输入框/侧栏固定（S2 行为不回归）

---

## 自检记录

- **规格覆盖度：** 循环(任务5)、registry(任务1)、内置工具(任务2)、parser(任务3)、to-api-messages(任务4)、store 进行中态(任务6)、hook 改造(任务7)、GAIA Tool Calls Section(任务8/10)、reasoning 复用(任务9)、part 分派聚合(任务11)、进行中渲染(任务12)、thinking 默认关(任务5 req 组装)、错误/上限/abort(任务5)、验证(任务13)——规格全部章节均有对应任务。
- **占位符扫描：** 无 TODO/待定；每步含完整代码；GAIA 拉取有 CLI+手写双路径。
- **类型一致性：** `AgentTool`/`ParsedToolCall`/`AgentCallbacks`/`runAgent` 前后一致；tool-call part 字段（`toolCallId`/`toolName`/`args`/`result`/`state`）与 S1 `AiMessagePart` 一致；`ToolCallEntry` 字段（`tool_name`/`inputs`/`output`）已查证映射；store 新增 `streamingParts` 全链路一致。
- **GAIA 优先：** Tool Calls Section（工具可视化）已用；reasoning 复用现有（GAIA 无对应）；markdown 用 Streamdown/compact-markdown。
- **边界：** `src/lib/ai/agent/` 纯逻辑无 React；hook 只映射回调到 store；渲染层认 parts。props 无跨层下钻（渲染器只接自己那组数据）。
- **已知落地判断点（标注供执行者）：** (a) `get_resume_summary` 依 `getAllResumesFromUser` 实际导出名/形状微调；(b) `ReasoningContent` children 用法以实际签名为准；(c) 进行中气泡复用 MessageBubble vs 直接分组渲染二选一；(d) GAIA tool-calls-section 若 CLI 失败走手写回退。
