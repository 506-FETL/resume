import type { StoreApi } from 'zustand'
import type { AiConversation, AiMessage } from '@/lib/ai/types'
import type { ConversationCursor } from '@/lib/supabase/ai/conversations'
import type { AssistantStore } from '../store'

export interface HistorySlice {
  nextConversationCursor: ConversationCursor | null
  loadingMoreConversations: boolean
  conversationListError: boolean
  olderMessagesError: boolean
  historicalMatch: AiMessage | null
  setConversations: (list: AiConversation[]) => void
  upsertConversation: (conv: AiConversation) => void
  removeConversationLocal: (id: string) => void
}

export function mergeConversations(
  current: AiConversation[],
  incoming: AiConversation[],
) {
  const byId = new Map(current.map((item) => [item.id, item]))

  for (const item of incoming) byId.set(item.id, item)

  // 数据库统一返回 UTC 时间，保留毫秒以后的精度，同一时间按主键倒序。
  return [...byId.values()].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt)
      return left.updatedAt > right.updatedAt ? -1 : 1

    return right.id.localeCompare(left.id)
  })
}

export function createHistorySlice(
  set: StoreApi<AssistantStore>['setState'],
): HistorySlice {
  return {
    nextConversationCursor: null,
    loadingMoreConversations: false,
    olderMessagesError: false,
    conversationListError: false,
    historicalMatch: null,
    setConversations: (list) => set({ conversations: list }),
    upsertConversation: (conv) =>
      set((state) => ({
        conversations: mergeConversations(state.conversations, [conv]),
      })),
    removeConversationLocal: (id) =>
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId:
          state.activeConversationId === id ? null : state.activeConversationId,
        messages: state.activeConversationId === id ? [] : state.messages,
        composerSkillIds:
          state.activeConversationId === id ? [] : state.composerSkillIds,
      })),
  }
}
