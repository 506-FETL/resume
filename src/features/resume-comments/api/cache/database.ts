import type { IDBPDatabase } from 'idb'
import { openDB } from 'idb'
import type { CommentCacheWriteFence, ResumeCommentCacheSchema } from './types'

export let databasePromise: Promise<
  IDBPDatabase<ResumeCommentCacheSchema>
> | null = null

export let cacheMutationGeneration = 0

export const cacheOperationQueues = new Map<string, Promise<void>>()

export function captureCommentCacheWriteFence(): CommentCacheWriteFence {
  return { generation: cacheMutationGeneration }
}

export function isCommentCacheWriteFenceCurrent(fence: CommentCacheWriteFence) {
  return fence.generation === cacheMutationGeneration
}

export function advanceCommentCacheMutationGeneration() {
  cacheMutationGeneration += 1
}

export function enqueueCommentCacheOperation<T>(
  serializedKey: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = cacheOperationQueues.get(serializedKey) ?? Promise.resolve()
  const result = previous.then(operation, operation)

  const settled = result.then(
    () => undefined,
    () => undefined,
  )

  cacheOperationQueues.set(serializedKey, settled)

  return result.finally(() => {
    if (cacheOperationQueues.get(serializedKey) === settled)
      cacheOperationQueues.delete(serializedKey)
  })
}

export function getDatabase() {
  if (typeof indexedDB === 'undefined') return null

  databasePromise ??= openDB<ResumeCommentCacheSchema>(
    'resume-comment-cache-v1',
    1,
    {
      upgrade(database) {
        const store = database.createObjectStore('bootstrap', {
          keyPath: 'key',
        })

        store.createIndex('principalKey', 'principalKey')
      },
    },
  )

  return databasePromise
}
