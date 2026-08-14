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
  protocolVersion: 1
  key: string
  versionId: number
  principalKey: string
  cachedAt: number
  value: CachedCommentBootstrap
}

export function isCommentCacheEntryCompatible(value: unknown): value is CommentCacheEntry {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { protocolVersion?: unknown }).protocolVersion === 1
}

interface ResumeCommentCacheSchema extends DBSchema {
  bootstrap: {
    key: string
    value: CommentCacheEntry
    indexes: { principalKey: string }
  }
}

let databasePromise: Promise<IDBPDatabase<ResumeCommentCacheSchema>> | null = null
const READ_CURSOR_PREFIX = 'resume-comment-read-cursor:'

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

export function readCommentReadCursor(key: CommentCacheKey) {
  if (typeof localStorage === 'undefined')
    return 0
  try {
    const value = Number(localStorage.getItem(`${READ_CURSOR_PREFIX}${serializeCommentCacheKey(key)}`))
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  }
  catch {
    return 0
  }
}

function persistCommentReadCursor(key: CommentCacheKey, eventSeq: number) {
  if (typeof localStorage === 'undefined')
    return
  try {
    const storageKey = `${READ_CURSOR_PREFIX}${serializeCommentCacheKey(key)}`
    const current = Number(localStorage.getItem(storageKey))
    const next = Math.max(Number.isSafeInteger(current) ? current : 0, eventSeq)
    localStorage.setItem(storageKey, String(next))
  }
  catch {
    // 私密模式或存储额度不足时仍可依靠内存状态与服务端回执。
  }
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
  const entry = await (await database).get('bootstrap', serializeCommentCacheKey(key))
  if (!isCommentCacheEntryCompatible(entry))
    return null
  return {
    ...entry,
    value: advanceCommentReadCursor(entry.value, readCommentReadCursor(key)),
  }
}

export function advanceCommentReadCursor(
  value: CachedCommentBootstrap,
  eventSeq: number,
): CachedCommentBootstrap {
  const lastReadEventSeq = Math.max(value.lastReadEventSeq, eventSeq)
  return {
    ...value,
    lastReadEventSeq,
    accessibleScopes: value.accessibleScopes.map(scope => scope.id === value.scope.id
      ? {
          ...scope,
          lastReadEventSeq: Math.max(scope.lastReadEventSeq, lastReadEventSeq),
        }
      : scope),
  }
}

export async function writeCommentCache(
  key: CommentCacheKey,
  value: CommentBootstrapResult,
) {
  const database = getDatabase()
  if (!database)
    return
  const { scopeRealtime: _scopeRealtime, ownerRealtime: _ownerRealtime, ...cacheValue } = value
  const resolved = await database
  const serializedKey = serializeCommentCacheKey(key)
  const transaction = resolved.transaction('bootstrap', 'readwrite')
  const current = await transaction.store.get(serializedKey)
  const persistedReadCursor = readCommentReadCursor(key)
  const nextValue = advanceCommentReadCursor(
    cacheValue,
    Math.max(
      isCommentCacheEntryCompatible(current) ? current.value.lastReadEventSeq : 0,
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
}

export async function updateCommentCacheReadCursor(
  key: CommentCacheKey,
  eventSeq: number,
) {
  // localStorage 先同步写入，确保用户查看后立即刷新也不会再次出现未读提示。
  persistCommentReadCursor(key, eventSeq)
  const database = getDatabase()
  if (!database)
    return
  const resolved = await database
  const serializedKey = serializeCommentCacheKey(key)
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
