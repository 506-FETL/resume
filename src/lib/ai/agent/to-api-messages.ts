import type { AiMessage } from '@/lib/ai/types'

const SYSTEM_PROMPT = '你是简历与求职助手，由 DeepSeek 大模型（deepseek-v4-pro）驱动。当被问及你的身份或模型时，如实回答你是基于 DeepSeek 模型的简历与求职助手，不要自称为 Claude、GPT、ChatGPT 或其它厂商的模型。可调用工具读取用户数据来更准确地回答。回答用中文，简洁清晰。'

interface ApiMessage {
  role: string
  content: string | null
  // 思考模式 + 工具调用时，历史 assistant 消息需回传本轮思维链，否则 DeepSeek 返回 400
  reasoning_content?: string
  tool_calls?: Array<{ id: string, type: 'function', function: { name: string, arguments: string } }>
  tool_call_id?: string
}

// AiMessage[]（parts）→ DeepSeek messages（含 system 头 + tool_calls + role:tool 回填）
// context: 轻量用户概况，拼进 system 头给 agent 基本盘感知
export function toApiMessages(messages: AiMessage[], context?: string): ApiMessage[] {
  const systemContent = context ? `${SYSTEM_PROMPT}\n\n${context}` : SYSTEM_PROMPT
  const out: ApiMessage[] = [{ role: 'system', content: systemContent }]

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
      // 该 assistant 消息内的思维链（可能多步），回传给 DeepSeek 以满足「工具调用需回传 reasoning_content」约束
      const reasoningContent = m.parts
        .filter(p => p.type === 'reasoning')
        .map(p => (p as { text: string }).text)
        .join('\n')
      out.push({
        role: 'assistant',
        content: textContent || null,
        reasoning_content: reasoningContent || undefined,
        tool_calls: toolCallParts.map(tc => ({
          id: tc.toolCallId,
          type: 'function',
          function: { name: tc.toolName, arguments: JSON.stringify(tc.args ?? {}) },
        })),
      })
      for (const tc of toolCallParts) {
        out.push({
          role: 'tool',
          content: JSON.stringify(tc.result ?? {}),
          tool_call_id: tc.toolCallId,
        })
      }
      continue
    }

    out.push({ role: m.role, content: textContent })
    // reasoning part 不回传模型（仅本地展示）
  }

  return out
}
