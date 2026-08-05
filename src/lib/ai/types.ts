// AI 助手核心数据类型。parts 是「前端 <-> DB」存储契约，
// 与 DeepSeek 线上 messages 格式解耦（发给模型时由 S3 agent 层转换）。

export type AiMessageRole = 'user' | 'assistant' | 'system'

export type AiToolCallState = 'call' | 'awaiting-confirm' | 'result' | 'error' | 'cancelled'

export type AiMessagePart
  = | { type: 'text', text: string }
    | { type: 'image', path: string } // Storage 对象路径，非签名 URL（URL 有时效）
    | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: unknown
      result?: unknown
      state: AiToolCallState
    }
    | { type: 'reasoning', text: string }

export interface AiConversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface AiConversationSearchResult {
  conversationId: string
  conversationTitle: string
  messageId: string | null
  excerpt: string
  role: 'user' | 'assistant' | null
  matchedAt: string
  conversationUpdatedAt: string
  matchType: 'title' | 'message'
  relevance: number
}

export interface AiMessage {
  id: string
  conversationId: string
  userId: string
  role: AiMessageRole
  parts: AiMessagePart[]
  createdAt: string
}
