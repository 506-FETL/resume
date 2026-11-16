import { serializeCommentCacheKey } from './keys'
import type { CommentCacheKey } from './types'

export const READ_CURSOR_PREFIX = 'resume-comment-read-cursor:'

export const THREAD_READ_CURSOR_PREFIX = 'resume-comment-thread-read-cursor:'

export function readCommentReadCursor(key: CommentCacheKey) {
  if (typeof localStorage === 'undefined') return 0

  try {
    const value = Number(
      localStorage.getItem(
        `${READ_CURSOR_PREFIX}${serializeCommentCacheKey(key)}`,
      ),
    )

    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

export function persistCommentReadCursor(
  key: CommentCacheKey,
  eventSeq: number,
) {
  if (typeof localStorage === 'undefined') return

  try {
    const storageKey = `${READ_CURSOR_PREFIX}${serializeCommentCacheKey(key)}`
    const current = Number(localStorage.getItem(storageKey))
    const next = Math.max(Number.isSafeInteger(current) ? current : 0, eventSeq)

    localStorage.setItem(storageKey, String(next))
  } catch {
    // 私密模式或存储额度不足时仍可依靠内存状态与服务端回执。
  }
}

export function threadReadCursorStorageKey(key: CommentCacheKey) {
  return `${THREAD_READ_CURSOR_PREFIX}${serializeCommentCacheKey(key)}`
}

export function readCommentThreadReadCursors(key: CommentCacheKey) {
  if (typeof localStorage === 'undefined') return []

  try {
    const parsed = JSON.parse(
      localStorage.getItem(threadReadCursorStorageKey(key)) ?? '{}',
    )

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return []

    return Object.entries(parsed).flatMap(([threadId, rawEventSeq]) => {
      const eventSeq = Number(rawEventSeq)

      return threadId && Number.isSafeInteger(eventSeq) && eventSeq >= 0
        ? [
            {
              threadId,
              latestCommentEventSeq: eventSeq,
              lastReadEventSeq: eventSeq,
            },
          ]
        : []
    })
  } catch {
    return []
  }
}

export function persistCommentThreadReadCursor(
  key: CommentCacheKey,
  threadId: string,
  eventSeq: number,
) {
  if (typeof localStorage === 'undefined') return

  try {
    const current = Object.fromEntries(
      readCommentThreadReadCursors(key).map((state) => [
        state.threadId,
        state.lastReadEventSeq,
      ]),
    )

    current[threadId] = Math.max(current[threadId] ?? 0, eventSeq)

    localStorage.setItem(
      threadReadCursorStorageKey(key),
      JSON.stringify(current),
    )
  } catch {
    // 私密模式或存储额度不足时仍保留当前内存中的已读状态。
  }
}

export function pruneCommentThreadReadCursors(
  key: CommentCacheKey,
  liveThreadIds: ReadonlySet<string>,
) {
  if (typeof localStorage === 'undefined') return

  try {
    const next = Object.fromEntries(
      readCommentThreadReadCursors(key)
        .filter((state) => liveThreadIds.has(state.threadId))
        .map((state) => [state.threadId, state.lastReadEventSeq]),
    )

    const storageKey = threadReadCursorStorageKey(key)

    if (Object.keys(next).length > 0)
      localStorage.setItem(storageKey, JSON.stringify(next))
    else localStorage.removeItem(storageKey)
  } catch {
    // 清理失败不影响在线权威状态。
  }
}
