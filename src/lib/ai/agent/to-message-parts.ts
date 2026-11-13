import type { UIMessage } from 'ai'
import type { AiMessagePart, AiSkillActivity } from '../types'
import { getToolName, isToolUIPart } from 'ai'

export type AgentUIMessage = UIMessage<
  unknown,
  {
    'skill-activity': AiSkillActivity
    'tool-start': { toolCallId: string }
  }
>

export function toMessageParts(message: AgentUIMessage): AiMessagePart[] {
  const parts: AiMessagePart[] = []

  const startedWriteTools = new Set(
    message.parts.flatMap((part) =>
      part.type === 'data-tool-start' ? [part.data.toolCallId] : [],
    ),
  )

  let step = -1

  for (const part of message.parts) {
    if (part.type === 'step-start') {
      step++
    } else if (part.type === 'text' || part.type === 'reasoning') {
      parts.push({ type: part.type, text: part.text })
    } else if (part.type === 'data-skill-activity') {
      parts.push(part.data)
    } else if (isToolUIPart(part)) {
      const name = getToolName(part)

      const output =
        part.state === 'output-error'
          ? { error: part.errorText }
          : part.state === 'output-denied'
            ? { cancelled: true }
            : part.output

      const state =
        part.state === 'output-error'
          ? 'error'
          : part.state === 'output-denied'
            ? 'cancelled'
            : part.state === 'output-available'
              ? getToolResultState(output)
              : part.state === 'input-available' &&
                  startedWriteTools.has(part.toolCallId)
                ? 'awaiting-confirm'
                : 'call'

      parts.push({
        type: 'tool-call',
        toolCallId: part.toolCallId,
        toolName: name,
        step,
        args: part.input ?? {},
        result: output,
        state,
      })
    }
  }

  return parts
}

export function getToolResultState(result: unknown) {
  if (result && typeof result === 'object') {
    if ('error' in result) return 'error'
    if ('cancelled' in result && result.cancelled) return 'cancelled'
  }

  return 'result'
}
