import {
  mergePendingCreationsIntoThreads,
  removePendingCreationFromThreads,
} from '../pending-creations.ts'
import { applyCommentEventsToThreadReadStates } from '../read-state.ts'
import type { ResumeCommentStore, ResumeCommentStoreState } from '../types.ts'
import { orderThreads } from './order-threads'

export function createThreadActions(
  set: ResumeCommentStore['setState'],
  get: ResumeCommentStore['getState'],
): Pick<
  ResumeCommentStoreState,
  | 'replaceThreads'
  | 'applyMutation'
  | 'applyOptimisticMutation'
  | 'commitMutation'
  | 'rollbackMutation'
  | 'applyRealtimePatch'
  | 'applyDocumentSync'
> {
  return {
    replaceThreads: (input) =>
      set((state) => {
        const threadsById = mergePendingCreationsIntoThreads(
          input.threads,
          state.threadsById,
          state.pendingCreationsByRequestId,
        )

        return {
          threadsById,
          orderedThreadIds: orderThreads(
            Object.values(threadsById),
            state.scope,
          ),
          events: input.events,
          accessibleScopes: state.scope
            ? state.accessibleScopes.map((scope) =>
                scope.id === state.scope!.id
                  ? { ...scope, nextEventSeq: input.eventSeq }
                  : scope,
              )
            : state.accessibleScopes,
          lastEventSeq: input.eventSeq,
          threadReadStateById: applyCommentEventsToThreadReadStates(
            state.threadReadStateById,
            input.events,
          ),
          lastError: null,
        }
      }),
    applyMutation: (input) =>
      set((state) => {
        const threadsById = { ...state.threadsById }

        if (input.removedThreadId) delete threadsById[input.removedThreadId]
        if (input.thread) threadsById[input.thread.id] = input.thread

        const threads = Object.values(threadsById)

        return {
          threadsById,
          orderedThreadIds: orderThreads(threads, state.scope),
          counts: input.counts,
          events: [...state.events, input.event].slice(-500),
          lastEventSeq: Math.max(state.lastEventSeq, input.eventSeq),
          threadReadStateById: applyCommentEventsToThreadReadStates(
            state.threadReadStateById,
            [input.event],
          ),
          activeThreadId:
            input.removedThreadId === state.activeThreadId
              ? null
              : state.activeThreadId,
        }
      }),
    applyOptimisticMutation: (input) => {
      const state = get()

      const snapshot = {
        threadsById: state.threadsById,
        orderedThreadIds: state.orderedThreadIds,
        counts: state.counts,
        activeThreadId: state.activeThreadId,
        hoveredThreadId: state.hoveredThreadId,
      }

      const threadsById = { ...state.threadsById }

      if (input.removedThreadId) delete threadsById[input.removedThreadId]
      if (input.thread) threadsById[input.thread.id] = input.thread

      set({
        threadsById,
        orderedThreadIds: orderThreads(Object.values(threadsById), state.scope),
        counts: input.counts ?? state.counts,
        pendingEntities: { ...state.pendingEntities, [input.entityKey]: true },
        mutationErrors: Object.fromEntries(
          Object.entries(state.mutationErrors).filter(
            ([key]) => key !== input.entityKey,
          ),
        ),
      })

      return snapshot
    },
    commitMutation: (entityKey, input) => {
      get().applyMutation(input)
      get().finishPending(entityKey)
    },
    rollbackMutation: (entityKey, snapshot, message) =>
      set((state) => ({
        ...snapshot,
        pendingEntities: Object.fromEntries(
          Object.entries(state.pendingEntities).filter(
            ([key]) => key !== entityKey,
          ),
        ),
        mutationErrors: { ...state.mutationErrors, [entityKey]: message },
      })),
    applyRealtimePatch: (input) =>
      set((state) => {
        let threadsById = { ...state.threadsById }

        const pendingCreationsByRequestId = {
          ...state.pendingCreationsByRequestId,
        }

        let activeThreadId = state.activeThreadId
        let commentRenderKeys = state.commentRenderKeys

        for (const event of input.events) {
          if (!event.clientRequestId) continue

          const pending = pendingCreationsByRequestId[event.clientRequestId]

          if (!pending) continue

          if (event.commentId)
            commentRenderKeys = {
              ...commentRenderKeys,
              [event.commentId]: pending.commentId,
            }

          threadsById = removePendingCreationFromThreads(threadsById, pending)

          if (pending.kind === 'thread' && activeThreadId === pending.threadId)
            activeThreadId = event.threadId

          delete pendingCreationsByRequestId[event.clientRequestId]
        }

        for (const event of input.events) {
          if (event.type === 'thread_deleted' && event.threadId)
            delete threadsById[event.threadId]
        }

        for (const thread of input.threads) threadsById[thread.id] = thread

        const uniqueEvents = new Map(
          state.events.map((event) => [event.eventSeq, event]),
        )

        for (const event of input.events)
          uniqueEvents.set(event.eventSeq, event)

        return {
          threadsById,
          orderedThreadIds: orderThreads(
            Object.values(threadsById),
            state.scope,
          ),
          events: [...uniqueEvents.values()]
            .sort((left, right) => left.eventSeq - right.eventSeq)
            .slice(-500),
          lastEventSeq: Math.max(state.lastEventSeq, input.eventSeq),
          threadReadStateById: applyCommentEventsToThreadReadStates(
            state.threadReadStateById,
            input.events,
          ),
          activeThreadId,
          pendingCreationsByRequestId,
          commentRenderKeys,
        }
      }),
    applyDocumentSync: (input) =>
      set((state) => {
        const threadsById = { ...state.threadsById }

        for (const thread of input.threads) threadsById[thread.id] = thread

        return {
          scope: state.scope
            ? {
                ...state.scope,
                documentHash: input.documentHash,
                documentRevision: input.documentRevision,
                nextEventSeq: input.eventSeq,
              }
            : null,
          version: state.version
            ? {
                ...state.version,
                documentHash: input.documentHash,
                documentRevision: input.documentRevision,
              }
            : null,
          threadsById,
          orderedThreadIds: orderThreads(
            Object.values(threadsById),
            state.scope,
          ),
          counts: input.counts,
          events: [...state.events, input.event].slice(-500),
          lastEventSeq: Math.max(state.lastEventSeq, input.eventSeq),
        }
      }),
  }
}
