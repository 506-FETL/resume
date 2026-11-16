import type { AiMessage, AiMessagePart } from '@/lib/ai/types'

// 构造一条本地临时消息（乐观上屏，稍后用服务端返回替换）
export function makeLocalMessage(
  role: AiMessage['role'],
  parts: AiMessagePart[],
): AiMessage {
  return {
    id: `local-${crypto.randomUUID()}`,
    conversationId: '',
    userId: '',
    role,
    parts,
    createdAt: new Date().toISOString(),
  }
}

export function messageText(message: AiMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}
