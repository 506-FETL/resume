import type { DBSchema, IDBPDatabase } from 'idb'
import type { CommentThreadReadState } from '../types.ts'
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

function normalizeCachedThreadReadStates(value: CachedCommentBootstrap) {
  return Array.isArray(value.threadReadStates) ? value.threadReadStates : []
}

export function mergeCachedThreadReadStates(
  current: CommentThreadReadState[],
  incoming: CommentThreadReadState[],
  liveThreadIds: ReadonlySet<string>,
) {
  const merged = new Map(current
    .filter(state => liveThreadIds.has(state.threadId))
    .map(state => [state.threadId, state]))
  for (const state of incoming) {
    if (!liveThreadIds.has(state.threadId))
      continue
    const existing = merged.get(state.threadId)
    merged.set(state.threadId, {
      threadId: state.threadId,
      latestCommentEventSeq: Math.max(
        existing?.latestCommentEventSeq ?? 0,
        state.latestCommentEventSeq,
      ),
      lastReadEventSeq: Math.max(
        existing?.lastReadEventSeq ?? 0,
        state.lastReadEventSeq,
      ),
    })
  }
  return [...merged.values()]
}

interface ResumeCommentCacheSchema extends DBSchema {
  bootstrap: {
    key: string
    value: CommentCacheEntry
    indexes: { principalKey: string }
  }
}

let databasePromise: Promise<IDBPDatabase<ResumeCommentCacheSchema>> | null = null
let cacheMutationGeneration = 0
const cacheOperationQueues = new Map<string, Promise<void>>()
const READ_CURSOR_PREFIX = 'resume-comment-read-cursor:'
const THREAD_READ_CURSOR_PREFIX = 'resume-comment-thread-read-cursor:'

export interface CommentCacheWriteFence {
  generation: number
}

export function captureCommentCacheWriteFence(): CommentCacheWriteFence {
  return { generation: cacheMutationGeneration }
}

export function isCommentCacheWriteFenceCurrent(fence: CommentCacheWriteFence) {
  return fence.generation === cacheMutationGeneration
}

function advanceCommentCacheMutationGeneration() {
  cacheMutationGeneration += 1
}

function enqueueCommentCacheOperation<T>(
  serializedKey: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = cacheOperationQueues.get(serializedKey) ?? Promise.resolve()
  const result = previous.then(operation, operation)
  const settled = result.then(() => undefined, () => undefined)
  cacheOperationQueues.set(serializedKey, settled)
  return result.finally(() => {
    if (cacheOperationQueues.get(serializedKey) === settled)
      cacheOperationQueues.delete(serializedKey)
  })
}

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

function threadReadCursorStorageKey(key: CommentCacheKey) {
  return `${THREAD_READ_CURSOR_PREFIX}${serializeCommentCacheKey(key)}`
}

export function readCommentThreadReadCursors(key: CommentCacheKey) {
  if (typeof localStorage === 'undefined')
    return []
  try {
    const parsed = JSON.parse(localStorage.getItem(threadReadCursorStorageKey(key)) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return []
    return Object.entries(parsed).flatMap(([threadId, rawEventSeq]) => {
      const eventSeq = Number(rawEventSeq)
      return threadId && Number.isSafeInteger(eventSeq) && eventSeq >= 0
        ? [{ threadId, latestCommentEventSeq: eventSeq, lastReadEventSeq: eventSeq }]
        : []
    })
  }
  catch {
    return []
  }
}

function persistCommentThreadReadCursor(
  key: CommentCacheKey,
  threadId: string,
  eventSeq: number,
) {
  if (typeof localStorage === 'undefined')
    return
  try {
    const current = Object.fromEntries(readCommentThreadReadCursors(key)
      .map(state => [state.threadId, state.lastReadEventSeq]))
    current[threadId] = Math.max(current[threadId] ?? 0, eventSeq)
    localStorage.setItem(threadReadCursorStorageKey(key), JSON.stringify(current))
  }
  catch {
    // 私密模式或存储额度不足时仍保留当前内存中的已读状态。
  }
}

export function pruneCommentThreadReadCursors(
  key: CommentCacheKey,
  liveThreadIds: ReadonlySet<string>,
) {
  if (typeof localStorage === 'undefined')
    return
  try {
    const next = Object.fromEntries(readCommentThreadReadCursors(key)
      .filter(state => liveThreadIds.has(state.threadId))
      .map(state => [state.threadId, state.lastReadEventSeq]))
    const storageKey = threadReadCursorStorageKey(key)
    if (Object.keys(next).length > 0)
      localStorage.setItem(storageKey, JSON.stringify(next))
    else
      localStorage.removeItem(storageKey)
  }
  catch {
    // 清理失败不影响在线权威状态。
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
  const serializedKey = serializeCommentCacheKey(key)
  return enqueueCommentCacheOperation(serializedKey, async () => {
    const entry = await (await database).get('bootstrap', serializedKey)
    if (!isCommentCacheEntryCompatible(entry))
      return null
    const liveThreadIds = new Set(entry.value.threads.map(thread => thread.id))
    return {
      ...entry,
      value: advanceCommentReadCursor({
        ...entry.value,
        threadReadStates: mergeCachedThreadReadStates(
          normalizeCachedThreadReadStates(entry.value),
          readCommentThreadReadCursors(key),
          liveThreadIds,
        ),
      }, readCommentReadCursor(key)),
    }
  })
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
  fence?: CommentCacheWriteFence,
) {
  if (fence && !isCommentCacheWriteFenceCurrent(fence))
    return false
  const database = getDatabase()
  if (!database)
    return false
  const { scopeRealtime: _scopeRealtime, ownerRealtime: _ownerRealtime, ...cacheValue } = value
  const serializedKey = serializeCommentCacheKey(key)
  return enqueueCommentCacheOperation(serializedKey, async () => {
    if (fence && !isCommentCacheWriteFenceCurrent(fence))
      return false
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
          new Set(cacheValue.threads.map(thread => thread.id)),
        ),
      },
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
    return true
  })
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
  if (!database)
    return
  const serializedKey = serializeCommentCacheKey(key)
  await enqueueCommentCacheOperation(serializedKey, async () => {
    const resolved = await database
    const transaction = resolved.transaction('bootstrap', 'readwrite')
    const current = await transaction.store.get(serializedKey)
    if (isCommentCacheEntryCompatible(current)) {
      const states = normalizeCachedThreadReadStates(current.value)
      const existing = states.find(state => state.threadId === threadId)
      const nextState = {
        threadId,
        latestCommentEventSeq: Math.max(existing?.latestCommentEventSeq ?? 0, eventSeq),
        lastReadEventSeq: Math.max(existing?.lastReadEventSeq ?? 0, eventSeq),
      }
      const value = {
        ...current.value,
        threadReadStates: [
          ...states.filter(state => state.threadId !== threadId),
          nextState,
        ],
      }
      await transaction.store.put({
        ...current,
        cachedAt: Date.now(),
        value: scopeLastReadEventSeq === undefined
          ? value
          : advanceCommentReadCursor(value, scopeLastReadEventSeq),
      })
    }
    await transaction.done
  })
}

export async function deleteCommentCache(key: CommentCacheKey) {
  advanceCommentCacheMutationGeneration()
  const database = getDatabase()
  if (!database)
    return
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
        if (storageKey?.startsWith(THREAD_READ_CURSOR_PREFIX)
          && storageKey.endsWith(principalSuffix)) {
          localStorage.removeItem(storageKey)
        }
      }
    }
    catch {
      // 登出清理失败不阻断主流程；缓存条目仍会按 principal 删除。
    }
  }
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
