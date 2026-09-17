import type { AiMessage, AiMessagePart } from '../types.ts'
import { summarizeSkillToolResult } from '../skills/runtime.ts'

const SYSTEM_PROMPT = '你是简历与求职助手，由 DeepSeek 大模型（deepseek-v4-pro）驱动。当被问及你的身份或模型时，如实回答你是基于 DeepSeek 模型的简历与求职助手，不要自称为 Claude、GPT、ChatGPT 或其它厂商的模型。可调用工具读取用户数据来更准确地回答。回答用中文，简洁清晰。'

export interface ApiMessage {
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
    if (m.role !== 'assistant') {
      const content = m.parts.map((part) => {
        if (part.type === 'text')
          return part.text
        if (part.type === 'skill-reference')
          return `[该消息明确引用技能：${part.skillId}@${part.version}（${part.displayName}）]`
        return ''
      }).filter(Boolean).join('\n')
      out.push({ role: m.role, content })
      continue
    }

    // 一条持久化消息可能包含多轮模型回复。按原序恢复，避免把加载结果之前的
    // 工具与读取该结果之后的工具拼成一次并行调用，丢失因果关系。
    let texts: string[] = []
    let reasoning: string[] = []
    let calls: Extract<AiMessagePart, { type: 'tool-call' }>[] = []
    const flush = () => {
      if (!calls.length && !texts.length)
        return
      out.push({
        role: 'assistant',
        content: texts.join('\n') || null,
        ...(reasoning.length ? { reasoning_content: reasoning.join('\n') } : {}),
        ...(calls.length
          ? {
              tool_calls: calls.map(call => ({
                id: call.toolCallId,
                type: 'function' as const,
                function: { name: call.toolName, arguments: JSON.stringify(call.args ?? {}) },
              })),
            }
          : {}),
      })
      for (const call of calls) {
        const result = call.result ?? (call.state === 'cancelled' ? { cancelled: true } : { error: '该工具调用未完成' })
        out.push({ role: 'tool', content: JSON.stringify(summarizeSkillToolResult(call.toolName, result)), tool_call_id: call.toolCallId })
      }
      texts = []
      reasoning = []
      calls = []
    }
    for (const part of m.parts) {
      if (part.type === 'tool-call') {
        if (calls.length && part.step !== undefined && calls[0].step !== undefined && part.step !== calls[0].step)
          flush()
        calls.push(part)
        continue
      }
      if (calls.length)
        flush()
      if (part.type === 'text')
        texts.push(part.text)
      else if (part.type === 'reasoning')
        reasoning.push(part.text)
      else if (part.type === 'skill-activity')
        texts.push(`[历史技能加载：${part.skillId}@${part.version}，${part.state === 'ready' ? '成功' : part.error ?? '未完成'}；本轮是否加载以当前运行结果为准。]`)
    }
    flush()
  }

  return out
}
