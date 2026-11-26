import useUserStore from '@/store/user'
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

function lastConversationKey() {
  return `${ASSISTANT_LAST_CONVERSATION_STORAGE_KEY}:${useUserStore.getState().currentUser?.id}`
}

export function readLastConversationId(allowLegacy = false): string | null {
  try {
    const stored =
      localStorage.getItem(lastConversationKey()) ??
      (allowLegacy
        ? localStorage.getItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
        : null)

    return stored &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(stored)
      ? stored
      : null
  } catch {
    return null
  }
}

export function writeLastConversationId(id: string): void {
  try {
    localStorage.setItem(lastConversationKey(), id)
    localStorage.removeItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function clearLastConversationId(expectedId?: string): void {
  try {
    if (
      expectedId &&
      localStorage.getItem(lastConversationKey()) !== expectedId
    )
      return

    localStorage.removeItem(lastConversationKey())
    localStorage.removeItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}
