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
          content: JSON.stringify(tc.result ?? {}),
          tool_call_id: tc.toolCallId,
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
