import type { CommentMutationResult } from '../api/client.ts'
import type { ResumeCommentThread } from '../types.ts'
import { useCallback, useState } from 'react'
import { ensureAnonymousCommentIdentity } from '../api/anonymous-identity.ts'
import { ResumeCommentClientError } from '../api/client.ts'
import { beginCommentPerformance } from '../api/performance.ts'
import { useResumeCommentContext } from '../context.tsx'

export function useCommentActions() {
  const { beforeWrite, client, invalidateAccess, store } = useResumeCommentContext()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const prepareActor = useCallback(async () => {
    const access = client.getAccessContext()

    if (access.kind !== 'share')
      return

    if (!access.commentsEnabled)
      throw new ResumeCommentClientError('comments_disabled', '当前分享已关闭评论')

    if (!await client.hasAuthenticatedSession())
      await ensureAnonymousCommentIdentity(client, access.versionId)
  }, [client])

  const refreshThreads = useCallback(async (eventSeq?: number) => {
    const lastEventSeq = store.getState().lastEventSeq
    const response = await client.listEvents(lastEventSeq)

    store.getState().applyRealtimePatch({
      threads: response.data.threads,
      events: response.data.events,
      eventSeq: response.eventSeq,
    })

    if (eventSeq !== undefined)
      store.getState().markReadLocally(eventSeq)
  }, [client, store])

  const execute = useCallback(async (
    entityKey: string,
    operation: () => Promise<{
      data: CommentMutationResult
      eventSeq: number
      requestId: string | null
      serverTiming: string | null
    }>,
    requiresDocumentSync = false,
    optimistic?: {
      thread?: ResumeCommentThread | null
      removedThreadId?: string | null
      counts?: ReturnType<typeof store.getState>['counts']
    },
  ) => {
    setPendingAction(entityKey)
    setErrorMessage(null)

    const snapshot = store.getState().applyOptimisticMutation({
      entityKey,
      ...optimistic,
    })
    const marker = beginCommentPerformance('mutation')

    try {
      if (requiresDocumentSync)
        await beforeWrite?.()

      await prepareActor()

      marker.countRequest()
      const response = await operation()

      store.getState().commitMutation(entityKey, {
        thread: response.data.thread,
        removedThreadId: optimistic?.removedThreadId,
        counts: response.data.counts,
        event: response.data.event,
        eventSeq: response.eventSeq,
      })
      store.getState().markReadLocally(response.eventSeq)
      marker.end({
        requestId: response.requestId,
        serverTiming: response.serverTiming,
      })

      return response
    }
    catch (error) {
      if (
        error instanceof ResumeCommentClientError
        && (error.code === 'stale_release' || error.code === 'share_unavailable')
      ) {
        invalidateAccess?.(error.code)
      }

      const message = error instanceof Error ? error.message : '评论操作失败，请稍后重试'
      store.getState().rollbackMutation(entityKey, snapshot, message)
      setErrorMessage(message)
      return null
    }
    finally {
      setPendingAction(null)
    }
  }, [beforeWrite, invalidateAccess, prepareActor, store])

  const createThread = useCallback(async (body: string) => {
    const state = store.getState()

    if (!state.selection || !state.scope)
      return null

    const selection = state.selection
    const response = await execute('thread:new:create', () => client.createThread({
      anchor: {
        ...selection.anchor,
        createdAtContentHash: store.getState().scope!.documentHash,
      },
      body,
      documentHash: store.getState().scope!.documentHash,
      originalPageIndex: selection.originalPageIndex,
    }), true)

    if (response) {
      store.getState().setSelection(null)
      store.getState().clearDraft('new-thread')
      const threadId = String(response.data.threadId ?? '')
      store.getState().setActiveThread(threadId || null)
    }
    return response
  }, [client, execute, store])

  const createReply = useCallback(async (
    thread: ResumeCommentThread,
    body: string,
    parentCommentId?: string,
  ) => {
    const response = await execute(
      `thread:${thread.id}:reply`,
      () => client.createReply(thread, body, parentCommentId),
    )

    if (response)
      store.getState().clearDraft(`reply:${thread.id}:${parentCommentId ?? 'root'}`)

    return response
  }, [client, execute, store])

  const editComment = useCallback(async (
    thread: ResumeCommentThread,
    commentId: string,
    body: string,
  ) => {
    const optimisticThread = {
      ...thread,
      comments: thread.comments.map(comment => comment.id === commentId
        ? { ...comment, body, editedAt: new Date().toISOString() }
        : comment),
    }

    const response = await execute(
      `comment:${commentId}:edit`,
      () => client.editComment(thread, commentId, body),
      false,
      { thread: optimisticThread },
    )

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
      `comment:${commentId}:delete`,
      () => client.deleteComment(thread, commentId),
      false,
      {
        thread: {
          ...thread,
          comments: thread.comments.map(comment => comment.id === commentId
            ? { ...comment, body: '', deletedAt: new Date().toISOString() }
            : comment),
        },
      },
    ),
    deleteThread: (thread: ResumeCommentThread) => execute(
      `thread:${thread.id}:delete`,
      () => client.deleteThread(thread),
      false,
      { removedThreadId: thread.id },
    ),
    resolveThread: (thread: ResumeCommentThread) => execute(
      `thread:${thread.id}:resolve`,
      () => client.resolveThread(thread),
      false,
      {
        thread: { ...thread, resolvedAt: new Date().toISOString() },
        counts: {
          ...store.getState().counts,
          unresolved: Math.max(0, store.getState().counts.unresolved - 1),
          resolved: store.getState().counts.resolved + 1,
        },
      },
    ),
    reopenThread: (thread: ResumeCommentThread) => execute(
      `thread:${thread.id}:reopen`,
      () => client.reopenThread(thread),
      false,
      {
        thread: { ...thread, resolvedAt: null, resolvedBy: null },
        counts: {
          ...store.getState().counts,
          unresolved: store.getState().counts.unresolved + 1,
          resolved: Math.max(0, store.getState().counts.resolved - 1),
        },
      },
    ),
    relinkThread: (thread: ResumeCommentThread) => {
      const state = store.getState()
      if (!state.selection || !state.scope)
        return Promise.resolve(null)
      const selection = state.selection
      return execute(`thread:${thread.id}:relink`, () => client.relinkAnchor(
        thread,
        {
          ...selection.anchor,
          createdAtContentHash: store.getState().scope!.documentHash,
        },
        store.getState().scope!.documentHash,
      ), true, {
        thread: {
          ...thread,
          anchor: {
            ...selection.anchor,
            createdAtContentHash: store.getState().scope!.documentHash,
          },
          anchorStatus: 'anchored',
        },
      }).then((response) => {
        if (response)
          store.getState().setSelection(null)
        return response
      })
    },
  }
}
