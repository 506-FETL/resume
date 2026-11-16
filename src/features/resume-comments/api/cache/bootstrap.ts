import type { CommentBootstrapResult } from '../client.ts'
import {
  advanceCommentCacheMutationGeneration,
  enqueueCommentCacheOperation,
  getDatabase,
  isCommentCacheWriteFenceCurrent,
} from './database'
import { serializeCommentCacheKey } from './keys'
import {
  readCommentReadCursor,
  readCommentThreadReadCursors,
  THREAD_READ_CURSOR_PREFIX,
} from './local-cursors'
import {
  advanceCommentReadCursor,
  isCommentCacheEntryCompatible,
  mergeCachedThreadReadStates,
  normalizeCachedThreadReadStates,
} from './read-state'
import type { CommentCacheKey, CommentCacheWriteFence } from './types'

export async function readCommentCache(key: CommentCacheKey) {
  const database = getDatabase()

  if (!database) return null

  const serializedKey = serializeCommentCacheKey(key)

  return enqueueCommentCacheOperation(serializedKey, async () => {
    const entry = await (await database).get('bootstrap', serializedKey)

    if (!isCommentCacheEntryCompatible(entry)) return null

    const liveThreadIds = new Set(
      entry.value.threads.map((thread) => thread.id),
    )

    return {
      ...entry,
      value: advanceCommentReadCursor(
        {
          ...entry.value,
          threadReadStates: mergeCachedThreadReadStates(
            normalizeCachedThreadReadStates(entry.value),
            readCommentThreadReadCursors(key),
            liveThreadIds,
          ),
        },
        readCommentReadCursor(key),
      ),
    }
  })
}

export async function writeCommentCache(
  key: CommentCacheKey,
  value: CommentBootstrapResult,
  fence?: CommentCacheWriteFence,
) {
  if (fence && !isCommentCacheWriteFenceCurrent(fence)) return false

  const database = getDatabase()

  if (!database) return false

  const {
    scopeRealtime: _scopeRealtime,
    ownerRealtime: _ownerRealtime,
    ...cacheValue
  } = value

  const serializedKey = serializeCommentCacheKey(key)

  return enqueueCommentCacheOperation(serializedKey, async () => {
    if (fence && !isCommentCacheWriteFenceCurrent(fence)) return false

    const resolved = await database
    const transaction = resolved.transaction('bootstrap', 'readwrite')
    const current = await transaction.store.get(serializedKey)
    const persistedReadCursor = readCommentReadCursor(key)

    const nextValue = advanceCommentReadCursor(
      {
        ...cacheValue,
        threadReadStates: mergeCachedThreadReadStates(
          isCommentCacheEntryCompatible(current)
            ? normalizeCachedThreadReadStates(current.value)
            : [],
          cacheValue.threadReadStates,
          new Set(cacheValue.threads.map((thread) => thread.id)),
        ),
      },
      Math.max(
        isCommentCacheEntryCompatible(current)
          ? current.value.lastReadEventSeq
          : 0,
        persistedReadCursor,
      ),
    )

    await transaction.store.put({
      protocolVersion: 1,
      key: serializedKey,
      versionId: key.versionId,
      principalKey: key.principalKey,
      cachedAt: Date.now(),
      value: nextValue,
    })

    await transaction.done

    return true
  })
}

export async function deleteCommentCache(key: CommentCacheKey) {
  advanceCommentCacheMutationGeneration()

  const database = getDatabase()

  if (!database) return

  const serializedKey = serializeCommentCacheKey(key)

  await enqueueCommentCacheOperation(serializedKey, async () => {
    await (await database).delete('bootstrap', serializedKey)
  })
}

export async function deleteCommentCacheForPrincipal(principalKey: string) {
  advanceCommentCacheMutationGeneration()

  if (typeof localStorage !== 'undefined') {
    try {
      const principalSuffix = `:principal:${principalKey}`

      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const storageKey = localStorage.key(index)

        if (
          storageKey?.startsWith(THREAD_READ_CURSOR_PREFIX) &&
          storageKey.endsWith(principalSuffix)
        ) {
          localStorage.removeItem(storageKey)
        }
      }
    } catch {
      // 登出清理失败不阻断主流程；缓存条目仍会按 principal 删除。
    }
  }

  const database = getDatabase()

  if (!database) return

  const resolved = await database
  const transaction = resolved.transaction('bootstrap', 'readwrite')

  let cursor = await transaction.store
    .index('principalKey')
    .openCursor(principalKey)

  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await transaction.done
}
