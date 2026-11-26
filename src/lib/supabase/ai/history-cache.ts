import type { AiConversation } from '@/lib/ai/types'
import type { ListMessagesResult } from './messages'
import type { ConversationPage } from './conversations'

const FRESH_MS = 30_000

class RecentReads<T> {
  private generation = 0

  private requests = new Map<
    string,
    { promise: Promise<T>; expires: number; invalidated: boolean }
  >()

  read(key: string, fetch: () => Promise<T>): Promise<T> {
    const cached = this.requests.get(key)

    if (cached && cached.expires > Date.now()) return cached.promise

    const generation = this.generation

    const entry: {
      promise: Promise<T>
      expires: number
      invalidated: boolean
    } = {
      promise: fetch().then(
        (value): T | Promise<T> => {
          // 写入期间启动的旧读取不能覆盖已经提交的更改。
          if (entry.invalidated && generation === this.generation)
            return this.read(key, fetch)

          entry.expires = Date.now() + FRESH_MS

          for (const [oldKey, old] of this.requests) {
            if (this.requests.size <= 8) break
            if (old.expires !== Infinity) this.requests.delete(oldKey)
          }

          return value
        },
        (error: unknown) => {
          if (this.requests.get(key) === entry) this.requests.delete(key)

          throw error
        },
      ),
      expires: Infinity,
      invalidated: false,
    }

    this.requests.delete(key)
    this.requests.set(key, entry)

    return entry.promise
  }

  invalidate(key: string) {
    const entry = this.requests.get(key)

    if (entry) entry.invalidated = true

    this.requests.delete(key)
  }

  clear() {
    this.generation += 1
    this.requests.clear()
  }
}

export const conversationPageReads = new RecentReads<ConversationPage>()

export const conversationDetailReads = new RecentReads<AiConversation | null>()

export const conversationMessageReads = new RecentReads<ListMessagesResult>()

export function invalidateConversationSummary(ownerId: string, id: string) {
  conversationPageReads.invalidate(ownerId)
  conversationDetailReads.invalidate(id)
  conversationMessageReads.invalidate(id)
}

export function resetConversationReads() {
  conversationPageReads.clear()
  conversationDetailReads.clear()
  conversationMessageReads.clear()
}
