# AI 助手 · S3 Agent 引擎 — 设计规格

- 日期：2026-08-04
- 子项目：S3（序列第 3 个：S1 数据层 ✓ → S2 页面骨架 ✓ → **S3 Agent 引擎** → S4 工具集+确认 → S5 入口集成 → S6 图片理解）
- 范围：`src/lib/ai/agent/**`（新增，UI 无关）、`src/pages/assistant/hooks/use-chat-stream.ts`（改造为消费 agent-loop）、`src/pages/assistant/components/message-bubble/**`（新增 reasoning / tool-call part 渲染器）、按需引入 GAIA `Tool Calls Section` / `Code Block`
- 目标：把 S2 的"单轮流式对话"升级为**前端多步 agent loop**——解析 DeepSeek 流式 `tool_calls`、执行工具、回填 `role:tool`、循环直到 `finish_reason=stop`。S3 只做**引擎与工具执行框架**，内置 1-2 个只读示例工具用于端到端验证；业务工具与写操作确认属 S4。

## 背景与依赖

- S1 已交付：`llm-proxy` 透传 `tools`/`tool_choice`/`thinking`（已实测流式 tool_calls 可用）；`ai_messages.parts` 结构化存储（含 `tool-call`/`reasoning` 块类型）。
- S2 已交付：`use-chat-stream` 发送→流式→落库骨架、乐观 UX、part 分派渲染（`message-bubble` 按 `part.type` 分派）、`callLLM(req, abortController)` 复用。
- 已实测的流式契约（S1 记录）：`delta.reasoning_content` 增量 → `delta.tool_calls[].function.arguments` 分片拼接（按 `index` 归并）→ `finish_reason:"tool_calls"`；无工具时 `delta.content` 增量 → `finish_reason:"stop"`。

## 全局约束（已定，见 S1/S2 规格）

- 前端跑 loop；Function Calling（非 MCP）；`deepseek-v4-pro`；权限 C（读自动/写确认，写确认在 S4）。
- **GAIA 优先**：凡有对应 GAIA 组件的一律优先用（GAIA 为本 AI 助手需求定制）。S3 用 **`Tool Calls Section`**（工具调用可视化）、**`Code Block`**（markdown 代码块）；思考展示复用仓库现有 `src/components/ai/reasoning.tsx`（GAIA 无对应件）。落地前逐个抓取 GAIA 组件真实 API 再接入，Hugeicons→lucide。

## 架构：核心循环

```
用户发消息（S2 乐观上屏）
  └─> agent-loop 启动：组装 messages + tools 定义 → callLLM(stream, tools, thinking)
        └─> stream-parser 解析 SSE：
              reasoning_content 增量 / content 增量 / tool_calls 分片(按 index 拼 arguments)
              ├─ finish_reason = "stop"       → 结束，落库 assistant 文本
              └─ finish_reason = "tool_calls" → 执行工具(tool-registry) →
                     把 assistant(含 tool_calls) + 每个 role:tool 结果 追加进 messages →
                     回到 callLLM（下一轮）
  循环上限 maxSteps（默认 8）
```

## 新增模块（`src/lib/ai/agent/`，与 UI 解耦、可独立推理）

### `tool-registry.ts`
工具注册表。每个工具：
```ts
interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema（对齐 DeepSeek tools.function.parameters）
  execute: (args: Record<string, unknown>) => Promise<unknown>
}
```
- `registerTool(tool)` / `getTools()` / `getTool(name)` / `toApiToolDefs()`（导出为 DeepSeek `tools` 数组格式：`{ type:'function', function:{ name, description, parameters } }`）。
- S3 内置只读示例工具（验证用，S4 会替换/扩充）：
  - `get_current_time`：无参，返回当前时间字符串。
  - `get_resume_summary`：无参，读当前登录用户默认/在线简历的极简摘要（复用现有简历读取；只读、无副作用）。若读取失败返回可读错误文本（不 throw 出循环）。
- registry 为未来 MCP 适配预留（S1 已述）：MCP 工具将来翻译进同一 `AgentTool` 形状即可。

### `stream-parser.ts`
把 DeepSeek SSE chunk 流累积为结构化增量。维护：
- `text`（content 累积）、`reasoning`（reasoning_content 累积）
- `toolCalls: Map<index, { id, name, argumentsText }>`（按 `delta.tool_calls[].index` 归并分片；`function.name` 出现在首片，`function.arguments` 分多片拼接）
- 返回 `finishReason`。
- 纯函数式消费：`for await (chunk) parser.push(chunk)`，通过传入的回调 `onText/onReasoning/onToolCallDelta` 吐增量给上层。
- 结束时 `parser.result()` 给出 `{ text, reasoning, toolCalls: {id,name,args}[], finishReason }`（`args` 为 `JSON.parse(argumentsText)`，解析失败则记为 `{}` 并标记该调用异常）。

### `to-api-messages.ts`
`AiMessage[]`（parts） → DeepSeek `messages[]`：
- `text` part → 该消息 `content` 字符串
- assistant 的 `tool-call` parts → 该 assistant 消息的 `tool_calls: [{ id, type:'function', function:{ name, arguments: JSON.stringify(args) } }]`，且紧随其后生成对应的 `{ role:'tool', tool_call_id, content: JSON.stringify(result) }` 消息
- `reasoning` part 不回传给模型（仅本地展示）
- system 提示（助手身份/能力边界）在此拼到 messages 头部

