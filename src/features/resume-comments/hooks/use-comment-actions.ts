import type { ResumeCommentThread } from '../types.ts'
import { useCallback, useState } from 'react'
import supabase from '@/lib/supabase/client'
import { ensureAnonymousCommentIdentity } from '../api/anonymous-identity.ts'
import {
  ResumeCommentClientError,
} from '../api/client.ts'
import { useResumeCommentContext } from '../context.tsx'

export function useCommentActions() {
  const { client, store } = useResumeCommentContext()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const prepareActor = useCallback(async () => {
    const access = client.getAccessContext()
    if (access.kind !== 'share')
      return
    if (!access.commentsEnabled)
      throw new ResumeCommentClientError('comments_disabled', '当前分享已关闭评论')
    const { data } = await supabase.auth.getSession()
    if (!data.session)
      await ensureAnonymousCommentIdentity(client, access.shareId)
  }, [client])

  const refreshThreads = useCallback(async (eventSeq?: number) => {
    const lastEventSeq = store.getState().lastEventSeq
    const response = await client.listThreads(lastEventSeq)
    store.getState().replaceThreads({
      threads: response.data.threads,
      events: response.data.events,
      eventSeq: response.eventSeq,
    })
    if (eventSeq !== undefined)
      store.getState().markReadLocally(eventSeq)
  }, [client, store])

  const execute = useCallback(async <T>(
    action: string,
    operation: () => Promise<{ data: T, eventSeq: number }>,
  ) => {
    setPendingAction(action)
    setErrorMessage(null)
    try {
      await prepareActor()
      const response = await operation()
      await refreshThreads(response.eventSeq)
      return response
    }
    catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '评论操作失败，请稍后重试')
      return null
    }
    finally {
      setPendingAction(null)
    }
  }, [prepareActor, refreshThreads])

  const createThread = useCallback(async (body: string) => {
    const state = store.getState()
    if (!state.selection || !state.scope)
      return null
    const response = await execute('create_thread', () => client.createThread({
      anchor: state.selection!.anchor,
      body,
      documentHash: state.scope!.documentHash,
      originalPageIndex: state.selection!.originalPageIndex,
    }))
    if (response) {
      store.getState().setSelection(null)
      store.getState().clearDraft('new-thread')
      const threadId = String(response.data.threadId ?? '')
      store.getState().setActiveThread(threadId || null)
    }
    return response
  }, [client, execute, store])

  const createReply = useCallback(async (thread: ResumeCommentThread, body: string) => {
    const response = await execute('create_reply', () => client.createReply(thread, body))
    if (response)
      store.getState().clearDraft(`reply:${thread.id}`)
    return response
  }, [client, execute, store])

  const editComment = useCallback(async (
    thread: ResumeCommentThread,
    commentId: string,
    body: string,
  ) => {
    const response = await execute('edit_comment', () => client.editComment(thread, commentId, body))
    if (response)
      store.getState().clearDraft(`edit:${commentId}`)
    return response
  }, [client, execute, store])

  return {
    pendingAction,
    errorMessage,
    clearError: () => setErrorMessage(null),
    refreshThreads,
    createThread,
    createReply,
    editComment,
    deleteComment: (thread: ResumeCommentThread, commentId: string) => execute(
      'delete_comment',
      () => client.deleteComment(thread, commentId),
    ),
    deleteThread: (thread: ResumeCommentThread) => execute(
      'delete_thread',
      () => client.deleteThread(thread),
    ),
    resolveThread: (thread: ResumeCommentThread) => execute(
      'resolve_thread',
      () => client.resolveThread(thread),
    ),
    reopenThread: (thread: ResumeCommentThread) => execute(
      'reopen_thread',
      () => client.reopenThread(thread),
    ),
    relinkThread: (thread: ResumeCommentThread) => {
      const state = store.getState()
      if (!state.selection || !state.scope)
        return Promise.resolve(null)
      return execute('relink_anchor', () => client.relinkAnchor(
        thread,
        state.selection!.anchor,
        state.scope!.documentHash,
      )).then((response) => {
        if (response)
          store.getState().setSelection(null)
        return response
      })
    },
  }
}
