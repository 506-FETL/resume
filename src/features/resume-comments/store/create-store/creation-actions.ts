import {
  appendPendingReply,
  createPendingReplyRecord,
  createPendingThread,
  createPendingThreadRecord,
  removePendingCreationFromThreads,
  updatePendingCreationDelivery,
} from '../pending-creations.ts'
import { applyCommentEventsToThreadReadStates } from '../read-state.ts'
import type { ResumeCommentStore, ResumeCommentStoreState } from '../types.ts'
import { orderThreads } from './order-threads'

export function createCreationActions(
  set: ResumeCommentStore['setState'],
  get: ResumeCommentStore['getState'],
): Pick<
  ResumeCommentStoreState,
  | 'enqueuePendingThread'
  | 'enqueuePendingReply'
  | 'markPendingCreationSending'
  | 'failPendingCreation'
  | 'discardPendingCreation'
  | 'settlePendingCreation'
> {
  return {
    enqueuePendingThread: (input) => {
      const pending = createPendingThreadRecord(input)

      set((state) => {
        const thread = createPendingThread(pending)
        const threadsById = { ...state.threadsById, [thread.id]: thread }

        return {
          threadsById,
          orderedThreadIds: orderThreads(
            Object.values(threadsById),
            state.scope,
          ),
          activeThreadId: thread.id,
          pendingCreationsByRequestId: {
            ...state.pendingCreationsByRequestId,
            [pending.requestId]: pending,
          },
        }
      })

      return pending
    },
    enqueuePendingReply: (input) => {
      const state = get()
      const thread = state.threadsById[input.threadId]

      if (!thread || thread.localOnly) return null

      const pending = createPendingReplyRecord(input)

      set({
        threadsById: {
          ...state.threadsById,
          [thread.id]: appendPendingReply(thread, pending),
        },
        pendingCreationsByRequestId: {
          ...state.pendingCreationsByRequestId,
          [pending.requestId]: pending,
        },
      })

      return pending
    },
    markPendingCreationSending: (requestId) => {
      const state = get()
      const pending = state.pendingCreationsByRequestId[requestId]

      if (!pending) return null

      set({
        threadsById: updatePendingCreationDelivery(
          state.threadsById,
          pending,
          'sending',
          null,
        ),
      })

      return pending
    },
    failPendingCreation: (requestId, message) =>
      set((state) => {
        const pending = state.pendingCreationsByRequestId[requestId]

        return pending
          ? {
              threadsById: updatePendingCreationDelivery(
                state.threadsById,
                pending,
                'failed',
                message,
              ),
            }
          : {}
      }),
    discardPendingCreation: (requestId) =>
      set((state) => {
        const pending = state.pendingCreationsByRequestId[requestId]

        if (!pending) return {}

        const pendingCreationsByRequestId = {
          ...state.pendingCreationsByRequestId,
        }

        delete pendingCreationsByRequestId[requestId]

        const threadsById = removePendingCreationFromThreads(
          state.threadsById,
          pending,
        )

        return {
          threadsById,
          orderedThreadIds: orderThreads(
            Object.values(threadsById),
            state.scope,
          ),
          activeThreadId:
            pending.kind === 'thread' &&
            state.activeThreadId === pending.threadId
              ? null
              : state.activeThreadId,
          pendingCreationsByRequestId,
        }
      }),
    settlePendingCreation: (requestId, input) =>
      set((state) => {
        const pending = state.pendingCreationsByRequestId[requestId]

        const threadsById = pending
          ? removePendingCreationFromThreads(state.threadsById, pending)
          : { ...state.threadsById }

        if (input.thread) threadsById[input.thread.id] = input.thread

        const pendingCreationsByRequestId = {
          ...state.pendingCreationsByRequestId,
        }

        delete pendingCreationsByRequestId[requestId]

        const uniqueEvents = new Map(
          state.events.map((event) => [event.eventSeq, event]),
        )

        uniqueEvents.set(input.event.eventSeq, input.event)

        return {
          threadsById,
          orderedThreadIds: orderThreads(
            Object.values(threadsById),
            state.scope,
          ),
          counts: input.counts,
          events: [...uniqueEvents.values()]
            .sort((left, right) => left.eventSeq - right.eventSeq)
            .slice(-500),
          lastEventSeq: Math.max(state.lastEventSeq, input.eventSeq),
          threadReadStateById: applyCommentEventsToThreadReadStates(
            state.threadReadStateById,
            [input.event],
          ),
          activeThreadId:
            pending?.kind === 'thread' &&
            state.activeThreadId === pending.threadId
              ? (input.thread?.id ?? input.event.threadId)
              : state.activeThreadId,
          pendingCreationsByRequestId,
          commentRenderKeys:
            pending && input.event.commentId
              ? {
                  ...state.commentRenderKeys,
                  [input.event.commentId]: pending.commentId,
                }
              : state.commentRenderKeys,
        }
      }),
  }
}
