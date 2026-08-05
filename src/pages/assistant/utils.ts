import type { AiConversation } from '@/lib/ai/types'
import { ASSISTANT_LAST_CONVERSATION_STORAGE_KEY } from './const'

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === 'true'
  }
  catch {
    return fallback
  }
}

export function writeStoredBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function readLastConversationId(): string | null {
  try {
    return localStorage.getItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  }
  catch {
    return null
  }
}

export function writeLastConversationId(id: string): void {
  try {
    localStorage.setItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY, id)
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function clearLastConversationId(expectedId?: string): void {
  try {
    if (expectedId && localStorage.getItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY) !== expectedId)
      return
    localStorage.removeItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function chooseRestoredConversation(
  conversations: AiConversation[],
  activeConversationId: string | null,
  storedConversationId: string | null,
): AiConversation | null {
  return conversations.find(conversation => conversation.id === activeConversationId)
    ?? conversations.find(conversation => conversation.id === storedConversationId)
    ?? conversations[0]
    ?? null
}
