import type { CommentAccessContext, ResumeCommentClient } from '../api/client.ts'
import type { ResumeCommentStore } from '../store/types.ts'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import {
  isResumeCommentClientError,
} from '../api/client.ts'
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

function accessChangedRelease(previous: CommentAccessContext, next: CommentAccessContext) {
  return previous.kind === 'share'
    && next.kind === 'share'
    && previous.releaseId !== next.releaseId
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
    const realtime = new ResumeCommentRealtimeSubscription(client)
    const ownerRealtime = new ResumeCommentRealtimeSubscription(client, 'owner')

    const handleError = (error: unknown) => {
      if (cancelled)
        return
      if (isResumeCommentClientError(error)) {
        if (error.code === 'stale_release' || error.code === 'share_unavailable') {
          store.getState().setAccessState('unavailable', error.code)
          onAccessInvalidated?.(error.code)
          realtime.disconnect()
          ownerRealtime.disconnect()
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
      if (accessChangedRelease(previous, next)) {
        store.getState().setAccessState('unavailable', 'stale_release')
        onAccessInvalidated?.('stale_release')
        realtime.disconnect()
        ownerRealtime.disconnect()
        return false
      }
      client.setAccessContext(next)
      store.getState().setAccessState(
        next.kind === 'share' && !next.commentsEnabled ? 'read_only' : 'active',
      )
      return true
    }

    const bootstrap = async () => {
      store.getState().setConnection('connecting')
      const response = await client.bootstrapScope()
      if (cancelled)
        return
      store.getState().replaceScope({
        scope: response.data.scope,
        accessibleScopes: response.data.accessibleScopes,
        threads: response.data.threads,
        eventSeq: response.eventSeq,
        lastReadEventSeq: response.data.lastReadEventSeq,
      })
      const access = client.getAccessContext()
      store.getState().setAccessState(
        access.kind === 'share' && !access.commentsEnabled ? 'read_only' : 'active',
      )
      realtime.connect(response.data.scopeRealtime, {
        onInvalidation: (event) => {
          enqueue(async () => {
            if (event.type === 'settings_changed') {
              if (!await refreshCurrentAccess())
                return
              await bootstrap()
              return
            }
            const lastEventSeq = store.getState().lastEventSeq
            const recovery = decideCommentRealtimeRecovery(lastEventSeq, event.eventSeq)
            if (recovery === 'ignore')
              return
            if (recovery === 'bootstrap') {
              await bootstrap()
              return
            }
            const list = await client.listThreads(lastEventSeq)
            if (cancelled)
              return
            store.getState().replaceThreads({
              threads: list.data.threads,
              events: list.data.events,
              eventSeq: list.eventSeq,
            })
          })
        },
        onProtocolMismatch: () => enqueue(bootstrap),
        onStatusChange: status => store.getState().setConnection(status),
      })
      if (response.data.ownerRealtime) {
        ownerRealtime.connect(response.data.ownerRealtime, {
          // Owner topic 汇总所有可访问 scope；事件序号不属于当前 scope，
          // 因此直接 bootstrap 刷新来源未读数，不与当前序号做比较。
          onInvalidation: () => enqueue(bootstrap),
          onProtocolMismatch: () => enqueue(bootstrap),
          onStatusChange: () => undefined,
        })
      }
      else {
        ownerRealtime.disconnect()
      }
    }

    const handleOffline = () => {
      realtime.disconnect()
      ownerRealtime.disconnect()
      store.getState().setConnection('offline')
    }
    const handleOnline = () => enqueue(bootstrap)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    if (navigator.onLine)
      enqueue(bootstrap)
    else
      handleOffline()

    const refreshTimer = refreshAccess
      ? window.setInterval(() => {
          enqueue(async () => {
            if (!await refreshCurrentAccess())
              return
            await bootstrap()
          })
        }, 60_000)
      : null

    return () => {
      cancelled = true
      realtime.disconnect()
      ownerRealtime.disconnect()
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
