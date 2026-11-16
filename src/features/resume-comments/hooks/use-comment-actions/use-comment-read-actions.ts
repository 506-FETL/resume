import { useCallback } from 'react'
import {
  updateCommentCacheReadCursor,
  updateCommentCacheThreadReadCursor,
} from '../../api/cache.ts'
import { useResumeCommentContext } from '../../context.tsx'
import { CommentScopeChangedError } from './helpers'
import type { useCommentReadContext } from './use-comment-access'

export function useCommentReadActions(
  setPendingAction: (value: string | null) => void,
  setErrorMessage: (value: string | null) => void,
  resolveReadContext: ReturnType<typeof useCommentReadContext>,
) {
  const { client, store } = useResumeCommentContext()

  const markThreadRead = useCallback(
    async (threadId: string) => {
      const state = store.getState()
      const readState = state.threadReadStateById[threadId]

      if (!readState) return
      if (
        readState.latestCommentEventSeq <=
        Math.max(readState.lastReadEventSeq, state.lastReadEventSeq)
      ) {
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

          return (
            current.scope?.id === readContext.scopeId &&
            current.scopeEpoch === readContext.scopeEpoch
          )
        }

        if (!isReadContextCurrent()) throw new CommentScopeChangedError()

        const { cacheKey, hasServerPrincipal } = readContext

        if (cacheKey) {
          await updateCommentCacheThreadReadCursor(cacheKey, threadId, eventSeq)
        }
        if (!isReadContextCurrent()) throw new CommentScopeChangedError()

        let scopeLastReadEventSeq: number | undefined

        if (hasServerPrincipal) {
          const response = await client.markThreadRead(threadId, eventSeq)

          if (!isReadContextCurrent()) return

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
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : '标记评论已读失败',
        )
      } finally {
        setPendingAction(null)
      }
    },
    [client, resolveReadContext, store, setPendingAction, setErrorMessage],
  )

  const markAllRead = useCallback(async () => {
    const eventSeq = store.getState().lastEventSeq

    store.getState().markAllReadLocally(eventSeq)
    setPendingAction('comments:mark-all-read')
    setErrorMessage(null)

    try {
      const readContext = await resolveReadContext()

      const isReadContextCurrent = () => {
        const current = store.getState()

        return (
          current.scope?.id === readContext.scopeId &&
          current.scopeEpoch === readContext.scopeEpoch
        )
      }

      if (!isReadContextCurrent()) throw new CommentScopeChangedError()

      const { cacheKey, hasServerPrincipal } = readContext

      if (cacheKey) await updateCommentCacheReadCursor(cacheKey, eventSeq)
      if (!isReadContextCurrent()) throw new CommentScopeChangedError()
      if (hasServerPrincipal) await client.markRead(eventSeq)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '全部标记已读失败',
      )
    } finally {
      setPendingAction(null)
    }
  }, [client, resolveReadContext, store, setPendingAction, setErrorMessage])

  return { markThreadRead, markAllRead }
}
