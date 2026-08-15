import type { CommentMutationResult } from '../api/client.ts'
import type { PendingCommentCreationSnapshot } from '../store/types.ts'
import type { ResumeCommentThread } from '../types.ts'
import { useCallback, useState } from 'react'
import { ensureAnonymousCommentIdentity } from '../api/anonymous-identity.ts'
import {
  deriveCommentCacheKey,
  updateCommentCacheReadCursor,
  updateCommentCacheThreadReadCursor,
} from '../api/cache.ts'
import { ResumeCommentClientError } from '../api/client.ts'
import { beginCommentPerformance } from '../api/performance.ts'
import { useResumeCommentContext } from '../context.tsx'

class CommentScopeChangedError extends Error {
  constructor() {
    super('评论来源已切换，请在当前版本重新操作')
    this.name = 'CommentScopeChangedError'
  }
}

export function useCommentActions() {
  const { beforeWrite, client, invalidateAccess, store } = useResumeCommentContext()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resolveReadContext = useCallback(async () => {
    const access = client.getAccessContext()
    const authenticatedUserId = await client.getAuthenticatedUserId()
    const versionId = store.getState().version?.versionId
    return {
      access,
      authenticatedUserId,
      cacheKey: deriveCommentCacheKey(access, versionId, authenticatedUserId),
      hasServerPrincipal: access.kind !== 'share'
        || Boolean(authenticatedUserId)
        || Boolean(access.anonymous),
    }
  }, [client, store])

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
    const initialState = store.getState()
    const mutationScopeId = initialState.scope?.id ?? null
    const mutationScopeEpoch = initialState.scopeEpoch
    const isMutationScopeCurrent = () => {
      const currentState = store.getState()
      return currentState.scope?.id === mutationScopeId
        && currentState.scopeEpoch === mutationScopeEpoch
    }
    const assertMutationScopeCurrent = () => {
      if (!isMutationScopeCurrent())
        throw new CommentScopeChangedError()
    }
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

      assertMutationScopeCurrent()
      await prepareActor()
      assertMutationScopeCurrent()

      marker.countRequest()
      const response = await operation()
      assertMutationScopeCurrent()

      store.getState().commitMutation(entityKey, {
        thread: response.data.thread,
        removedThreadId: optimistic?.removedThreadId,
        counts: response.data.counts,
        event: response.data.event,
        eventSeq: response.eventSeq,
      })
      if (
        response.data.event.threadId
        && (
          response.data.event.type === 'thread_created'
          || response.data.event.type === 'comment_replied'
        )
      ) {
        store.getState().markThreadReadLocally(
          response.data.event.threadId,
          response.eventSeq,
        )
      }
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
      if (isMutationScopeCurrent())
        store.getState().rollbackMutation(entityKey, snapshot, message)
      setErrorMessage(message)
      return null
    }
    finally {
      setPendingAction(null)
    }
  }, [beforeWrite, invalidateAccess, prepareActor, store])

  const markThreadRead = useCallback(async (threadId: string) => {
    const state = store.getState()
    const readState = state.threadReadStateById[threadId]
    if (!readState)
      return
    if (readState.latestCommentEventSeq <= Math.max(
      readState.lastReadEventSeq,
      state.lastReadEventSeq,
    )) {
      return
    }
    const eventSeq = readState.latestCommentEventSeq
    const snapshot = store.getState().markThreadReadLocally(threadId, eventSeq)
    const entityKey = `thread:${threadId}:read`
    setPendingAction(entityKey)
    setErrorMessage(null)
    try {
      const { cacheKey, hasServerPrincipal } = await resolveReadContext()
      let scopeLastReadEventSeq: number | undefined
      if (hasServerPrincipal) {
        const response = await client.markThreadRead(threadId, eventSeq)
        const value = Number(response.data.scopeLastReadEventSeq)
        if (Number.isSafeInteger(value) && value >= 0) {
          scopeLastReadEventSeq = value
          store.getState().markReadLocally(value)
        }
      }
      if (cacheKey) {
        await updateCommentCacheThreadReadCursor(
          cacheKey,
          threadId,
          eventSeq,
          scopeLastReadEventSeq,
        )
      }
    }
    catch (error) {
      store.getState().restoreReadSnapshot(snapshot)
      setErrorMessage(error instanceof Error ? error.message : '标记评论已读失败')
    }
    finally {
      setPendingAction(null)
    }
  }, [client, resolveReadContext, store])

  const markAllRead = useCallback(async () => {
    const eventSeq = store.getState().lastEventSeq
    const snapshot = store.getState().markAllReadLocally(eventSeq)
    setPendingAction('comments:mark-all-read')
    setErrorMessage(null)
    try {
      const { cacheKey, hasServerPrincipal } = await resolveReadContext()
      if (hasServerPrincipal)
        await client.markRead(eventSeq)
      if (cacheKey)
        await updateCommentCacheReadCursor(cacheKey, eventSeq)
    }
    catch (error) {
      store.getState().restoreReadSnapshot(snapshot)
      setErrorMessage(error instanceof Error ? error.message : '全部标记已读失败')
    }
    finally {
      setPendingAction(null)
    }
  }, [client, resolveReadContext, store])

  const createThread = useCallback(async (
    body: string,
    creationSnapshot?: PendingCommentCreationSnapshot,
  ) => {
    const state = store.getState()
    const selection = creationSnapshot?.selection ?? state.selection

    if (!selection || !state.scope)
      return null
    if (
      creationSnapshot
      && (
        creationSnapshot.scopeId !== state.scope.id
        || creationSnapshot.scopeEpoch !== state.scopeEpoch
      )
    ) {
      setErrorMessage('评论来源已切换，请在当前版本重新划词后评论')
      return null
    }

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
    markThreadRead,
    markAllRead,
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
