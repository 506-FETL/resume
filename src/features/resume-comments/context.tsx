import type { ReactNode } from 'react'
import type { CommentAccessContext } from './api/client.ts'
import type { ResumeCommentStoreState } from './store/types.ts'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { attachStoredAnonymousCommentIdentity } from './api/anonymous-identity.ts'
import { ResumeCommentClient } from './api/client.ts'
import { useCommentReadReceipt, useCommentRealtime } from './hooks/use-comment-realtime.ts'
import { createResumeCommentStore } from './store/create-store.ts'

interface ResumeCommentContextValue {
  client: ResumeCommentClient
  store: ReturnType<typeof createResumeCommentStore>
  beforeWrite?: () => Promise<void>
  invalidateAccess?: (reason: 'stale_release' | 'share_unavailable') => void
  panelHeaderContent?: ReactNode
}

const ResumeCommentContext = createContext<ResumeCommentContextValue | null>(null)

export interface ResumeCommentProviderProps {
  access: CommentAccessContext
  children: ReactNode
  enabled?: boolean
  commentsVisible?: boolean
  refreshAccess?: () => Promise<CommentAccessContext>
  onAccessInvalidated?: (reason: 'stale_release' | 'share_unavailable') => void
  beforeWrite?: () => Promise<void>
  panelHeaderContent?: ReactNode
}

function attachVersionAnonymousCredential(client: ResumeCommentClient, access: CommentAccessContext) {
  if (access.kind === 'share')
    attachStoredAnonymousCommentIdentity(client, access.versionId)
}

function getAccessIdentityKey(access: CommentAccessContext) {
  if (access.kind === 'owner') {
    return `owner:${'scopeId' in access
      ? `scope:${access.scopeId}`
      : 'versionId' in access
        ? `version:${access.versionId}`
        : `resume:${access.resumeId}`}`
  }
  if (access.kind === 'collaborator')
    return `collaborator:${access.sessionId}:${access.resumeId}:${access.userId}`
  // 15 分钟访问令牌只是同一发布批次的凭据轮换，不能被当成 scope 切换，
  // 否则每次心跳刷新都会清空本地草稿和当前线程。
  return `share-version:${access.versionId}`
}

export function ResumeCommentProvider({
  access,
  children,
  enabled = true,
  commentsVisible = false,
  refreshAccess,
  onAccessInvalidated,
  beforeWrite,
  panelHeaderContent,
}: ResumeCommentProviderProps) {
  const [store] = useState(createResumeCommentStore)
  const [client] = useState(() => {
    const value = new ResumeCommentClient(access)
    attachVersionAnonymousCredential(value, access)
    return value
  })
  const accessIdentityKey = getAccessIdentityKey(access)
  const previousAccessIdentityKey = useRef(accessIdentityKey)

  useEffect(() => {
    if (previousAccessIdentityKey.current !== accessIdentityKey) {
      store.getState().beginScopeSwitch()
      previousAccessIdentityKey.current = accessIdentityKey
    }
    client.setAccessContext(access)
    attachVersionAnonymousCredential(client, access)
  }, [access, accessIdentityKey, client, store])

  const handleAccessInvalidated = useCallback((reason: 'stale_release' | 'share_unavailable') => {
    store.getState().setAccessState('unavailable', reason)
    if (reason === 'stale_release')
      store.getState().preserveDraftsForNextScope()
    onAccessInvalidated?.(reason)
  }, [onAccessInvalidated, store])

  useCommentRealtime({
    accessIdentityKey,
    client,
    store,
    enabled,
    refreshAccess,
    onAccessInvalidated: handleAccessInvalidated,
  })
  useCommentReadReceipt({ client, store, visible: enabled && commentsVisible })

  const value = useMemo(() => ({
    beforeWrite,
    client,
    invalidateAccess: handleAccessInvalidated,
    panelHeaderContent,
    store,
  }), [beforeWrite, client, handleAccessInvalidated, panelHeaderContent, store])
  return <ResumeCommentContext value={value}>{children}</ResumeCommentContext>
}

export function useResumeCommentContext() {
  const context = use(ResumeCommentContext)
  if (!context)
    throw new Error('useResumeCommentContext 必须在 ResumeCommentProvider 内使用')
  return context
}

export function useResumeCommentStore<T>(selector: (state: ResumeCommentStoreState) => T) {
  const { store } = useResumeCommentContext()
  return useStore(store, selector)
}

export function useResumeCommentClient() {
  return useResumeCommentContext().client
}
