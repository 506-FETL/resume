import {
  captureCommentCacheWriteFence,
  deriveCommentCacheKey,
  mergeCachedThreadReadStates,
  pruneCommentThreadReadCursors,
  readCommentCache,
  readCommentReadCursor,
  readCommentThreadReadCursors,
  rememberCommentVersionHint,
  writeCommentCache,
} from '../../api/cache.ts'
import type { ResumeCommentClient } from '../../api/client.ts'
import { beginCommentPerformance } from '../../api/performance.ts'
import type { ResumeCommentRealtimeSubscription } from '../../api/realtime.ts'
import type { ResumeCommentStore } from '../../store/types.ts'
import { hasServerReadPrincipal, isReadOnlyAccess } from './access'

export function createCommentBootstrap(
  client: ResumeCommentClient,
  store: ResumeCommentStore,
  isStopped: () => boolean,
  connectRealtime: (
    scope: Parameters<ResumeCommentRealtimeSubscription['connect']>[0],
  ) => void,
) {
  const bootstrap = async () => {
    if (isStopped()) return

    store.getState().setConnection('connecting')

    const marker = beginCommentPerformance('bootstrap')

    marker.countRequest()

    const cacheWriteFence = captureCommentCacheWriteFence()
    const responsePromise = client.bootstrapScope()
    const authenticatedUserIdPromise = client.getAuthenticatedUserId()
    const response = await responsePromise

    if (isStopped()) return

    marker.mergeClientDurations(response.telemetry.clientDurations)

    const authenticatedUserId = await authenticatedUserIdPromise

    if (isStopped()) return

    const access = client.getAccessContext()

    rememberCommentVersionHint(access, response.data.version.versionId)

    const cacheKey = deriveCommentCacheKey(
      access,
      response.data.version.versionId,
      authenticatedUserId,
    )

    const persistedReadEventSeq = cacheKey ? readCommentReadCursor(cacheKey) : 0

    const cached = cacheKey ? await readCommentCache(cacheKey) : null

    if (isStopped()) return

    const liveThreadIds = new Set(
      response.data.threads.map((thread) => thread.id),
    )

    const cachedThreadReadStates = cacheKey
      ? mergeCachedThreadReadStates(
          cached?.value.threadReadStates ?? [],
          readCommentThreadReadCursors(cacheKey),
          liveThreadIds,
        )
      : []

    const serverThreadReadStateById = new Map(
      response.data.threadReadStates.map((state) => [state.threadId, state]),
    )

    const mergedThreadReadStates = response.data.threadReadStates.map(
      (state) => {
        const cachedState = cachedThreadReadStates.find(
          (item) => item.threadId === state.threadId,
        )

        return {
          ...state,
          latestCommentEventSeq: Math.max(
            state.latestCommentEventSeq,
            cachedState?.latestCommentEventSeq ?? 0,
          ),
          lastReadEventSeq: Math.max(
            state.lastReadEventSeq,
            cachedState?.lastReadEventSeq ?? 0,
          ),
        }
      },
    )

    const currentState = store.getState()
    const sameScope = currentState.scope?.id === response.data.scope.id

    const hasPendingMutation =
      Object.keys(currentState.pendingEntities).length > 0 ||
      Object.keys(currentState.pendingCreationsByRequestId).length > 0

    if (
      currentState.scope &&
      (!sameScope ||
        currentState.lastEventSeq > response.eventSeq ||
        hasPendingMutation)
    ) {
      if (sameScope) {
        marker.measureSync('realtime_connect', () =>
          connectRealtime(response.data.scopeRealtime),
        )
      }

      marker.end({
        requestId: response.requestId,
        serverTiming: response.serverTiming,
        telemetry: response.telemetry,
        detail: { status: 'superseded' },
      })

      return
    }
    if (cacheKey) pruneCommentThreadReadCursors(cacheKey, liveThreadIds)

    marker.measureSync('store_commit', () => {
      store.getState().replaceScope({
        scope: response.data.scope,
        version: response.data.version,
        counts: response.data.counts,
        accessibleScopes: response.data.accessibleScopes,
        threads: response.data.threads,
        eventSeq: response.eventSeq,
        lastReadEventSeq: Math.max(
          response.data.lastReadEventSeq,
          persistedReadEventSeq,
        ),
        threadReadStates: mergedThreadReadStates,
      })

      store
        .getState()
        .setAccessState(isReadOnlyAccess(access) ? 'read_only' : 'active')
    })

    marker.measureSync('realtime_connect', () =>
      connectRealtime(response.data.scopeRealtime),
    )

    marker.end({
      requestId: response.requestId,
      serverTiming: response.serverTiming,
      telemetry: response.telemetry,
      detail: { threadCount: response.data.threads.length },
    })

    if (cacheKey) {
      // eslint-disable-next-line no-void
      void writeCommentCache(
        cacheKey,
        {
          ...response.data,
          threadReadStates: mergedThreadReadStates,
        },
        cacheWriteFence,
      ).catch(() => undefined)
    }
    if (
      persistedReadEventSeq > response.data.lastReadEventSeq &&
      hasServerReadPrincipal(access, authenticatedUserId)
    ) {
      // 本机已读游标领先时补偿同步到服务端，覆盖上一次网络中断的回执失败。
      // eslint-disable-next-line no-void
      void client.markRead(persistedReadEventSeq).catch(() => undefined)
    }
    if (hasServerReadPrincipal(access, authenticatedUserId)) {
      for (const cachedState of cachedThreadReadStates) {
        const serverState = serverThreadReadStateById.get(cachedState.threadId)

        if (!serverState) continue
        if (
          cachedState.lastReadEventSeq > (serverState?.lastReadEventSeq ?? 0)
        ) {
          client
            .markThreadRead(cachedState.threadId, cachedState.lastReadEventSeq)
            .catch(() => undefined)
        }
      }
    }
  }

  const hydrateCache = async () => {
    if (isStopped()) return

    const cacheKey = deriveCommentCacheKey(
      client.getAccessContext(),
      undefined,
      await client.getAuthenticatedUserId(),
    )

    if (!cacheKey || isStopped()) return

    const marker = beginCommentPerformance('cache')
    const cached = await readCommentCache(cacheKey)

    if (!cached || isStopped()) {
      marker.end({ detail: { status: cached ? 'superseded' : 'miss' } })

      return
    }

    const currentState = store.getState()

    if (
      currentState.scope?.id === cached.value.scope.id &&
      (currentState.lastEventSeq > cached.value.scope.nextEventSeq ||
        Object.keys(currentState.pendingEntities).length > 0 ||
        Object.keys(currentState.pendingCreationsByRequestId).length > 0)
    ) {
      marker.end({ detail: { status: 'superseded' } })

      return
    }

    store.getState().replaceScope({
      scope: cached.value.scope,
      version: cached.value.version,
      counts: cached.value.counts,
      accessibleScopes: cached.value.accessibleScopes,
      threads: cached.value.threads,
      eventSeq: cached.value.scope.nextEventSeq,
      lastReadEventSeq: cached.value.lastReadEventSeq,
      threadReadStates: cached.value.threadReadStates,
    })

    marker.end({
      detail: {
        status: 'hit',
        ageMs: Math.max(0, Date.now() - cached.cachedAt),
        threadCount: cached.value.threads.length,
      },
    })
  }

  return { bootstrap, hydrateCache }
}
