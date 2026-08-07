import type { StreamUsage } from './stream-parser'
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { callLLM } from '@/lib/llm/call'
import { StreamParser } from './stream-parser'
import { toApiMessages } from './to-api-messages'
import { getTool, toApiToolDefs } from './tool-registry'

// 注：light/heavy 与扣费金额已改由 llm-proxy 服务端根据请求 payload 权威判定，
// 客户端不再进行 per-turn 加权计算，也不上报 weight。

export interface AgentCallbacks {
  onReasoning?: (full: string) => void
  onText?: (full: string) => void
  onToolCallStart?: (call: { id: string, name: string, args: Record<string, unknown>, awaitingConfirm?: boolean }) => void
  onToolResult?: (id: string, result: unknown, isError: boolean, cancelled?: boolean) => void
  // 累计 token 用量（本轮多步求和），每步结束回调一次
  onUsage?: (usage: StreamUsage) => void
}

export interface AgentRunOptions {
  history: AiMessage[] // 含刚追加的用户消息
  signal: AbortSignal
  thinking?: boolean // 默认关
  maxSteps?: number // 默认 8
  context?: string // 轻量用户概况，注入 system
  callbacks?: AgentCallbacks
}

// 运行多步 agent，返回最终 assistant 消息的 parts（供落库）
export async function runAgent(options: AgentRunOptions): Promise<AiMessagePart[]> {
  const { history, signal, thinking = false, maxSteps = 8, context, callbacks = {} } = options
  const apiMessages = toApiMessages(history, context)
  const finalParts: AiMessagePart[] = []
  const cumulativeUsage: StreamUsage = { input: 0, output: 0, total: 0 }

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
      stream_options: { include_usage: true },
      tools: toApiToolDefs(),
      thinking: thinking ? { type: 'enabled' } : { type: 'disabled' },
    }
    const requestController = new AbortController()
    const abortRequest = () => requestController.abort()
    signal.addEventListener('abort', abortRequest, { once: true })
    if (signal.aborted)
      requestController.abort()

    try {
      const stream = await callLLM(req as any, requestController)

      for await (const chunk of stream) {
        if (signal.aborted)
          throw new DOMException('aborted', 'AbortError')
        parser.push(chunk)
      }
    }
    finally {
      signal.removeEventListener('abort', abortRequest)
    }

    const { text, reasoning, toolCalls, finishReason, usage } = parser.result()

    if (usage) {
      cumulativeUsage.input += usage.input
      cumulativeUsage.output += usage.output
      cumulativeUsage.total += usage.total
      callbacks.onUsage?.({ ...cumulativeUsage })
    }

    if (reasoning)
      finalParts.push({ type: 'reasoning', text: reasoning })

    // 需要调用工具
    if (finishReason === 'tool_calls' && toolCalls.length > 0) {
      // 记录 assistant 的 tool_calls 到 api 上下文
      // DeepSeek 思考模式下：携带 tools 的请求，后续轮次必须完整回传本轮 reasoning_content，
      // 否则 API 返回 400。见 https://api-docs.deepseek.com/zh-cn/guides/thinking_mode#工具调用
      apiMessages.push({
        role: 'assistant',
        content: text || null,
        reasoning_content: reasoning || undefined,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      } as any)
      if (text)
        finalParts.push({ type: 'text', text })

      for (const tc of toolCalls) {
        const tool = getTool(tc.name)
        const isWrite = tool?.mode === 'write'
        callbacks.onToolCallStart?.({ ...tc, awaitingConfirm: isWrite })
        let result: unknown
        let isError = false
        let cancelled = false
        if (!tool) {
          result = { error: `工具不存在: ${tc.name}` }
          isError = true
        }
        else {
          try {
            result = await tool.execute(tc.args)
            if (result && typeof result === 'object') {
              const obj = result as Record<string, unknown>
              if ('error' in obj)
                isError = true
              if ('cancelled' in obj && obj.cancelled)
                cancelled = true
            }
          }
          catch (e) {
            result = { error: e instanceof Error ? e.message : '工具执行失败' }
            isError = true
          }
        }
        callbacks.onToolResult?.(tc.id, result, isError, cancelled)
        finalParts.push({
          type: 'tool-call',
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.args,
          result,
          state: isError ? 'error' : cancelled ? 'cancelled' : 'result',
        })
        apiMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id } as any)
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
