import type { ResumeCommentThread } from '../src/features/resume-comments/types.ts'
import assert from 'node:assert/strict'
import { deriveAnonymousAvatarVisual } from '../src/features/resume-comments/api/anonymous-identity.ts'
import { decideCommentRealtimeRecovery } from '../src/features/resume-comments/api/realtime-recovery.ts'
import { createResumeCommentStore } from '../src/features/resume-comments/store/create-store.ts'

const anchor = {
  nodeKey: 'work:entry-1:description',
  startGraphemeOffset: 0,
  endGraphemeOffset: 2,
  blockOrdinal: 0,
  exactQuote: '负责',
  prefix: '',
  suffix: '项目',
  nodeTextHash: 'a'.repeat(64),
  createdAtContentHash: 'b'.repeat(64),
}

function thread(
  id: string,
  lastActivityAt: string,
  resolvedAt: string | null = null,
): ResumeCommentThread {
  return {
    id,
    scopeId: 'scope-1',
    anchor,
    anchorStatus: 'anchored',
    originalPageIndex: 0,
    revision: 1,
    resolvedAt,
    resolvedBy: null,
    lastActivityAt,
    deletedAt: null,
    comments: [],
  }
}

const store = createResumeCommentStore()
const firstScope = {
  id: 'scope-1',
  kind: 'working' as const,
  resumeId: 'resume-1',
  ownerUserId: 'user-1',
  historyVersionId: null,
  shareReleaseId: null,
  documentHash: 'a'.repeat(64),
  documentRevision: 1,
  projectionReferenceDate: '2026-08-14',
  nextEventSeq: 8,
}
store.getState().replaceScope({
  scope: firstScope,
  accessibleScopes: [],
  threads: [
    thread('resolved-newer', '2026-08-14T10:00:00.000Z', '2026-08-14T10:00:00.000Z'),
    thread('open-older', '2026-08-14T09:00:00.000Z'),
    thread('open-newer', '2026-08-14T11:00:00.000Z'),
  ],
  eventSeq: 8,
  lastReadEventSeq: 4,
})
assert.deepEqual(store.getState().orderedThreadIds, [
  'open-newer',
  'open-older',
  'resolved-newer',
])

store.getState().setDraft('new-thread', '不要丢失的草稿')
store.getState().setConnection('offline')
assert.equal(store.getState().draftsByThreadKey['new-thread'], '不要丢失的草稿')
assert.equal(store.getState().connection, 'offline')

store.getState().replaceScope({
  scope: { ...firstScope, documentRevision: 2 },
  accessibleScopes: [],
  threads: [],
  eventSeq: 9,
  lastReadEventSeq: 4,
})
assert.equal(store.getState().draftsByThreadKey['new-thread'], '不要丢失的草稿')

store.getState().replaceScope({
  scope: { ...firstScope, id: 'scope-2', kind: 'share_release' },
  accessibleScopes: [],
  threads: [],
  eventSeq: 1,
  lastReadEventSeq: 0,
})
assert.deepEqual(store.getState().draftsByThreadKey, {})

store.getState().markReadLocally(7)
store.getState().markReadLocally(3)
assert.equal(store.getState().lastReadEventSeq, 7)

assert.equal(decideCommentRealtimeRecovery(8, 8), 'ignore')
assert.equal(decideCommentRealtimeRecovery(8, 9), 'incremental')
assert.equal(decideCommentRealtimeRecovery(8, 11), 'bootstrap')
assert.deepEqual(
  deriveAnonymousAvatarVisual('anonymous-id'),
  deriveAnonymousAvatarVisual('anonymous-id'),
)

console.warn('resume comment client verification passed')
