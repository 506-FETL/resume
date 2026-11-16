import type { CommentThreadReadState } from '../../types.ts'
import type { CachedCommentBootstrap, CommentCacheEntry } from './types'

export function isCommentCacheEntryCompatible(
  value: unknown,
): value is CommentCacheEntry {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { protocolVersion?: unknown }).protocolVersion === 1
  )
}

export function normalizeCachedThreadReadStates(value: CachedCommentBootstrap) {
  return Array.isArray(value.threadReadStates) ? value.threadReadStates : []
}

export function mergeCachedThreadReadStates(
  current: CommentThreadReadState[],
  incoming: CommentThreadReadState[],
  liveThreadIds: ReadonlySet<string>,
) {
  const merged = new Map(
    current
      .filter((state) => liveThreadIds.has(state.threadId))
      .map((state) => [state.threadId, state]),
  )

  for (const state of incoming) {
    if (!liveThreadIds.has(state.threadId)) continue

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

export function advanceCommentReadCursor(
  value: CachedCommentBootstrap,
  eventSeq: number,
): CachedCommentBootstrap {
  const lastReadEventSeq = Math.max(value.lastReadEventSeq, eventSeq)

  return {
    ...value,
    lastReadEventSeq,
    accessibleScopes: value.accessibleScopes.map((scope) =>
      scope.id === value.scope.id
        ? {
            ...scope,
            lastReadEventSeq: Math.max(
              scope.lastReadEventSeq,
              lastReadEventSeq,
            ),
          }
        : scope,
    ),
  }
}
