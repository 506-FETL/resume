import { useCallback } from 'react'
import type {
  CommentMutationResult,
  CommentResponseTelemetry,
} from '../../api/client.ts'
import { ResumeCommentClientError } from '../../api/client.ts'
import { beginCommentPerformance } from '../../api/performance.ts'
import { useResumeCommentContext } from '../../context.tsx'
import type { ResumeCommentThread } from '../../types.ts'
import { CommentScopeChangedError } from './helpers'
import type { useCommentActor } from './use-comment-access'

export function useCommentMutation(
  setPendingAction: (value: string | null) => void,
  setErrorMessage: (value: string | null) => void,
  prepareActor: ReturnType<typeof useCommentActor>,
) {
  const { beforeWrite, invalidateAccess, store } = useResumeCommentContext()

  const execute = useCallback(
    async (
      entityKey: string,
      operation: () => Promise<{
        data: CommentMutationResult
        eventSeq: number
        requestId: string | null
        serverTiming: string | null
        telemetry?: CommentResponseTelemetry | null
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

        return (
          currentState.scope?.id === mutationScopeId &&
          currentState.scopeEpoch === mutationScopeEpoch
        )
      }

      const assertMutationScopeCurrent = () => {
        if (!isMutationScopeCurrent()) throw new CommentScopeChangedError()
      }

      setPendingAction(entityKey)
      setErrorMessage(null)

      const snapshot = store.getState().applyOptimisticMutation({
        entityKey,
        ...optimistic,
      })

      const marker = beginCommentPerformance('mutation')

      try {
        if (requiresDocumentSync) await beforeWrite?.()

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
          response.data.event.threadId &&
          (response.data.event.type === 'thread_created' ||
            response.data.event.type === 'comment_replied')
        ) {
          store
            .getState()
            .markThreadReadLocally(
              response.data.event.threadId,
              response.eventSeq,
            )
        }

        marker.end({
          requestId: response.requestId,
          serverTiming: response.serverTiming,
          telemetry: response.telemetry,
        })

        return response
      } catch (error) {
        if (
          error instanceof ResumeCommentClientError &&
          error.code === 'not_found' &&
          onIdempotentNotFound &&
          isMutationScopeCurrent()
        ) {
          // 删除已经在其他端完成时保留本地乐观结果，并按幂等成功收敛。
          store.getState().finishPending(entityKey)
          onIdempotentNotFound()
          marker.end({ detail: { status: 'already_deleted' } })

          return null
        }
        if (
          error instanceof ResumeCommentClientError &&
          (error.code === 'stale_release' || error.code === 'share_unavailable')
        ) {
          invalidateAccess?.(error.code)
        }

        const message =
          error instanceof Error ? error.message : '评论操作失败，请稍后重试'

        if (isMutationScopeCurrent())
          store.getState().rollbackMutation(entityKey, snapshot, message)

        setErrorMessage(message)

        return null
      } finally {
        setPendingAction(null)
      }
    },
    [
      beforeWrite,
      invalidateAccess,
      prepareActor,
      store,
      setPendingAction,
      setErrorMessage,
    ],
  )

  return { execute }
}
