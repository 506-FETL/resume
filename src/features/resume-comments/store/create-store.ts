import type { ResumeCommentThread } from '../types.ts'
import type {
  ResumeCommentStore,
  ResumeCommentStoreState,
} from './types.ts'
import { createStore } from 'zustand/vanilla'

function orderThreads(
  threads: ResumeCommentThread[],
  scope: ResumeCommentStoreState['scope'],
) {
  const nodeOrder = new Map(scope?.nodeOrder?.map((nodeKey, index) => [nodeKey, index]) ?? [])
  return [...threads]
    .sort((left, right) => {
      const resolvedDifference = Number(Boolean(left.resolvedAt)) - Number(Boolean(right.resolvedAt))
      if (resolvedDifference !== 0)
        return resolvedDifference
      if (scope?.kind === 'share_release')
        return Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
      const nodeDifference = (nodeOrder.get(left.anchor.nodeKey) ?? Number.MAX_SAFE_INTEGER)
        - (nodeOrder.get(right.anchor.nodeKey) ?? Number.MAX_SAFE_INTEGER)
      if (nodeDifference !== 0)
        return nodeDifference
      const offsetDifference = left.anchor.startGraphemeOffset - right.anchor.startGraphemeOffset
      if (offsetDifference !== 0)
        return offsetDifference
      return Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
    })
    .map(thread => thread.id)
}

function indexThreads(threads: ResumeCommentThread[]) {
  return Object.fromEntries(threads.map(thread => [thread.id, thread]))
}

export function createResumeCommentStore(): ResumeCommentStore {
  return createStore<ResumeCommentStoreState>()(set => ({
    scope: null,
    accessibleScopes: [],
    threadsById: {},
    orderedThreadIds: [],
    events: [],
    activeThreadId: null,
    selection: null,
    draftsByThreadKey: {},
    draftsByScopeId: {},
    preserveDraftsOnNextScope: false,
    relinkThreadId: null,
    relinkError: null,
    lastEventSeq: 0,
    lastReadEventSeq: 0,
    highlightsHidden: false,
    connection: 'idle',
    accessState: 'active',
    lastError: null,

    replaceScope: input => set((state) => {
      const scopeChanged = state.scope?.id !== input.scope.id
      const draftsByScopeId = state.scope
        ? { ...state.draftsByScopeId, [state.scope.id]: state.draftsByThreadKey }
        : state.draftsByScopeId
      return {
        scope: input.scope,
        accessibleScopes: input.accessibleScopes,
        threadsById: indexThreads(input.threads),
        orderedThreadIds: orderThreads(input.threads, input.scope),
        events: input.events ?? [],
        activeThreadId: scopeChanged ? null : state.activeThreadId,
        selection: scopeChanged ? null : state.selection,
        draftsByScopeId,
        // 草稿按 scope 隔离保存；stale release 切换时允许显式携带当前草稿。
        draftsByThreadKey: scopeChanged
          ? state.preserveDraftsOnNextScope
            ? state.draftsByThreadKey
            : (draftsByScopeId[input.scope.id] ?? {})
          : state.draftsByThreadKey,
        preserveDraftsOnNextScope: false,
        relinkThreadId: scopeChanged ? null : state.relinkThreadId,
        relinkError: scopeChanged ? null : state.relinkError,
        lastEventSeq: input.eventSeq,
        lastReadEventSeq: input.lastReadEventSeq,
        lastError: null,
      }
    }),
    replaceThreads: input => set(state => ({
      threadsById: indexThreads(input.threads),
      orderedThreadIds: orderThreads(input.threads, state.scope),
      events: input.events,
      accessibleScopes: state.scope
        ? state.accessibleScopes.map(scope => scope.id === state.scope!.id
            ? { ...scope, nextEventSeq: input.eventSeq }
            : scope)
        : state.accessibleScopes,
      lastEventSeq: input.eventSeq,
      lastError: null,
    })),
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
    beginScopeSwitch: () => set(state => ({
      scope: null,
      threadsById: {},
      orderedThreadIds: [],
      events: [],
      activeThreadId: null,
      selection: null,
      draftsByScopeId: state.scope
        ? { ...state.draftsByScopeId, [state.scope.id]: state.draftsByThreadKey }
        : state.draftsByScopeId,
      draftsByThreadKey: state.preserveDraftsOnNextScope ? state.draftsByThreadKey : {},
      relinkThreadId: null,
      relinkError: null,
      lastEventSeq: 0,
      lastReadEventSeq: 0,
      connection: 'connecting',
    })),
    beginRelink: relinkThreadId => set({ relinkThreadId, relinkError: null, selection: null }),
    cancelRelink: () => set({ relinkThreadId: null, relinkError: null, selection: null }),
    setRelinkError: relinkError => set({ relinkError }),
    setHighlightsHidden: hidden => set({ highlightsHidden: hidden }),
    setConnection: connection => set({ connection }),
    setAccessState: (accessState, lastError = null) => set({ accessState, lastError }),
    markReadLocally: eventSeq => set((state) => {
      const lastReadEventSeq = Math.max(state.lastReadEventSeq, eventSeq)
      return {
        lastReadEventSeq,
        accessibleScopes: state.scope
          ? state.accessibleScopes.map(scope => scope.id === state.scope!.id
              ? { ...scope, lastReadEventSeq }
              : scope)
          : state.accessibleScopes,
      }
    }),
  }))
}
