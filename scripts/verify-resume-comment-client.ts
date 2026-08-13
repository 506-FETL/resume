import type { ResumeCommentThread } from '../src/features/resume-comments/types.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deriveAnonymousAvatarVisual } from '../src/features/resume-comments/api/anonymous-identity.ts'
import {
  deriveCommentCacheKey,
  serializeCommentCacheKey,
} from '../src/features/resume-comments/api/cache.ts'
import {
  classifyCommentPerformance,
  parseCommentServerTiming,
} from '../src/features/resume-comments/api/performance.ts'
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
  kind: 'version' as const,
  resumeId: 'resume-1',
  ownerUserId: 'user-1',
  versionId: 42,
  documentHash: 'a'.repeat(64),
  documentRevision: 1,
  projectionReferenceDate: '2026-08-14',
  nextEventSeq: 8,
}
const version = {
  versionId: 42,
  versionNo: 3,
  versionName: '当前工作版本',
  status: 'active' as const,
  documentHash: 'a'.repeat(64),
  documentRevision: 1,
  projectionReferenceDate: '2026-08-14',
  sharedLinkCount: 2,
}
const counts = { unresolved: 2, resolved: 1, detached: 0 }
store.getState().replaceScope({
  scope: firstScope,
  version,
  counts,
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
  version: { ...version, documentRevision: 2 },
  counts,
  accessibleScopes: [],
  threads: [],
  eventSeq: 9,
  lastReadEventSeq: 4,
})
assert.equal(store.getState().draftsByThreadKey['new-thread'], '不要丢失的草稿')

store.getState().replaceScope({
  scope: { ...firstScope, id: 'scope-2', versionId: 43 },
  version: { ...version, versionId: 43, status: 'frozen' },
  counts: { unresolved: 0, resolved: 0, detached: 0 },
  accessibleScopes: [],
  threads: [],
  eventSeq: 1,
  lastReadEventSeq: 0,
})
assert.deepEqual(store.getState().draftsByThreadKey, {})

store.getState().setDraft('new-thread', '重新发布后保留')
store.getState().preserveDraftsForNextScope()
store.getState().replaceScope({
  scope: { ...firstScope, id: 'scope-3', versionId: 44 },
  version: { ...version, versionId: 44, status: 'frozen' },
  counts,
  accessibleScopes: [],
  threads: [],
  eventSeq: 1,
  lastReadEventSeq: 0,
})
assert.equal(store.getState().draftsByThreadKey['new-thread'], '重新发布后保留')
store.getState().replaceScope({
  scope: { ...firstScope, id: 'scope-4', versionId: 45 },
  version: { ...version, versionId: 45, status: 'frozen' },
  counts,
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
assert.equal(decideCommentRealtimeRecovery(8, 11), 'incremental')

const shareAccess = {
  kind: 'share' as const,
  accessToken: 'secret-access-token',
  shareId: 'share-1',
  releaseId: 'release-1',
  versionId: 42,
  commentsEnabled: true,
}
const cacheKey = deriveCommentCacheKey(shareAccess)
assert.ok(cacheKey)
assert.equal(serializeCommentCacheKey(cacheKey).includes(shareAccess.accessToken), false)
assert.equal(serializeCommentCacheKey(cacheKey).includes(shareAccess.releaseId), false)
assert.equal(classifyCommentPerformance('cache', 47.1).level, 'normal')
assert.equal(classifyCommentPerformance('bootstrap', 2_036.1).level, 'near_target')
assert.equal(classifyCommentPerformance('bootstrap', 2_600).level, 'slow')
assert.deepEqual(
  parseCommentServerTiming('auth;dur=12.4, access;dur=31.2, total;dur=128.8'),
  { auth: 12.4, access: 31.2, total: 128.8 },
)

const beforeOptimistic = store.getState().threadsById
const snapshot = store.getState().applyOptimisticMutation({
  entityKey: 'thread:missing:delete',
  removedThreadId: 'missing',
})
store.getState().rollbackMutation('thread:missing:delete', snapshot, '模拟失败')
assert.deepEqual(store.getState().threadsById, beforeOptimistic)
assert.equal(store.getState().mutationErrors['thread:missing:delete'], '模拟失败')

store.getState().applyRealtimePatch({
  threads: [],
  events: [{ eventSeq: 10, type: 'settings_changed', threadId: null, createdAt: '2026-08-14' }],
  eventSeq: 10,
})
store.getState().applyRealtimePatch({
  threads: [],
  events: [{ eventSeq: 10, type: 'settings_changed', threadId: null, createdAt: '2026-08-14' }],
  eventSeq: 10,
})
assert.equal(store.getState().events.filter(event => event.eventSeq === 10).length, 1)
assert.deepEqual(
  deriveAnonymousAvatarVisual('anonymous-id'),
  deriveAnonymousAvatarVisual('anonymous-id'),
)

const commentSurfaceSource = readFileSync(
  new URL('../src/features/resume-comments/components/comment-surface.tsx', import.meta.url),
  'utf8',
)
const commentTreeSource = readFileSync(
  new URL('../src/features/resume-comments/components/comment-tree.tsx', import.meta.url),
  'utf8',
)
const commentsPanelSource = readFileSync(
  new URL('../src/features/resume-comments/components/comments-panel.tsx', import.meta.url),
  'utf8',
)
const threadListSource = readFileSync(
  new URL('../src/features/resume-comments/components/thread-list.tsx', import.meta.url),
  'utf8',
)
const commentClientSource = readFileSync(
  new URL('../src/features/resume-comments/api/client.ts', import.meta.url),
  'utf8',
)
assert.equal(commentSurfaceSource.includes('useCommentReadReceipt'), false)
assert.match(commentTreeSource, /depth < 1/u)
assert.match(commentTreeSource, /depth >= 1/u)
assert.match(
  commentsPanelSource,
  /<Drawer[\s\S]*?<DrawerVirtualKeyboardProvider>[\s\S]*?<\/DrawerVirtualKeyboardProvider>[\s\S]*?<\/Drawer>/u,
)
assert.doesNotMatch(commentClientSource, /['"]x-request-id['"]\s*:/u)
assert.match(threadListSource, /<\/button>[\s\S]*?<CommentStatusBar/u)
assert.doesNotMatch(threadListSource, /<Button[\s\S]*?<CommentStatusBar/u)

console.warn('resume comment client verification passed')
