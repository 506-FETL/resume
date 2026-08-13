import type { ResumeCommentThread } from '../types.ts'
import type {
  ResumeCommentStore,
  ResumeCommentStoreState,
} from './types.ts'
import { createStore } from 'zustand/vanilla'

function orderThreads(threads: ResumeCommentThread[]) {
  return [...threads]
    .sort((left, right) => {
      const resolvedDifference = Number(Boolean(left.resolvedAt)) - Number(Boolean(right.resolvedAt))
      if (resolvedDifference !== 0)
        return resolvedDifference
      return Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
    })
    .map(thread => thread.id)
}

function indexThreads(threads: ResumeCommentThread[]) {
  return Object.fromEntries(threads.map(thread => [thread.id, thread]))
}

export function createResumeCommentStore(): ResumeCommentStore {
  return createStore<ResumeCommentStoreState>()((set, get) => ({
    scope: null,
    accessibleScopes: [],
    threadsById: {},
    orderedThreadIds: [],
    events: [],
    activeThreadId: null,
    selection: null,
    draftsByThreadKey: {},
    preserveDraftsOnNextScope: false,
    lastEventSeq: 0,
    lastReadEventSeq: 0,
    highlightsHidden: false,
    connection: 'idle',
    accessState: 'active',
    lastError: null,

    replaceScope: input => set((state) => {
      const scopeChanged = state.scope !== null && state.scope.id !== input.scope.id
      return {
        scope: input.scope,
        accessibleScopes: input.accessibleScopes,
        threadsById: indexThreads(input.threads),
        orderedThreadIds: orderThreads(input.threads),
        events: input.events ?? [],
        activeThreadId: scopeChanged ? null : state.activeThreadId,
        selection: scopeChanged ? null : state.selection,
        // 草稿按 scope 隔离；如果服务端返回了另一个 scope，不把旧草稿带过去。
        draftsByThreadKey: scopeChanged && !state.preserveDraftsOnNextScope
          ? {}
          : state.draftsByThreadKey,
        preserveDraftsOnNextScope: false,
        lastEventSeq: input.eventSeq,
        lastReadEventSeq: input.lastReadEventSeq,
        lastError: null,
      }
    }),
    replaceThreads: input => set({
      threadsById: indexThreads(input.threads),
      orderedThreadIds: orderThreads(input.threads),
      events: input.events,
      lastEventSeq: input.eventSeq,
      lastError: null,
    }),
    setActiveThread: threadId => set({ activeThreadId: threadId }),
    setSelection: selection => set({ selection }),
    setDraft: (threadKey, value) => set(state => ({
      draftsByThreadKey: { ...state.draftsByThreadKey, [threadKey]: value },
    })),
    clearDraft: threadKey => set((state) => {
      const drafts = { ...state.draftsByThreadKey }
      delete drafts[threadKey]
      return { draftsByThreadKey: drafts }
    }),
    preserveDraftsForNextScope: () => set({ preserveDraftsOnNextScope: true }),
    setHighlightsHidden: hidden => set({ highlightsHidden: hidden }),
    setConnection: connection => set({ connection }),
    setAccessState: (accessState, lastError = null) => set({ accessState, lastError }),
    markReadLocally: eventSeq => set({
      lastReadEventSeq: Math.max(get().lastReadEventSeq, eventSeq),
    }),
  }))
}
