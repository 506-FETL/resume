import type { CommentAccessContext, ResumeCommentClient } from '../api/client.ts'
import type { ResumeCommentStore } from '../store/types.ts'
import { useEffect } from 'react'
import { deriveCommentCacheKey, readCommentCache, readCommentReadCursor, rememberCommentVersionHint, writeCommentCache } from '../api/cache.ts'
import {
  isResumeCommentClientError,
} from '../api/client.ts'
import { beginCommentPerformance } from '../api/performance.ts'
import { decideCommentRealtimeRecovery } from '../api/realtime-recovery.ts'
import { ResumeCommentRealtimeSubscription } from '../api/realtime.ts'

interface UseCommentRealtimeOptions {
  client: ResumeCommentClient
  store: ResumeCommentStore
  enabled: boolean
  refreshAccess?: () => Promise<CommentAccessContext>
  onAccessInvalidated?: (reason: 'stale_release' | 'share_unavailable') => void
  accessIdentityKey: string
}

function accessChangedVersion(previous: CommentAccessContext, next: CommentAccessContext) {
  return previous.kind === 'share'
    && next.kind === 'share'
    && previous.versionId !== next.versionId
}

function isReadOnlyAccess(access: CommentAccessContext) {
  return (access.kind === 'share' && !access.commentsEnabled)
    || (access.kind === 'collaborator' && access.role === 'viewer')
}

function hasServerReadPrincipal(
  access: CommentAccessContext,
  authenticatedUserId: string | null,
) {
  return access.kind !== 'share'
    || Boolean(authenticatedUserId)
    || Boolean(access.anonymous)
}

