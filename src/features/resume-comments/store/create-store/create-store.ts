import { createStore } from 'zustand/vanilla'
import type { ResumeCommentStore, ResumeCommentStoreState } from '../types.ts'
import { createCreationActions } from './creation-actions'
import { createInteractionActions } from './interaction-actions'
import { createScopeActions } from './scope-actions'
import { createThreadActions } from './thread-actions'

export function createResumeCommentStore(): ResumeCommentStore {
  return createStore<ResumeCommentStoreState>()((set, get) => ({
    scope: null,
    scopeEpoch: 0,
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
    threadReadStateById: {},
    highlightsHidden: false,
    connection: 'idle',
    accessState: 'active',
    lastError: null,
    pendingEntities: {},
    pendingCreationsByRequestId: {},
    commentRenderKeys: {},
    mutationErrors: {},
    contentNotice: null,
    ...createScopeActions(set),
    ...createThreadActions(set, get),
    ...createCreationActions(set, get),
    ...createInteractionActions(set, get),
  }))
}
