import type { AiConversation, AiMessage } from '@/lib/ai/types'

export type { AiConversation, AiMessage }

export interface AssistantRouteState {
  from?: string
}

export interface OpenConversationOptions {
  targetMessageId?: string | null
  closeOverlays?: boolean
}

export type ConversationSearchStatus
  = 'idle'
    | 'loading'
    | 'ready'
    | 'empty'
    | 'error'
    | 'unavailable'
