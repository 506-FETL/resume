import type { ResumeCommentStore, ResumeCommentStoreState } from '../types.ts'

export function createInteractionActions(
  set: ResumeCommentStore['setState'],
  get: ResumeCommentStore['getState'],
): Pick<
  ResumeCommentStoreState,
  | 'beginPending'
  | 'finishPending'
  | 'failPending'
  | 'setContentNotice'
  | 'setActiveThread'
  | 'setHoveredThread'
  | 'setSelection'
  | 'setDraft'
  | 'clearDraft'
  | 'preserveDraftsForNextScope'
  | 'beginRelink'
  | 'cancelRelink'
  | 'setRelinkError'
  | 'setHighlightsHidden'
  | 'setConnection'
  | 'setAccessState'
  | 'markReadLocally'
  | 'markThreadReadLocally'
  | 'markAllReadLocally'
> {
  return {
    beginPending: (entityKey) =>
      set((state) => ({
        pendingEntities: { ...state.pendingEntities, [entityKey]: true },
        mutationErrors: Object.fromEntries(
          Object.entries(state.mutationErrors).filter(
            ([key]) => key !== entityKey,
          ),
        ),
      })),
    finishPending: (entityKey) =>
      set((state) => {
        const pendingEntities = { ...state.pendingEntities }
        const mutationErrors = { ...state.mutationErrors }

        delete pendingEntities[entityKey]
        delete mutationErrors[entityKey]

        return { pendingEntities, mutationErrors }
      }),
    failPending: (entityKey, message) =>
      set((state) => {
        const pendingEntities = { ...state.pendingEntities }

        delete pendingEntities[entityKey]

        return {
          pendingEntities,
          mutationErrors: { ...state.mutationErrors, [entityKey]: message },
        }
      }),
    setContentNotice: (contentNotice) => set({ contentNotice }),
    setActiveThread: (threadId) => set({ activeThreadId: threadId }),
    setHoveredThread: (threadId) => set({ hoveredThreadId: threadId }),
    setSelection: (selection) => set({ selection }),
    setDraft: (threadKey, value) =>
      set((state) => ({
        draftsByThreadKey: { ...state.draftsByThreadKey, [threadKey]: value },
      })),
    clearDraft: (threadKey) =>
      set((state) => {
        const drafts = { ...state.draftsByThreadKey }

        delete drafts[threadKey]

        return { draftsByThreadKey: drafts }
      }),
    preserveDraftsForNextScope: () => set({ preserveDraftsOnNextScope: true }),
    beginRelink: (relinkThreadId) =>
      set({ relinkThreadId, relinkError: null, selection: null }),
    cancelRelink: () =>
      set({ relinkThreadId: null, relinkError: null, selection: null }),
    setRelinkError: (relinkError) => set({ relinkError }),
    setHighlightsHidden: (hidden) => set({ highlightsHidden: hidden }),
    setConnection: (connection) => set({ connection }),
    setAccessState: (accessState, lastError = null) =>
      set({ accessState, lastError }),
    markReadLocally: (eventSeq) =>
      set((state) => {
        const lastReadEventSeq = Math.max(state.lastReadEventSeq, eventSeq)

        return {
          lastReadEventSeq,
          accessibleScopes: state.scope
            ? state.accessibleScopes.map((scope) =>
                scope.id === state.scope!.id
                  ? { ...scope, lastReadEventSeq }
                  : scope,
              )
            : state.accessibleScopes,
        }
      }),
    markThreadReadLocally: (threadId, eventSeq) => {
      const state = get()
      const current = state.threadReadStateById[threadId]

      set({
        threadReadStateById: {
          ...state.threadReadStateById,
          [threadId]: {
            threadId,
            latestCommentEventSeq: Math.max(
              current?.latestCommentEventSeq ?? 0,
              eventSeq,
            ),
            lastReadEventSeq: Math.max(
              current?.lastReadEventSeq ?? 0,
              eventSeq,
            ),
          },
        },
      })
    },
    markAllReadLocally: (eventSeq) => {
      const state = get()

      set({
        lastReadEventSeq: Math.max(state.lastReadEventSeq, eventSeq),
        threadReadStateById: Object.fromEntries(
          Object.entries(state.threadReadStateById).map(
            ([threadId, threadState]) => [
              threadId,
              {
                ...threadState,
                lastReadEventSeq: Math.max(
                  threadState.lastReadEventSeq,
                  threadState.latestCommentEventSeq,
                ),
              },
            ],
          ),
        ),
        accessibleScopes: state.scope
          ? state.accessibleScopes.map((scope) =>
              scope.id === state.scope!.id
                ? {
                    ...scope,
                    lastReadEventSeq: Math.max(
                      scope.lastReadEventSeq,
                      eventSeq,
                    ),
                  }
                : scope,
            )
          : state.accessibleScopes,
      })
    },
  }
}
