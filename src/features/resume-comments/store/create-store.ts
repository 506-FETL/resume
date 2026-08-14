import type { ResumeCommentThread } from '../types.ts'
import type { ResumeCommentStore, ResumeCommentStoreState } from './types.ts'
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
  return createStore<ResumeCommentStoreState>()((set, get) => ({
    scope: null,
    version: null,
    counts: { unresolved: 0, resolved: 0, detached: 0 },
    accessibleScopes: [],
    threadsById: {},
    orderedThreadIds: [],
    events: [],
    activeThreadId: null,
    hoveredThreadId: null,
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
    pendingEntities: {},
    mutationErrors: {},
    contentNotice: null,

    replaceScope: input => set((state) => {
      const scopeChanged = state.scope?.id !== input.scope.id
      const lastReadEventSeq = scopeChanged
        ? input.lastReadEventSeq
        : Math.max(state.lastReadEventSeq, input.lastReadEventSeq)
      const draftsByScopeId = state.scope
        ? { ...state.draftsByScopeId, [state.scope.id]: state.draftsByThreadKey }
        : state.draftsByScopeId
      return {
        scope: input.scope,
        version: input.version,
        counts: input.counts,
        accessibleScopes: input.accessibleScopes.map(scope => scope.id === input.scope.id
          ? {
              ...scope,
              lastReadEventSeq: Math.max(scope.lastReadEventSeq, lastReadEventSeq),
            }
          : scope),
        threadsById: indexThreads(input.threads),
        orderedThreadIds: orderThreads(input.threads, input.scope),
        events: input.events ?? [],
        activeThreadId: scopeChanged ? null : state.activeThreadId,
        hoveredThreadId: scopeChanged ? null : state.hoveredThreadId,
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
        // 同一 scope 的已读游标只能前进，避免较旧缓存或并发 bootstrap
        // 把刚刚在界面里确认过的已读状态回滚成“有新评论”。
        lastReadEventSeq,
        lastError: null,
        pendingEntities: {},
        mutationErrors: {},
        contentNotice: null,
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
    applyMutation: input => set((state) => {
      const threadsById = { ...state.threadsById }
      if (input.removedThreadId)
        delete threadsById[input.removedThreadId]
      if (input.thread)
        threadsById[input.thread.id] = input.thread
      const threads = Object.values(threadsById)
      return {
        threadsById,
        orderedThreadIds: orderThreads(threads, state.scope),
        counts: input.counts,
        events: [...state.events, input.event].slice(-500),
        lastEventSeq: Math.max(state.lastEventSeq, input.eventSeq),
        activeThreadId: input.removedThreadId === state.activeThreadId
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
      if (input.removedThreadId)
        delete threadsById[input.removedThreadId]
      if (input.thread)
        threadsById[input.thread.id] = input.thread
      set({
        threadsById,
        orderedThreadIds: orderThreads(Object.values(threadsById), state.scope),
        counts: input.counts ?? state.counts,
        pendingEntities: { ...state.pendingEntities, [input.entityKey]: true },
        mutationErrors: Object.fromEntries(
          Object.entries(state.mutationErrors).filter(([key]) => key !== input.entityKey),
        ),
      })
      return snapshot
    },
    commitMutation: (entityKey, input) => {
      get().applyMutation(input)
      get().finishPending(entityKey)
    },
    rollbackMutation: (entityKey, snapshot, message) => set(state => ({
      ...snapshot,
      pendingEntities: Object.fromEntries(
        Object.entries(state.pendingEntities).filter(([key]) => key !== entityKey),
      ),
      mutationErrors: { ...state.mutationErrors, [entityKey]: message },
    })),
    applyRealtimePatch: input => set((state) => {
      const threadsById = { ...state.threadsById }
      for (const event of input.events) {
        if (event.type === 'thread_deleted' && event.threadId)
          delete threadsById[event.threadId]
      }
      for (const thread of input.threads)
        threadsById[thread.id] = thread
      const uniqueEvents = new Map(state.events.map(event => [event.eventSeq, event]))
      for (const event of input.events)
        uniqueEvents.set(event.eventSeq, event)
      return {
        threadsById,
        orderedThreadIds: orderThreads(Object.values(threadsById), state.scope),
        events: [...uniqueEvents.values()]
          .sort((left, right) => left.eventSeq - right.eventSeq)
          .slice(-500),
        lastEventSeq: Math.max(state.lastEventSeq, input.eventSeq),
      }
    }),
    applyDocumentSync: input => set((state) => {
      const threadsById = { ...state.threadsById }
      for (const thread of input.threads)
        threadsById[thread.id] = thread
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
        orderedThreadIds: orderThreads(Object.values(threadsById), state.scope),
        counts: input.counts,
        events: [...state.events, input.event].slice(-500),
        lastEventSeq: Math.max(state.lastEventSeq, input.eventSeq),
      }
    }),
    beginPending: entityKey => set(state => ({
      pendingEntities: { ...state.pendingEntities, [entityKey]: true },
      mutationErrors: Object.fromEntries(
        Object.entries(state.mutationErrors).filter(([key]) => key !== entityKey),
      ),
    })),
    finishPending: entityKey => set((state) => {
      const pendingEntities = { ...state.pendingEntities }
      const mutationErrors = { ...state.mutationErrors }
      delete pendingEntities[entityKey]
      delete mutationErrors[entityKey]
      return { pendingEntities, mutationErrors }
    }),
    failPending: (entityKey, message) => set((state) => {
      const pendingEntities = { ...state.pendingEntities }
      delete pendingEntities[entityKey]
      return {
        pendingEntities,
        mutationErrors: { ...state.mutationErrors, [entityKey]: message },
      }
    }),
    setContentNotice: contentNotice => set({ contentNotice }),
    setActiveThread: threadId => set({ activeThreadId: threadId }),
    setHoveredThread: threadId => set({ hoveredThreadId: threadId }),
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
      version: null,
      counts: { unresolved: 0, resolved: 0, detached: 0 },
      threadsById: {},
      orderedThreadIds: [],
      events: [],
      activeThreadId: null,
      hoveredThreadId: null,
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
      pendingEntities: {},
      mutationErrors: {},
      contentNotice: null,
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
