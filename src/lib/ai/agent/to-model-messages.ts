import type { AssistantModelMessage, ModelMessage } from 'ai'
import type { AiMessage, AiMessagePart } from '../types'
import { summarizeSkillToolResult } from '../skills/runtime'
import { serializeAiToolValue } from './serialize-tool-value'

const SYSTEM_PROMPT =
  '你是简历与求职助手，由 DeepSeek 大模型（deepseek-v4-pro）驱动。当被问及你的身份或模型时，如实回答你是基于 DeepSeek 模型的简历与求职助手，不要自称为 Claude、GPT、ChatGPT 或其它厂商的模型。可调用工具读取用户数据来更准确地回答。回答用中文，简洁清晰。'

export function toModelMessages(
  messages: AiMessage[],
  context?: string,
): ModelMessage[] {
  const out: ModelMessage[] = [
    {
      role: 'system',
      content: context ? `${SYSTEM_PROMPT}\n\n${context}` : SYSTEM_PROMPT,
    },
  ]

  for (const message of messages) {
    if (message.role !== 'assistant') {
      out.push({
        role: message.role,
        content: message.parts
          .map((part) => {
            if (part.type === 'text') return part.text
            if (part.type === 'skill-reference')
              return `[该消息明确引用技能：${part.skillId}@${part.version}（${part.displayName}）]`

            return ''
          })
          .filter(Boolean)
          .join('\n'),
      })

      continue
    }

    let content: Exclude<AssistantModelMessage['content'], string> = []
    let calls: Extract<AiMessagePart, { type: 'tool-call' }>[] = []

    const flush = () => {
      if (!content.length) return

      out.push({ role: 'assistant', content })

      if (calls.length) {
        out.push({
          role: 'tool',
          content: calls.map((call) => ({
            type: 'tool-result',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            output: {
              type: 'text',
              value: serializeAiToolValue(
                summarizeSkillToolResult(
                  call.toolName,
                  call.result ??
                    (call.state === 'cancelled'
                      ? { cancelled: true }
                      : { error: '该工具调用未完成' }),
                ),
              ),
            },
          })),
        })
      }

      content = []
      calls = []
    }

    // 一条数据库消息包含多轮调用；必须保留读取结果与后续工具的因果顺序。
    for (const part of message.parts) {
      if (part.type === 'tool-call') {
        if (
          calls.length &&
          part.step !== undefined &&
          calls[0].step !== undefined &&
          part.step !== calls[0].step
        )
          flush()

        content.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.args ?? {},
        })

        calls.push(part)
        continue
      }
      if (calls.length) flush()
      if (part.type === 'text' || part.type === 'reasoning') content.push(part)
      else if (part.type === 'skill-activity')
        content.push({
          type: 'text',
          text: `[历史技能加载：${part.skillId}@${part.version}，${part.state === 'ready' ? '成功' : (part.error ?? '未完成')}；本轮是否加载以当前运行结果为准。]`,
        })
    }

    flush()
  }

  return out
}
