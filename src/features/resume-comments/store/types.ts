import type { StoreApi } from 'zustand/vanilla'
import type { CommentAnchor } from '../anchors/types.ts'
import type {
  CommentErrorCode,
  CommentScopeKind,
  CommentThreadCounts,
  CommentVersionReference,
  ResumeCommentEvent,
  ResumeCommentThread,
} from '../types.ts'

export interface CommentScopeSummary {
  id: string
  kind: CommentScopeKind
  resumeId: string
  ownerUserId: string
  versionId: number
  documentHash: string
  documentRevision: number
  nodeOrder: string[]
  projectionReferenceDate: string
  nextEventSeq: number
}

export interface AccessibleCommentScopeSummary {
  id: string
  kind: CommentScopeKind
  resumeId: string
  versionId: number
  projectionReferenceDate: string
  documentRevision: number
  nextEventSeq: number
  lastReadEventSeq: number
  updatedAt: string
}

export interface PendingCommentSelection {
  anchor: CommentAnchor
  exactQuote: string
  originalPageIndex: number | null
  clientRects: Array<{
    top: number
    right: number
    bottom: number
    left: number
    width: number
    height: number
  }>
}

export type CommentConnectionState = 'idle' | 'connecting' | 'live' | 'offline'
export type CommentAccessState = 'active' | 'read_only' | 'unavailable'

export interface CommentMutationSnapshot {
  threadsById: Record<string, ResumeCommentThread>
  orderedThreadIds: string[]
  counts: CommentThreadCounts
  activeThreadId: string | null
}

export interface ResumeCommentStoreState {
  scope: CommentScopeSummary | null
  version: CommentVersionReference | null
  counts: CommentThreadCounts
  accessibleScopes: AccessibleCommentScopeSummary[]
  threadsById: Record<string, ResumeCommentThread>
  orderedThreadIds: string[]
  events: ResumeCommentEvent[]
  activeThreadId: string | null
  selection: PendingCommentSelection | null
  draftsByThreadKey: Record<string, string>
  draftsByScopeId: Record<string, Record<string, string>>
  preserveDraftsOnNextScope: boolean
  relinkThreadId: string | null
  relinkError: string | null
  lastEventSeq: number
  lastReadEventSeq: number
  highlightsHidden: boolean
  connection: CommentConnectionState
  accessState: CommentAccessState
  lastError: CommentErrorCode | null
  pendingEntities: Record<string, true>
  mutationErrors: Record<string, string>

  replaceScope: (input: {
    scope: CommentScopeSummary
    version: CommentVersionReference
    counts: CommentThreadCounts
    accessibleScopes: AccessibleCommentScopeSummary[]
    threads: ResumeCommentThread[]
    events?: ResumeCommentEvent[]
    eventSeq: number
    lastReadEventSeq: number
  }) => void
  replaceThreads: (input: {
    threads: ResumeCommentThread[]
    events: ResumeCommentEvent[]
    eventSeq: number
  }) => void
  applyMutation: (input: {
    thread: ResumeCommentThread | null
    removedThreadId?: string | null
    counts: CommentThreadCounts
    event: ResumeCommentEvent
    eventSeq: number
  }) => void
  applyOptimisticMutation: (input: {
    entityKey: string
    thread?: ResumeCommentThread | null
    removedThreadId?: string | null
    counts?: CommentThreadCounts
  }) => CommentMutationSnapshot
  commitMutation: (entityKey: string, input: {
    thread: ResumeCommentThread | null
    removedThreadId?: string | null
    counts: CommentThreadCounts
    event: ResumeCommentEvent
    eventSeq: number
  }) => void
  rollbackMutation: (
    entityKey: string,
    snapshot: CommentMutationSnapshot,
    message: string,
  ) => void
  applyRealtimePatch: (input: {
    threads: ResumeCommentThread[]
    events: ResumeCommentEvent[]
    eventSeq: number
  }) => void
  applyDocumentSync: (input: {
    documentHash: string
    documentRevision: number
    threads: ResumeCommentThread[]
    counts: CommentThreadCounts
    event: ResumeCommentEvent
    eventSeq: number
  }) => void
  beginPending: (entityKey: string) => void
  finishPending: (entityKey: string) => void
  failPending: (entityKey: string, message: string) => void
  setActiveThread: (threadId: string | null) => void
  setSelection: (selection: PendingCommentSelection | null) => void
  setDraft: (threadKey: string, value: string) => void
  clearDraft: (threadKey: string) => void
  preserveDraftsForNextScope: () => void
  beginScopeSwitch: () => void
  beginRelink: (threadId: string) => void
  cancelRelink: () => void
  setRelinkError: (message: string | null) => void
  setHighlightsHidden: (hidden: boolean) => void
  setConnection: (connection: CommentConnectionState) => void
  setAccessState: (state: CommentAccessState, error?: CommentErrorCode | null) => void
  markReadLocally: (eventSeq: number) => void
}

export type ResumeCommentStore = StoreApi<ResumeCommentStoreState>
