import type { AiConversation } from '@/lib/ai/types'
import { ASSISTANT_LAST_CONVERSATION_STORAGE_KEY } from '../const'
import { toast } from 'sonner'

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)

    return value === null ? fallback : value === 'true'
  } catch {
    return fallback
  }
}

export function writeStoredBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // 在隐私或受限的浏览器环境中，存储功能可能无法使用。
    toast.error('浏览器环境可能受限,存储功能无法使用')
  }
}

export function readLastConversationId(): string | null {
  try {
    return localStorage.getItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeLastConversationId(id: string): void {
  try {
    localStorage.setItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY, id)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function clearLastConversationId(expectedId?: string): void {
  try {
    if (
      expectedId &&
      localStorage.getItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY) !==
        expectedId
    )
      return

    localStorage.removeItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function chooseRestoredConversation(
  conversations: AiConversation[],
  activeConversationId: string | null,
  storedConversationId: string | null,
): AiConversation | null {
  return (
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    ) ??
    conversations.find(
      (conversation) => conversation.id === storedConversationId,
    ) ??
    conversations[0] ??
    null
  )
}
