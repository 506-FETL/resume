import { useCallback } from 'react'
import { ResumeCommentClientError } from '../../api/client.ts'
import { beginCommentPerformance } from '../../api/performance.ts'
import { useResumeCommentContext } from '../../context.tsx'
import type {
  PendingCommentCreation,
  PendingCommentCreationSnapshot,
} from '../../store/types.ts'
import type { ResumeCommentThread } from '../../types.ts'
import { getPendingCommentAuthor } from './helpers'
import type { useCommentActor } from './use-comment-access'

export function useCommentCreation(
  setErrorMessage: (value: string | null) => void,
  prepareActor: ReturnType<typeof useCommentActor>,
) {
  const { beforeWrite, client, invalidateAccess, store } =
    useResumeCommentContext()

  const sendPendingCreation = useCallback(
    async (requestId: string) => {
      const pending = store.getState().markPendingCreationSending(requestId)

      if (!pending) return

      const isPendingScopeCurrent = (creation: PendingCommentCreation) => {
        const state = store.getState()

        return (
          state.scope?.id === creation.scopeId &&
          state.scopeEpoch === creation.scopeEpoch
        )
      }

      const marker = beginCommentPerformance('mutation')

      try {
        if (pending.kind === 'thread') await beforeWrite?.()
        if (!isPendingScopeCurrent(pending)) {
          marker.end({ detail: { status: 'superseded' } })

          return
        }

        await prepareActor()

        if (!isPendingScopeCurrent(pending)) {
          marker.end({ detail: { status: 'superseded' } })

          return
        }

        marker.countRequest()

        const response =
          pending.kind === 'thread'
            ? await client.createThread({
                requestId: pending.requestId,
                anchor: {
                  ...pending.anchor,
                  createdAtContentHash: store.getState().scope!.documentHash,
                },
                body: pending.body,
                documentHash: store.getState().scope!.documentHash,
                originalPageIndex: pending.originalPageIndex,
              })
            : await client.createReply(
                { id: pending.threadId, revision: pending.threadRevision },
                pending.body,
                pending.parentCommentId,
                pending.requestId,
              )

        if (!isPendingScopeCurrent(pending)) {
          marker.end({ detail: { status: 'superseded' } })

          return
        }

        store.getState().settlePendingCreation(requestId, {
          thread: response.data.thread,
          counts: response.data.counts,
          event: response.data.event,
          eventSeq: response.eventSeq,
        })

        if (response.data.event.threadId) {
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
      } catch (error) {
        if (
          error instanceof ResumeCommentClientError &&
          (error.code === 'stale_release' || error.code === 'share_unavailable')
        ) {
          invalidateAccess?.(error.code)
        }

        const message =
          error instanceof Error ? error.message : '评论发送失败，请稍后重试'

        if (isPendingScopeCurrent(pending))
          store.getState().failPendingCreation(requestId, message)

        marker.end({ detail: { status: 'failed' } })
      }
    },
    [beforeWrite, client, invalidateAccess, prepareActor, store],
  )

  const createThread = useCallback(
    async (body: string, creationSnapshot?: PendingCommentCreationSnapshot) => {
      const state = store.getState()
      const selection = creationSnapshot?.selection ?? state.selection

      if (!selection || !state.scope) return null
      if (
        creationSnapshot &&
        (creationSnapshot.scopeId !== state.scope.id ||
          creationSnapshot.scopeEpoch !== state.scopeEpoch)
      ) {
        setErrorMessage('评论来源已切换，请在当前版本重新划词后评论')

        return null
      }

      const requestId = crypto.randomUUID()

      const pending = store.getState().enqueuePendingThread({
        requestId,
        scopeId: state.scope.id,
        scopeEpoch: state.scopeEpoch,
        anchor: {
          ...selection.anchor,
          createdAtContentHash: state.scope.documentHash,
        },
        body,
        author: getPendingCommentAuthor(),
        documentHash: state.scope.documentHash,
        originalPageIndex: selection.originalPageIndex,
        createdAt: new Date().toISOString(),
      })

      setErrorMessage(null)
      store.getState().setSelection(null)
      store.getState().clearDraft('new-thread')
      sendPendingCreation(requestId).catch(() => undefined)

      return pending
    },
    [sendPendingCreation, store, setErrorMessage],
  )

  const createReply = useCallback(
    async (
      thread: ResumeCommentThread,
      body: string,
      parentCommentId?: string,
    ) => {
      const state = store.getState()

      if (!state.scope || thread.localOnly) return null
      if (
        Object.values(state.pendingCreationsByRequestId).some(
          (pending) => pending.threadId === thread.id,
        )
      ) {
        return null
      }

      const resolvedParentCommentId =
        parentCommentId ??
        thread.comments.find(
          (comment) => comment.parentId === null && !comment.delivery,
        )?.id

      if (!resolvedParentCommentId) {
        setErrorMessage('回复目标不存在')

        return null
      }

      const requestId = crypto.randomUUID()

      const pending = store.getState().enqueuePendingReply({
        requestId,
        scopeId: state.scope.id,
        scopeEpoch: state.scopeEpoch,
        threadId: thread.id,
        parentCommentId: resolvedParentCommentId,
        threadRevision: thread.revision,
        documentHash: state.scope.documentHash,
        body,
        author: getPendingCommentAuthor(),
        createdAt: new Date().toISOString(),
      })

      if (!pending) return null

      setErrorMessage(null)

      store
        .getState()
        .clearDraft(`reply:${thread.id}:${parentCommentId ?? 'root'}`)

      sendPendingCreation(requestId).catch(() => undefined)

      return pending
    },
    [sendPendingCreation, store, setErrorMessage],
  )

  return { sendPendingCreation, createThread, createReply }
}