### `agent-loop.ts`
编排多步循环，入参 `{ conversationId, messages, tools, thinking, maxSteps, signal, callbacks }`，`callbacks`：
- `onReasoningDelta(text)` / `onTextDelta(text)` / `onToolCallStart(call)` / `onToolResult(call, result|error)` / `onStepDone()` / `onFinish(finalParts)`
- 内部：每轮 `callLLM` → parser 消费 → 若 `finish_reason:tool_calls` 则对每个 tool 调 `getTool(name).execute(args)`（try/catch），把结果回填 messages，进入下一轮；若 `stop` 则结束。
- `maxSteps`（默认 8）到顶：停止并在最终 parts 末尾追加一条"已达工具调用步数上限"的 text 提示。
- 未知工具名：不 throw，回填 `{ error: '工具不存在' }` 给模型。
- `signal.aborted`：立即停止，抛 AbortError 由上层处理（进行中轮次不落库）。

## parts 落库与渲染

### 落库（一轮 agent 产出的 assistant 消息 parts，按发生顺序）
- `{ type:'reasoning', text }`（若 thinking 开）
- `{ type:'tool-call', toolCallId, toolName, args, result, state:'call'|'result'|'error' }`（每次工具调用一块，含入参与结果）
- `{ type:'text', text }`（最终自然语言回答）

多步 → 多个 `tool-call` 块顺序排列，完整还原"想→调A→调B→答"。刷新后由 S1 parts 持久化重现。

> 落库时机：整轮 agent 完成后，把累积的完整 parts 作为**一条** assistant 消息 `insertMessage`（与 S2 一致，原子切换 streaming=false 避免双气泡）。流式进行中通过 store 的 `streamingText` + 新增的"进行中 parts"临时态实时渲染。

### 渲染（`message-bubble` part 分派新增）
- `reasoning-part.tsx` → 复用现有 `src/components/ai/reasoning.tsx`（可折叠思考区）
- `tool-call-part.tsx` → 用 **GAIA `Tool Calls Section`** 展示工具名/入参/结果，可展开（图示的"Used N tools"效果）；`state` 映射到调用中/完成/错误样式
- `text-part.tsx`（S2 已有，Streamdown markdown；markdown 内代码块用 GAIA `Code Block` 或 Streamdown 内置——落地时择一，优先 GAIA）

## 流式进行中的实时态

S2 的 `streamingText:string` 不足以表达"思考+多工具+文本"的混合流。S3 扩展 store 的进行中态为**结构化草稿**：`streamingParts: AiMessagePart[]`（随 agent 回调实时更新），消息流渲染这条"进行中"气泡时按 parts 分派（与已落库消息同一套渲染器，复用）。整轮完成后清空 `streamingParts`，落库正式消息。

## thinking 控制

- `agent-loop` 接受 `thinking` 参数，S3 默认 **关闭**（`thinking:{type:'disabled'}`）——响应快、省 token。
- 保留可开能力（`reasoning_effort` 可调），S4 复杂规划步按需开；S3 不做 UI 开关（YAGNI），仅在代码层可配。

## 错误 / 上限 / 中断

- `maxSteps=8`：到顶强制收尾 + 追加提示 text part。
- 工具执行失败：该 `tool-call` part 标 `state:'error'` + 错误文本回填模型，**循环继续**（让模型纠正或如实告知）。
- 未知工具名：回填"工具不存在"，不崩。
- abort（停止/切会话/离开）：中断 SSE；进行中轮次不落库；已落库的前序轮次保留。
- LLM 请求失败：toast + 移除进行中气泡（同 S2）。
- 落库失败：toast + 乐观回滚。

## 单元隔离与边界

- `src/lib/ai/agent/` 纯逻辑、无 React、无 UI：registry/parser/to-api-messages/loop 各单一职责，可独立推理与替换。
- `use-chat-stream` 只负责"起 loop + 把回调事件映射到 store"，不含解析细节。
- 渲染层只认 `parts`；新增 part 类型加渲染器即可，不改气泡壳（S2 已立此模式）。

## 验证（本仓库不写测试）

1. `pnpm lint` + `pnpm build` + `tsc --noEmit` 全绿。
2. 手动清单（`pnpm dev` → `/assistant`，已登录、S1 迁移已执行）：
   - 问"现在几点" → 触发 `get_current_time` → GAIA Tool Calls Section 展示调用+结果 → 最终自然语言回答
   - 问"我的简历怎么样"类 → 触发 `get_resume_summary` → 展示工具结果 → 回答
   - 多步：一句话需连调两个工具 → 顺序展示两个 tool-call 块 → 汇总回答
   - 刷新页面：reasoning/tool-call/text parts 完整重现
   - 流式中点停止：中断、不留半截脏数据
   - 工具报错场景（如未登录调 get_resume_summary）：tool-call 标错误、循环仍给出兜底回答
   - thinking 默认关：响应无冗长思考（如需可代码层开启验证一次）

## 非目标（YAGNI / 移交）

- 业务工具（读写简历/看板/模板全量）与**写操作确认卡片** → S4
- 图片理解（vision）→ S6
- 模型切换 UI（GAIA Model Selector）、语音、@提及 → 后续档
- thinking 的 UI 开关 → 后续按需（S3 仅代码层可配）
- 不改现有 ATS/JD/改写等既有 AI 功能
