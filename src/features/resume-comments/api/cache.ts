import type { DBSchema, IDBPDatabase } from 'idb'
import type { CommentAccessContext, CommentBootstrapResult } from './client.ts'
import { openDB } from 'idb'

export interface CommentCacheKey {
  versionId: number
  principalKey: string
}

export type CachedCommentBootstrap = Omit<
  CommentBootstrapResult,
  'scopeRealtime' | 'ownerRealtime'
>

export interface CommentCacheEntry {
  key: string
  versionId: number
  principalKey: string
  cachedAt: number
  value: CachedCommentBootstrap
}

interface ResumeCommentCacheSchema extends DBSchema {
  bootstrap: {
    key: string
    value: CommentCacheEntry
    indexes: { principalKey: string }
  }
}

let databasePromise: Promise<IDBPDatabase<ResumeCommentCacheSchema>> | null = null

function getDatabase() {
  if (typeof indexedDB === 'undefined')
    return null
  databasePromise ??= openDB<ResumeCommentCacheSchema>(
    'resume-comment-cache-v1',
    1,
    {
      upgrade(database) {
        const store = database.createObjectStore('bootstrap', { keyPath: 'key' })
        store.createIndex('principalKey', 'principalKey')
      },
    },
  )
  return databasePromise
}

export function serializeCommentCacheKey(key: CommentCacheKey) {
  return `version:${key.versionId}:principal:${key.principalKey}`
}

export function deriveCommentCacheKey(
  access: CommentAccessContext,
  resolvedVersionId?: number,
  authenticatedUserId?: string | null,
): CommentCacheKey | null {
  const versionId = 'versionId' in access
    ? access.versionId
    : resolvedVersionId ?? readCommentVersionHint(access)
  if (!versionId)
    return null
  if (access.kind === 'owner') {
    return authenticatedUserId
      ? { versionId, principalKey: `owner:${authenticatedUserId}` }
      : null
  }
  if (access.kind === 'collaborator')
    return { versionId, principalKey: `user:${access.userId}` }
  return {
    versionId,
    principalKey: authenticatedUserId
      ? `user:${authenticatedUserId}`
      : access.anonymous
        ? `anonymous:${access.anonymous.id}`
        : 'share-visitor',
  }
}

function versionHintKey(resumeId: string) {
  return `resume-comment-version-hint:${resumeId}`
}

export function rememberCommentVersionHint(access: CommentAccessContext, versionId: number) {
  if (access.kind !== 'owner' || !('resumeId' in access) || typeof localStorage === 'undefined')
    return
  try {
    localStorage.setItem(versionHintKey(access.resumeId), String(versionId))
  }
  catch {
    // 缓存提示不可用不影响评论主流程。
  }
}

export function readCommentVersionHint(access: CommentAccessContext) {
  if (access.kind !== 'owner' || !('resumeId' in access) || typeof localStorage === 'undefined')
    return undefined
  try {
    const value = Number(localStorage.getItem(versionHintKey(access.resumeId)))
    return Number.isSafeInteger(value) && value > 0 ? value : undefined
  }
  catch {
    return undefined
  }
}

export async function readCommentCache(key: CommentCacheKey) {
  const database = getDatabase()
  if (!database)
    return null
  return (await database).get('bootstrap', serializeCommentCacheKey(key))
}

export async function writeCommentCache(
  key: CommentCacheKey,
  value: CommentBootstrapResult,
) {
  const database = getDatabase()
  if (!database)
    return
  const { scopeRealtime: _scopeRealtime, ownerRealtime: _ownerRealtime, ...cacheValue } = value
  await (await database).put('bootstrap', {
    key: serializeCommentCacheKey(key),
    versionId: key.versionId,
    principalKey: key.principalKey,
    cachedAt: Date.now(),
    value: cacheValue,
  })
}

export async function deleteCommentCacheForPrincipal(principalKey: string) {
  const database = getDatabase()
  if (!database)
    return
  const resolved = await database
  const transaction = resolved.transaction('bootstrap', 'readwrite')
  let cursor = await transaction.store.index('principalKey').openCursor(principalKey)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await transaction.done
}
