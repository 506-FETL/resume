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
            if (result && typeof result === 'object' && 'error' in (result as Record<string, unknown>))
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
