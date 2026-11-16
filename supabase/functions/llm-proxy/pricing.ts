import { isRecord } from './values.ts'

const HEAVY_RESUME_WRITE_TOOLS = new Set<string>([
  'update_current_resume_field',
  'create_resume',
  'update_resume_meta',
  'delete_resume',
  'save_current_resume_version',
  'restore_current_resume_version',
  'delete_resume_version',
])

const ATS_SYSTEM_MARKER = 'ATS 简历评估引擎'

function messagesContainAtsMarker(messages: unknown[]) {
  return messages.some((raw) => {
    if (!isRecord(raw) || raw.role !== 'system') return false

    return (
      typeof raw.content === 'string' && raw.content.includes(ATS_SYSTEM_MARKER)
    )
  })
}

export function computeCost(messages: unknown[]): {
  cost: 1 | 3
  action: string
} {
  if (messagesContainAtsMarker(messages)) return { cost: 3, action: 'ats' }

  let lastUserIndex = -1

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (isRecord(message) && message.role === 'user') {
      lastUserIndex = index
      break
    }
  }

  const currentTurn =
    lastUserIndex >= 0 ? messages.slice(lastUserIndex + 1) : messages

  const heavy = currentTurn.some((message) => {
    if (
      !isRecord(message) ||
      message.role !== 'assistant' ||
      !Array.isArray(message.tool_calls)
    )
      return false

    return message.tool_calls.some((toolCall) => {
      if (!isRecord(toolCall) || !isRecord(toolCall.function)) return false

      return (
        typeof toolCall.function.name === 'string' &&
        HEAVY_RESUME_WRITE_TOOLS.has(toolCall.function.name)
      )
    })
  })

  return heavy ? { cost: 3, action: 'resume_op' } : { cost: 1, action: 'chat' }
}
