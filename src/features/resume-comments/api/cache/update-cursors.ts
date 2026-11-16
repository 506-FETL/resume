import { enqueueCommentCacheOperation, getDatabase } from './database'
import { serializeCommentCacheKey } from './keys'
import {
  persistCommentReadCursor,
  persistCommentThreadReadCursor,
} from './local-cursors'
import {
  advanceCommentReadCursor,
  isCommentCacheEntryCompatible,
  normalizeCachedThreadReadStates,
} from './read-state'
import type { CommentCacheKey } from './types'

export async function updateCommentCacheReadCursor(
  key: CommentCacheKey,
  eventSeq: number,
) {
  // localStorage 先同步写入，确保用户查看后立即刷新也不会再次出现未读提示。
  persistCommentReadCursor(key, eventSeq)

  const database = getDatabase()

  if (!database) return

  const serializedKey = serializeCommentCacheKey(key)

  await enqueueCommentCacheOperation(serializedKey, async () => {
    const resolved = await database
    const transaction = resolved.transaction('bootstrap', 'readwrite')
    const current = await transaction.store.get(serializedKey)

    if (isCommentCacheEntryCompatible(current)) {
      await transaction.store.put({
        ...current,
        cachedAt: Date.now(),
        value: advanceCommentReadCursor(current.value, eventSeq),
      })
    }

    await transaction.done
  })
}

export async function updateCommentCacheThreadReadCursor(
  key: CommentCacheKey,
  threadId: string,
  eventSeq: number,
  scopeLastReadEventSeq?: number,
) {
  // 线程级游标独立于整份 bootstrap 缓存；缓存因 realtime 失效后仍能补偿上报。
  persistCommentThreadReadCursor(key, threadId, eventSeq)

  const database = getDatabase()

  if (!database) return

  const serializedKey = serializeCommentCacheKey(key)

  await enqueueCommentCacheOperation(serializedKey, async () => {
    const resolved = await database
    const transaction = resolved.transaction('bootstrap', 'readwrite')
    const current = await transaction.store.get(serializedKey)

    if (isCommentCacheEntryCompatible(current)) {
      const states = normalizeCachedThreadReadStates(current.value)
      const existing = states.find((state) => state.threadId === threadId)

      const nextState = {
        threadId,
        latestCommentEventSeq: Math.max(
          existing?.latestCommentEventSeq ?? 0,
          eventSeq,
        ),
        lastReadEventSeq: Math.max(existing?.lastReadEventSeq ?? 0, eventSeq),
      }

      const value = {
        ...current.value,
        threadReadStates: [
          ...states.filter((state) => state.threadId !== threadId),
          nextState,
        ],
      }

      await transaction.store.put({
        ...current,
        cachedAt: Date.now(),
        value:
          scopeLastReadEventSeq === undefined
            ? value
            : advanceCommentReadCursor(value, scopeLastReadEventSeq),
      })
    }

    await transaction.done
  })
}
