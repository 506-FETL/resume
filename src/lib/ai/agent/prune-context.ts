import type { ModelMessage } from 'ai'

const REREADABLE_TOOLS = new Set([
  'get_resume_detail',
  'get_job',
  'read_resume_knowledge',
  'read_experience_source',
  'search_experience_sources',
  'read_resume_preparation',
])

export function pruneRepeatedReadResults(
  messages: ModelMessage[],
): ModelMessage[] {
  const latest = new Map<string, string>()

  return messages
    .slice()
    .reverse()
    .map((message): ModelMessage => {
      if (message.role !== 'tool') return message

      return {
        ...message,
        content: message.content.map((part) => {
          if (
            part.type !== 'tool-result' ||
            !REREADABLE_TOOLS.has(part.toolName)
          )
            return part

          const key = `${part.toolName}:${JSON.stringify(part.output)}`
          const retained = latest.get(key)

          if (!retained) {
            latest.set(key, part.toolCallId)

            return part
          }

          return {
            ...part,
            output: {
              type: 'text' as const,
              value: `相同的只读结果保留在后续调用 ${retained}，此处省略重复正文；调用及其结果仍成对保留。`,
            },
          }
        }),
      }
    })
    .reverse()
}
