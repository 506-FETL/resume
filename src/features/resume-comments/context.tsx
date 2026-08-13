import type { ReactNode } from 'react'
import type { CommentAccessContext } from './api/client.ts'
import type { ResumeCommentStoreState } from './store/types.ts'
import { createContext, use, useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { attachStoredAnonymousCommentIdentity } from './api/anonymous-identity.ts'
import { ResumeCommentClient } from './api/client.ts'
import {
  useCommentReadReceipt,
  useCommentRealtime,
} from './hooks/use-comment-realtime.ts'
import { createResumeCommentStore } from './store/create-store.ts'

/* eslint-disable react-refresh/only-export-components */

interface ResumeCommentContextValue {
  client: ResumeCommentClient
  store: ReturnType<typeof createResumeCommentStore>
}

const ResumeCommentContext = createContext<ResumeCommentContextValue | null>(null)

export interface ResumeCommentProviderProps {
  access: CommentAccessContext
  children: ReactNode
  enabled?: boolean
  commentsVisible?: boolean
  refreshAccess?: () => Promise<CommentAccessContext>
  onAccessInvalidated?: (reason: 'stale_release' | 'share_unavailable') => void
}

function attachLegacyAnonymousCredential(client: ResumeCommentClient, access: CommentAccessContext) {
  if (access.kind === 'share')
    attachStoredAnonymousCommentIdentity(client, access.shareId)
}

export function ResumeCommentProvider({
  access,
  children,
  enabled = true,
  commentsVisible = false,
  refreshAccess,
  onAccessInvalidated,
}: ResumeCommentProviderProps) {
  const [store] = useState(createResumeCommentStore)
  const [client] = useState(() => {
    const value = new ResumeCommentClient(access)
    attachLegacyAnonymousCredential(value, access)
    return value
  })

  useEffect(() => {
    client.setAccessContext(access)
    attachLegacyAnonymousCredential(client, access)
  }, [access, client])

  useCommentRealtime({
    client,
    store,
    enabled,
    refreshAccess,
    onAccessInvalidated,
  })
  useCommentReadReceipt({ client, store, visible: enabled && commentsVisible })

  const value = useMemo(() => ({ client, store }), [client, store])
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