export function useCommentRealtime({
  client,
  store,
  enabled,
  refreshAccess,
  onAccessInvalidated,
  accessIdentityKey,
}: UseCommentRealtimeOptions) {
  useEffect(() => {
    if (!enabled)
      return

    let cancelled = false
    let hasFreshBootstrap = false
    let queue = Promise.resolve()
    let bootstrap: () => Promise<void>
    const realtime = new ResumeCommentRealtimeSubscription(client)

    const handleError = (error: unknown) => {
      if (cancelled)
        return
      if (isResumeCommentClientError(error)) {
        if (error.code === 'stale_release' || error.code === 'share_unavailable') {
          store.getState().setAccessState('unavailable', error.code)
          onAccessInvalidated?.(error.code)
          realtime.disconnect()
          return
        }
        if (error.code === 'comments_disabled') {
          store.getState().setAccessState('read_only', error.code)
          return
        }
        store.getState().setAccessState(store.getState().accessState, error.code)
      }
      store.getState().setConnection('offline')
    }

    const enqueue = (action: () => Promise<void>) => {
      queue = queue.then(action).catch(handleError)
    }

    const refreshCurrentAccess = async () => {
      if (!refreshAccess)
        return true
      const previous = client.getAccessContext()
      const next = await refreshAccess()
      if (accessChangedVersion(previous, next)) {
        store.getState().setAccessState('unavailable', 'stale_release')
        onAccessInvalidated?.('stale_release')
        realtime.disconnect()
        return false
      }
      client.setAccessContext(next)
      store.getState().setAccessState(
        isReadOnlyAccess(next) ? 'read_only' : 'active',
      )
      return true
    }

    const recoverIncrementally = async () => {
      const marker = beginCommentPerformance('realtime_recovery')
      marker.countRequest()
      const lastEventSeq = store.getState().lastEventSeq
      const list = await client.listEvents(lastEventSeq)
      if (cancelled)
        return
      store.getState().applyRealtimePatch({
        threads: list.data.threads,
        events: list.data.events,
        eventSeq: list.eventSeq,
      })
      marker.end({
        requestId: list.requestId,
        serverTiming: list.serverTiming,
      })
    }

    const connectRealtime = (scopeRealtime: Parameters<typeof realtime.connect>[0]) => {
      realtime.connect(scopeRealtime, {
        onInvalidation: (event) => {
          enqueue(async () => {
            if (event.type === 'settings_changed' && !await refreshCurrentAccess())
              return
            const lastEventSeq = store.getState().lastEventSeq
            const recovery = decideCommentRealtimeRecovery(lastEventSeq, event.eventSeq)
            if (recovery === 'ignore')
              return
            await recoverIncrementally()
          })
        },
        onProtocolMismatch: () => enqueue(bootstrap),
        onStatusChange: status => store.getState().setConnection(status),
      })
    }

    bootstrap = async () => {
      store.getState().setConnection('connecting')
      const marker = beginCommentPerformance('bootstrap')
      marker.countRequest()
      const responsePromise = client.bootstrapScope()
      const authenticatedUserIdPromise = client.getAuthenticatedUserId()
      const response = await responsePromise
      if (cancelled)
        return
      hasFreshBootstrap = true
      marker.mergeClientDurations(response.telemetry.clientDurations)
      const authenticatedUserId = await authenticatedUserIdPromise
      if (cancelled)
        return
      const access = client.getAccessContext()
      rememberCommentVersionHint(access, response.data.version.versionId)
      const cacheKey = deriveCommentCacheKey(
        access,
        response.data.version.versionId,
        authenticatedUserId,
      )
      const persistedReadEventSeq = cacheKey ? readCommentReadCursor(cacheKey) : 0
      const cached = cacheKey ? await readCommentCache(cacheKey) : null
      const cachedThreadReadStates = cached?.value.threadReadStates ?? []
      const serverThreadReadStateById = new Map(
        response.data.threadReadStates.map(state => [state.threadId, state]),
      )
      const mergedThreadReadStates = response.data.threadReadStates.map((state) => {
        const cachedState = cachedThreadReadStates.find(item => item.threadId === state.threadId)
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
      })
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
        store.getState().setAccessState(
          isReadOnlyAccess(access) ? 'read_only' : 'active',
        )
      })
      marker.measureSync(
        'realtime_connect',
        () => connectRealtime(response.data.scopeRealtime),
      )
      marker.end({
        requestId: response.requestId,
        serverTiming: response.serverTiming,
        telemetry: response.telemetry,
        detail: { threadCount: response.data.threads.length },
      })
      if (cacheKey) {
        // eslint-disable-next-line no-void
        void writeCommentCache(cacheKey, {
          ...response.data,
          threadReadStates: mergedThreadReadStates,
        }).catch(() => undefined)
      }
      if (
        persistedReadEventSeq > response.data.lastReadEventSeq
        && hasServerReadPrincipal(access, authenticatedUserId)
      ) {
        // 本机已读游标领先时补偿同步到服务端，覆盖上一次网络中断的回执失败。
        // eslint-disable-next-line no-void
        void client.markRead(persistedReadEventSeq).catch(() => undefined)
      }
      if (hasServerReadPrincipal(access, authenticatedUserId)) {
        for (const cachedState of cachedThreadReadStates) {
          const serverState = serverThreadReadStateById.get(cachedState.threadId)
          if (cachedState.lastReadEventSeq > (serverState?.lastReadEventSeq ?? 0)) {
            client.markThreadRead(
              cachedState.threadId,
              cachedState.lastReadEventSeq,
            ).catch(() => undefined)
          }
        }
      }
    }

    const hydrateCache = async () => {
      const cacheKey = deriveCommentCacheKey(
        client.getAccessContext(),
        undefined,
        await client.getAuthenticatedUserId(),
      )
      if (!cacheKey)
        return
      const marker = beginCommentPerformance('cache')
      const cached = await readCommentCache(cacheKey)
      if (!cached || cancelled || hasFreshBootstrap) {
        marker.end({ detail: { status: cached ? 'superseded' : 'miss' } })
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

    const handleOffline = () => {
      realtime.disconnect()
      store.getState().setConnection('offline')
    }
    const handleOnline = () => enqueue(bootstrap)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    enqueue(async () => {
      if (navigator.onLine) {
        const bootstrapPromise = bootstrap()
        const cacheHydrationPromise = hydrateCache().catch(() => undefined)
        await Promise.all([
          bootstrapPromise,
          cacheHydrationPromise,
        ])
      }
      else {
        await hydrateCache().catch(() => undefined).finally(handleOffline)
      }
    })

    const refreshTimer = refreshAccess
      ? window.setInterval(() => {
          enqueue(async () => {
            await refreshCurrentAccess()
          })
        }, 60_000)
      : null

    return () => {
      cancelled = true
      realtime.disconnect()
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if (refreshTimer)
        window.clearInterval(refreshTimer)
    }
  }, [accessIdentityKey, client, enabled, onAccessInvalidated, refreshAccess, store])
}
