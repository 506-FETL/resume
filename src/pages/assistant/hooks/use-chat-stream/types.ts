import type { AiMessage, AiMessagePart, AiUserReference } from '@/lib/ai/types'
import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'

export interface AssistantSendTurn {
  trimmed: string
  references: AiUserReference[]
  frozenSources: ExperienceSourceRelation[]
  userParts: AiMessagePart[]
  localUser: AiMessage
}

export interface SendLifecycle {
  ownsView: () => boolean
  ownsCurrentRun: (conversationId?: string) => boolean
  finishConversationRun: () => void
  recoveryEpoch: number
}

export interface SentConversation {
  conversationId: string
  isNewConversation: boolean
  assistantMessageId: string
  thinking: boolean
}
