import { useCallback, useState } from 'react'
import { deleteCommentCache } from '../../api/cache.ts'
import { useResumeCommentContext } from '../../context.tsx'
import type { ResumeCommentThread } from '../../types.ts'
import { countsAfterThreadRemoval } from './helpers'
import { useCommentActor, useCommentReadContext } from './use-comment-access'
import { useCommentCreation } from './use-comment-creation'
import { useCommentMutation } from './use-comment-mutation'
import { useCommentReadActions } from './use-comment-read-actions'

export function useCommentActions() {
  const { client, store } = useResumeCommentContext()

  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resolveReadContext = useCommentReadContext()
  const prepareActor = useCommentActor()

  const { markThreadRead, markAllRead } = useCommentReadActions(
    setPendingAction,
    setErrorMessage,
    resolveReadContext,
  )

  const { execute } = useCommentMutation(
    setPendingAction,
    setErrorMessage,
    prepareActor,
  )

  const { sendPendingCreation, createThread, createReply } = useCommentCreation(
    setErrorMessage,
    prepareActor,
  )

  const refreshThreads = useCallback(
    async (eventSeq?: number) => {
      const initialState = store.getState()
      const scopeId = initialState.scope?.id ?? null
      const scopeEpoch = initialState.scopeEpoch

      const isScopeCurrent = () => {
        const current = store.getState()

        return (
          (current.scope?.id ?? null) === scopeId &&
          current.scopeEpoch === scopeEpoch
        )
      }

      const lastEventSeq = initialState.lastEventSeq

      const [response, readContext] = await Promise.all([
        client.listEvents(lastEventSeq),
        resolveReadContext().catch(() => null),
      ])

      if (!isScopeCurrent()) return

      store.getState().applyRealtimePatch({
        threads: response.data.threads,
        events: response.data.events,
        eventSeq: response.eventSeq,
      })

      if (response.data.events.length > 0 && readContext?.cacheKey)
        await deleteCommentCache(readContext.cacheKey).catch(() => undefined)

      if (eventSeq !== undefined && isScopeCurrent())
        store.getState().markReadLocally(eventSeq)
    },
    [client, resolveReadContext, store],
  )

  const editComment = useCallback(
    async (thread: ResumeCommentThread, commentId: string, body: string) => {
      const optimisticThread = {
        ...thread,
        comments: thread.comments.map((comment) =>
          comment.id === commentId
            ? { ...comment, body, editedAt: new Date().toISOString() }
            : comment,
        ),
      }

      const response = await execute(
        `comment:${commentId}:edit`,
        () => client.editComment(thread, commentId, body),
        false,
        { thread: optimisticThread },
      )

      if (response) store.getState().clearDraft(`edit:${commentId}`)

      return response
    },
    [client, execute, store],
  )

  const deleteComment = useCallback(
    async (thread: ResumeCommentThread, commentId: string) => {
      let alreadyDeleted = false

      const cacheKeyPromise = resolveReadContext()
        .then((context) => context.cacheKey)
        .catch(() => null)

      const response = await execute(
        `comment:${commentId}:delete`,
        () => client.deleteComment(thread, commentId),
        false,
        {
          thread: {
            ...thread,
            comments: thread.comments.map((comment) =>
              comment.id === commentId
                ? { ...comment, body: '', deletedAt: new Date().toISOString() }
                : comment,
            ),
          },
        },
        () => {
          alreadyDeleted = true
        },
      )

      const cacheKey = await cacheKeyPromise

      if (cacheKey) await deleteCommentCache(cacheKey).catch(() => undefined)

      return response ?? (alreadyDeleted ? true : null)
    },
    [client, execute, resolveReadContext],
  )

  const deleteThread = useCallback(
    async (thread: ResumeCommentThread) => {
      let alreadyDeleted = false

      const cacheKeyPromise = resolveReadContext()
        .then((context) => context.cacheKey)
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

      if (cacheKey) await deleteCommentCache(cacheKey).catch(() => undefined)

      return response ?? (alreadyDeleted ? true : null)
    },
    [client, execute, resolveReadContext, store],
  )

  return {
    pendingAction,
    errorMessage,
    clearError: () => setErrorMessage(null),
    markThreadRead,
    markAllRead,
    refreshThreads,
    createThread,
    createReply,
    retryPendingCreation: sendPendingCreation,
    discardPendingCreation: (requestId: string) =>
      store.getState().discardPendingCreation(requestId),
    editComment,
    deleteComment,
    deleteThread,
    // 解决 / 重开：不做乐观更新。点击后仅进入 pending（按钮置灰 + loading），
    // 待服务端确认成功后由 commitMutation 应用（移除 / 恢复简历高亮与计数），
    // 避免「后端还没响应就先把渲染中的评论去掉」。
    resolveThread: (thread: ResumeCommentThread) =>
      execute(`thread:${thread.id}:resolve`, () =>
        client.resolveThread(thread),
      ),
    reopenThread: (thread: ResumeCommentThread) =>
      execute(`thread:${thread.id}:reopen`, () => client.reopenThread(thread)),
    relinkThread: (thread: ResumeCommentThread) => {
      const state = store.getState()

      if (!state.selection || !state.scope) return Promise.resolve(null)

      const selection = state.selection

      // 不做乐观更新：重新关联期间保持 pending（提示栏 + 按钮 loading），
      // 待服务端确认后由 commitMutation 应用新锚点，避免界面无反馈或提前改状态。
      return execute(
        `thread:${thread.id}:relink`,
        () =>
          client.relinkAnchor(
            thread,
            {
              ...selection.anchor,
              createdAtContentHash: store.getState().scope!.documentHash,
            },
            store.getState().scope!.documentHash,
          ),
        true,
      ).then((response) => {
        if (response) store.getState().setSelection(null)

        return response
      })
    },
  }
}
