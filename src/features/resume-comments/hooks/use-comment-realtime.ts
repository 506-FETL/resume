import type { CommentAccessContext, ResumeCommentClient } from '../api/client.ts'
import type { ResumeCommentStore } from '../store/types.ts'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import {
  deriveCommentCacheKey,
  readCommentCache,
  rememberCommentVersionHint,
  writeCommentCache,
} from '../api/cache.ts'
import {
  isResumeCommentClientError,
} from '../api/client.ts'
import { beginCommentPerformance } from '../api/performance.ts'
import { decideCommentRealtimeRecovery } from '../api/realtime-recovery.ts'
import {
  ResumeCommentRealtimeSubscription,
} from '../api/realtime.ts'

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
      marker.end(list.requestId)
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
      const response = await client.bootstrapScope()
      if (cancelled)
        return
      store.getState().replaceScope({
        scope: response.data.scope,
        version: response.data.version,
        counts: response.data.counts,
        accessibleScopes: response.data.accessibleScopes,
        threads: response.data.threads,
        eventSeq: response.eventSeq,
        lastReadEventSeq: response.data.lastReadEventSeq,
      })
      const access = client.getAccessContext()
      store.getState().setAccessState(
        isReadOnlyAccess(access) ? 'read_only' : 'active',
      )
      connectRealtime(response.data.scopeRealtime)
      const authenticatedUserId = await client.getAuthenticatedUserId()
      rememberCommentVersionHint(access, response.data.version.versionId)
      const cacheKey = deriveCommentCacheKey(
        access,
        response.data.version.versionId,
        authenticatedUserId,
      )
      if (cacheKey)
        writeCommentCache(cacheKey, response.data).catch(() => undefined)
      marker.end(response.requestId)
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
      if (!cached || cancelled)
        return
      store.getState().replaceScope({
        scope: cached.value.scope,
        version: cached.value.version,
        counts: cached.value.counts,
        accessibleScopes: cached.value.accessibleScopes,
        threads: cached.value.threads,
        eventSeq: cached.value.scope.nextEventSeq,
        lastReadEventSeq: cached.value.lastReadEventSeq,
      })
      marker.end()
    }

    const handleOffline = () => {
      realtime.disconnect()
      store.getState().setConnection('offline')
    }
    const handleOnline = () => enqueue(bootstrap)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    enqueue(async () => {
      await hydrateCache()
      if (navigator.onLine)
        await bootstrap()
      else
        handleOffline()
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

export function useCommentReadReceipt({
  client,
  store,
  visible,
}: {
  client: ResumeCommentClient
  store: ResumeCommentStore
  visible: boolean
}) {
  const lastEventSeq = useStore(store, state => state.lastEventSeq)
  const lastReadEventSeq = useStore(store, state => state.lastReadEventSeq)
  const accessState = useStore(store, state => state.accessState)

  useEffect(() => {
    if (
      !visible
      || accessState === 'unavailable'
      || lastEventSeq <= lastReadEventSeq
      || document.visibilityState !== 'visible'
    ) {
      return
    }
    const timer = window.setTimeout(() => {
      client.markRead(lastEventSeq)
        .then(() => store.getState().markReadLocally(lastEventSeq))
        .catch(() => {
          // 未登录且尚未创建匿名身份的只读访问者没有 principal，保持未读即可。
        })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [accessState, client, lastEventSeq, lastReadEventSeq, store, visible])
}
