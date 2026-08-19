import type { CommentMutationResult } from '../api/client.ts'
import type { PendingCommentCreationSnapshot } from '../store/types.ts'
import type { CommentThreadCounts, ResumeCommentThread } from '../types.ts'
import { useCallback, useState } from 'react'
import { ensureAnonymousCommentIdentity } from '../api/anonymous-identity.ts'
import {
  deleteCommentCache,
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

function countsAfterThreadRemoval(
  thread: ResumeCommentThread,
  counts: CommentThreadCounts,
) {
  if (thread.anchorStatus === 'detached')
    return { ...counts, detached: Math.max(0, counts.detached - 1) }
  if (thread.resolvedAt)
    return { ...counts, resolved: Math.max(0, counts.resolved - 1) }
  return { ...counts, unresolved: Math.max(0, counts.unresolved - 1) }
}

export function useCommentActions() {
  const { beforeWrite, client, invalidateAccess, store } = useResumeCommentContext()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resolveReadContext = useCallback(async () => {
    const access = client.getAccessContext()
    const state = store.getState()
    const versionId = state.version?.versionId
    const scopeId = state.scope?.id ?? null
    const scopeEpoch = state.scopeEpoch
    const authenticatedUserId = await client.getAuthenticatedUserId()
    return {
      access,
      authenticatedUserId,
      scopeId,
      scopeEpoch,
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
    const [response, readContext] = await Promise.all([
      client.listEvents(lastEventSeq),
      resolveReadContext().catch(() => null),
    ])

    store.getState().applyRealtimePatch({
      threads: response.data.threads,
      events: response.data.events,
      eventSeq: response.eventSeq,
    })

    if (response.data.events.length > 0 && readContext?.cacheKey)
      await deleteCommentCache(readContext.cacheKey).catch(() => undefined)

    if (eventSeq !== undefined)
      store.getState().markReadLocally(eventSeq)
  }, [client, resolveReadContext, store])

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
    onIdempotentNotFound?: () => void,
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
        && error.code === 'not_found'
        && onIdempotentNotFound
        && isMutationScopeCurrent()
      ) {
        // 删除已经在其他端完成时保留本地乐观结果，并按幂等成功收敛。
        store.getState().finishPending(entityKey)
        onIdempotentNotFound()
        marker.end({ detail: { status: 'already_deleted' } })
        return null
      }
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
    store.getState().markThreadReadLocally(threadId, eventSeq)
    const entityKey = `thread:${threadId}:read`
    setPendingAction(entityKey)
    setErrorMessage(null)
    try {
      const readContext = await resolveReadContext()
      const isReadContextCurrent = () => {
        const current = store.getState()
        return current.scope?.id === readContext.scopeId
          && current.scopeEpoch === readContext.scopeEpoch
      }
      if (!isReadContextCurrent())
        throw new CommentScopeChangedError()
      const { cacheKey, hasServerPrincipal } = readContext
      if (cacheKey) {
        await updateCommentCacheThreadReadCursor(
          cacheKey,
          threadId,
          eventSeq,
        )
      }
      if (!isReadContextCurrent())
        throw new CommentScopeChangedError()
      let scopeLastReadEventSeq: number | undefined
      if (hasServerPrincipal) {
        const response = await client.markThreadRead(threadId, eventSeq)
        if (!isReadContextCurrent())
          return
        const value = Number(response.data.scopeLastReadEventSeq)
        if (Number.isSafeInteger(value) && value >= 0) {
          scopeLastReadEventSeq = value
          store.getState().markReadLocally(value)
        }
      }
      if (cacheKey && scopeLastReadEventSeq !== undefined) {
        await updateCommentCacheThreadReadCursor(
          cacheKey,
          threadId,
          eventSeq,
          scopeLastReadEventSeq,
        )
      }
    }
    catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '标记评论已读失败')
    }
    finally {
      setPendingAction(null)
    }
  }, [client, resolveReadContext, store])

  const markAllRead = useCallback(async () => {
    const eventSeq = store.getState().lastEventSeq
    store.getState().markAllReadLocally(eventSeq)
    setPendingAction('comments:mark-all-read')
    setErrorMessage(null)
    try {
      const readContext = await resolveReadContext()
      const isReadContextCurrent = () => {
        const current = store.getState()
        return current.scope?.id === readContext.scopeId
          && current.scopeEpoch === readContext.scopeEpoch
      }
      if (!isReadContextCurrent())
        throw new CommentScopeChangedError()
      const { cacheKey, hasServerPrincipal } = readContext
      if (cacheKey)
        await updateCommentCacheReadCursor(cacheKey, eventSeq)
      if (!isReadContextCurrent())
        throw new CommentScopeChangedError()
      if (hasServerPrincipal)
        await client.markRead(eventSeq)
    }
    catch (error) {
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

  const deleteComment = useCallback(async (
    thread: ResumeCommentThread,
    commentId: string,
  ) => {
    let alreadyDeleted = false
    const cacheKeyPromise = resolveReadContext()
      .then(context => context.cacheKey)
      .catch(() => null)
    const response = await execute(
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
      () => {
        alreadyDeleted = true
      },
    )
    const cacheKey = await cacheKeyPromise
    if (cacheKey)
      await deleteCommentCache(cacheKey).catch(() => undefined)
    return response ?? (alreadyDeleted ? true : null)
  }, [client, execute, resolveReadContext])

  const deleteThread = useCallback(async (thread: ResumeCommentThread) => {
    let alreadyDeleted = false
    const cacheKeyPromise = resolveReadContext()
      .then(context => context.cacheKey)
      .catch(() => null)
    const response = await execute(
      `thread:${thread.id}:delete`,
      () => client.deleteThread(thread),
      false,
      {
        removedThreadId: thread.id,
        counts: countsAfterThreadRemoval(thread, store.getState().counts),
      },
      () => {
        alreadyDeleted = true
      },
    )
    const cacheKey = await cacheKeyPromise
    if (cacheKey)
      await deleteCommentCache(cacheKey).catch(() => undefined)
    return response ?? (alreadyDeleted ? true : null)
  }, [client, execute, resolveReadContext, store])

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
    deleteComment,
    deleteThread,
    // 解决 / 重开：不做乐观更新。点击后仅进入 pending（按钮置灰 + loading），
    // 待服务端确认成功后由 commitMutation 应用（移除 / 恢复简历高亮与计数），
    // 避免「后端还没响应就先把渲染中的评论去掉」。
    resolveThread: (thread: ResumeCommentThread) => execute(
      `thread:${thread.id}:resolve`,
      () => client.resolveThread(thread),
    ),
    reopenThread: (thread: ResumeCommentThread) => execute(
      `thread:${thread.id}:reopen`,
      () => client.reopenThread(thread),
    ),
    relinkThread: (thread: ResumeCommentThread) => {
      const state = store.getState()
      if (!state.selection || !state.scope)
        return Promise.resolve(null)
      const selection = state.selection
      // 不做乐观更新：重新关联期间保持 pending（提示栏 + 按钮 loading），
      // 待服务端确认后由 commitMutation 应用新锚点，避免界面无反馈或提前改状态。
      return execute(`thread:${thread.id}:relink`, () => client.relinkAnchor(
        thread,
        {
          ...selection.anchor,
          createdAtContentHash: store.getState().scope!.documentHash,
        },
        store.getState().scope!.documentHash,
      ), true).then((response) => {
        if (response)
          store.getState().setSelection(null)
        return response
      })
    },
  }
}
