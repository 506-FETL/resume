import type { AiConversation, AiMessage } from '@/lib/ai/types'

export type { AiConversation, AiMessage }

// 消息流渲染项：已落库消息 + 可选的"进行中"流式助手气泡
export interface StreamingDraft {
  text: string
}
