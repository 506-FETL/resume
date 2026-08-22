import type { ResumeCommentThread } from '../src/features/resume-comments/types.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deriveAnonymousAvatarVisual } from '../src/features/resume-comments/api/anonymous-identity.ts'
import {
  advanceCommentReadCursor,
  captureCommentCacheWriteFence,
  deleteCommentCache,
  deriveCommentCacheKey,
  isCommentCacheEntryCompatible,
  isCommentCacheWriteFenceCurrent,
  mergeCachedThreadReadStates,
  pruneCommentThreadReadCursors,
  readCommentThreadReadCursors,
  serializeCommentCacheKey,
  updateCommentCacheThreadReadCursor,
} from '../src/features/resume-comments/api/cache.ts'
import {
  calculateCommentTransportOverhead,
  getCommentPerformanceSnapshot,
  parseCommentServerTiming,
  recordCommentPerformanceSample,
  resetCommentPerformanceSamples,
} from '../src/features/resume-comments/api/performance.ts'
import { decideCommentRealtimeRecovery } from '../src/features/resume-comments/api/realtime-recovery.ts'
import { mergeHighlightVisualRects } from '../src/features/resume-comments/components/highlight-rects.ts'
import { createResumeCommentStore } from '../src/features/resume-comments/store/create-store.ts'
import {
  applyCommentEventsToThreadReadStates,
  getUnreadCommentThreadIds,
} from '../src/features/resume-comments/store/read-state.ts'

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

function readSourceSection(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `缺少源码起点：${startMarker}`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(end, -1, `缺少源码终点：${endMarker}`)
  return source.slice(start, end)
}

function assertSourceOrder(source: string, markers: string[]) {
  let previous = -1
  for (const marker of markers) {
    const current = source.indexOf(marker)
    assert.ok(current > previous, `源码顺序不符合预期：${marker}`)
    previous = current
  }
}

function assertMutationRejected(
  label: string,
  source: string,
  mutant: string,
  verify: (candidate: string) => void,
) {
  assert.notEqual(mutant, source, `mutation 未命中：${label}`)
  assert.throws(
    () => verify(mutant),
    { name: 'AssertionError' },
    `verifier 未拒绝 mutation：${label}`,
  )
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
assert.equal(store.getState().scopeEpoch, 0)
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
assert.equal(store.getState().scopeEpoch, 1)
assert.deepEqual(store.getState().orderedThreadIds, [
  'open-newer',
  'open-older',
  'resolved-newer',
])

const threadReadStore = createResumeCommentStore()
threadReadStore.getState().replaceScope({
  scope: firstScope,
  version,
  counts,
  accessibleScopes: [],
  threads: [
    thread('thread-a', '2026-08-14T09:00:00.000Z'),
    thread('thread-b', '2026-08-14T10:00:00.000Z'),
  ],
  eventSeq: 10,
  lastReadEventSeq: 4,
  threadReadStates: [
    { threadId: 'thread-a', latestCommentEventSeq: 9, lastReadEventSeq: 4 },
    { threadId: 'thread-b', latestCommentEventSeq: 10, lastReadEventSeq: 4 },
  ],
})
function unreadThreadIds() {
  return getUnreadCommentThreadIds(
    threadReadStore.getState().threadReadStateById,
    threadReadStore.getState().lastReadEventSeq,
  ).sort()
}
assert.deepEqual(unreadThreadIds(), ['thread-a', 'thread-b'])
threadReadStore.getState().markThreadReadLocally('thread-a', 9)
assert.deepEqual(unreadThreadIds(), ['thread-b'])
threadReadStore.getState().markAllReadLocally(10)
assert.deepEqual(unreadThreadIds(), [])

const lateReadFailureStore = createResumeCommentStore()
lateReadFailureStore.getState().replaceScope({
  scope: firstScope,
  version,
  counts,
  accessibleScopes: [],
  threads: [thread('thread-a', '2026-08-14T09:00:00.000Z')],
  eventSeq: 10,
  lastReadEventSeq: 4,
  threadReadStates: [
    { threadId: 'thread-a', latestCommentEventSeq: 9, lastReadEventSeq: 4 },
  ],
})
lateReadFailureStore.getState().markThreadReadLocally('thread-a', 9)
lateReadFailureStore.getState().applyRealtimePatch({
  threads: [],
  events: [{
    eventSeq: 11,
    type: 'thread_deleted',
    threadId: 'thread-a',
    createdAt: '2026-08-18T12:00:00.000Z',
    isOwn: false,
  }],
  eventSeq: 11,
})
assert.deepEqual(lateReadFailureStore.getState().threadReadStateById, {})

const ownEventReadStates = applyCommentEventsToThreadReadStates({}, [{
  eventSeq: 11,
  type: 'comment_replied',
  threadId: 'thread-own',
  createdAt: '2026-08-16T01:00:00.000Z',
  isOwn: true,
}])
assert.deepEqual(ownEventReadStates['thread-own'], {
  threadId: 'thread-own',
  latestCommentEventSeq: 11,
  lastReadEventSeq: 11,
})
const otherEventReadStates = applyCommentEventsToThreadReadStates(ownEventReadStates, [{
  eventSeq: 12,
  type: 'comment_replied',
  threadId: 'thread-own',
  createdAt: '2026-08-16T01:01:00.000Z',
  isOwn: false,
}])
assert.deepEqual(otherEventReadStates['thread-own'], {
  threadId: 'thread-own',
  latestCommentEventSeq: 12,
  lastReadEventSeq: 11,
})

const visualHighlightRects = mergeHighlightVisualRects([
  {
    key: 'thread-a-0',
    threadId: 'thread-a',
    pageIndex: 0,
    x: 10,
    y: 20,
    width: 80,
    height: 18,
  },
  {
    key: 'thread-b-0',
    threadId: 'thread-b',
    pageIndex: 0,
    x: 50,
    y: 20,
    width: 70,
    height: 18,
  },
  {
    key: 'thread-c-0',
    threadId: 'thread-c',
    pageIndex: 0,
    x: 10,
    y: 42,
    width: 80,
    height: 18,
  },
])

const stableHighlightKey = mergeHighlightVisualRects([{
  key: 'thread-z-0',
  threadId: 'thread-z',
  pageIndex: 0,
  x: 10,
  y: 20,
  width: 80,
  height: 18,
}])[0]?.key
assert.equal(stableHighlightKey, mergeHighlightVisualRects([{
  key: 'thread-y-0',
  threadId: 'thread-y',
  pageIndex: 0,
  x: 10,
  y: 20,
  width: 80,
  height: 18,
}])[0]?.key)

const slightTopVariance = mergeHighlightVisualRects([
  {
    key: 'right',
    threadId: 'right',
    pageIndex: 0,
    x: 70,
    y: 20,
    width: 20,
    height: 18,
  },
  {
    key: 'left',
    threadId: 'left',
    pageIndex: 0,
    x: 10,
    y: 20.5,
    width: 20,
    height: 18,
  },
])
assert.deepEqual(slightTopVariance.map(rect => rect.threadIds), [['left'], ['right']])

const crossLineCornerOverlap = mergeHighlightVisualRects([
  {
    key: 'line-1',
    threadId: 'line-1',
    pageIndex: 0,
    x: 10,
    y: 20,
    width: 100,
    height: 18,
  },
  {
    key: 'line-2',
    threadId: 'line-2',
    pageIndex: 0,
    x: 105,
    y: 36,
    width: 100,
    height: 18,
  },
])
assert.equal(crossLineCornerOverlap.length, 2)

const chainedTopVariance = mergeHighlightVisualRects([
  {
    key: 'top-0',
    threadId: 'top-0',
    pageIndex: 0,
    x: 10,
    y: 0,
    width: 80,
    height: 10,
  },
  {
    key: 'top-3',
    threadId: 'top-3',
    pageIndex: 0,
    x: 10,
    y: 3,
    width: 80,
    height: 10,
  },
  {
    key: 'top-6',
    threadId: 'top-6',
    pageIndex: 0,
    x: 10,
    y: 6,
    width: 80,
    height: 10,
  },
  {
    key: 'top-9',
    threadId: 'top-9',
    pageIndex: 0,
    x: 10,
    y: 9,
    width: 80,
    height: 10,
  },
  {
    key: 'top-12',
    threadId: 'top-12',
    pageIndex: 0,
    x: 10,
    y: 12,
    width: 80,
    height: 10,
  },
])
assert.equal(chainedTopVariance.length, 1)
assert.deepEqual(chainedTopVariance[0], {
  key: 'visual:0:10:0:80:22',
  threadIds: ['top-0', 'top-3', 'top-6', 'top-9', 'top-12'],
  pageIndex: 0,
  x: 10,
  y: 0,
  width: 80,
  height: 22,
})

const lShapeDoesNotBridge = mergeHighlightVisualRects([
  {
    key: 'top',
    threadId: 'top',
    pageIndex: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 10,
  },
  {
    key: 'vertical',
    threadId: 'vertical',
    pageIndex: 0,
    x: 90,
    y: 5,
    width: 10,
    height: 100,
  },
  {
    key: 'bottom',
    threadId: 'bottom',
    pageIndex: 0,
    x: 0,
    y: 90,
    width: 100,
    height: 10,
  },
])
assert.equal(lShapeDoesNotBridge.length, 3)

const cacheWriteFence = captureCommentCacheWriteFence()
assert.equal(isCommentCacheWriteFenceCurrent(cacheWriteFence), true)
await deleteCommentCache({ versionId: 42, principalKey: 'fence-test' })
assert.equal(isCommentCacheWriteFenceCurrent(cacheWriteFence), false)

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
)
const threadCursorStorage = new Map<string, string>()
const localStorageStub = {
  get length() {
    return threadCursorStorage.size
  },
  clear() {
    threadCursorStorage.clear()
  },
  getItem(key: string) {
    return threadCursorStorage.get(key) ?? null
  },
  key(index: number) {
    return [...threadCursorStorage.keys()][index] ?? null
  },
  removeItem(key: string) {
    threadCursorStorage.delete(key)
  },
  setItem(key: string, value: string) {
    threadCursorStorage.set(key, value)
  },
}
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageStub,
})
const independentCursorKey = { versionId: 42, principalKey: 'cursor-test' }
await updateCommentCacheThreadReadCursor(
  independentCursorKey,
  'live-thread',
  19,
)
assert.deepEqual(readCommentThreadReadCursors(independentCursorKey), [{
  threadId: 'live-thread',
  latestCommentEventSeq: 19,
  lastReadEventSeq: 19,
}])
pruneCommentThreadReadCursors(independentCursorKey, new Set())
assert.deepEqual(readCommentThreadReadCursors(independentCursorKey), [])
if (originalLocalStorageDescriptor) {
  Object.defineProperty(
    globalThis,
    'localStorage',
    originalLocalStorageDescriptor,
  )
}
else {
  Reflect.deleteProperty(globalThis, 'localStorage')
}
assert.deepEqual(visualHighlightRects, [
  {
    key: 'visual:0:10:20:110:18',
    threadIds: ['thread-a', 'thread-b'],
    pageIndex: 0,
    x: 10,
    y: 20,
    width: 110,
    height: 18,
  },
  {
    key: 'visual:0:10:42:80:18',
    threadIds: ['thread-c'],
    pageIndex: 0,
    x: 10,
    y: 42,
    width: 80,
    height: 18,
  },
])

assert.deepEqual(
  mergeCachedThreadReadStates(
    [
      { threadId: 'deleted-thread', latestCommentEventSeq: 8, lastReadEventSeq: 8 },
      { threadId: 'live-thread', latestCommentEventSeq: 7, lastReadEventSeq: 7 },
    ],
    [{ threadId: 'live-thread', latestCommentEventSeq: 9, lastReadEventSeq: 5 }],
    new Set(['live-thread']),
  ),
  [{ threadId: 'live-thread', latestCommentEventSeq: 9, lastReadEventSeq: 7 }],
)

const authoritativeBootstrapStore = createResumeCommentStore()
authoritativeBootstrapStore.getState().replaceScope({
  scope: firstScope,
  version,
  counts,
  accessibleScopes: [],
  threads: [thread('deleted-thread', '2026-08-14T09:00:00.000Z')],
  eventSeq: 8,
  lastReadEventSeq: 8,
  threadReadStates: [
    { threadId: 'deleted-thread', latestCommentEventSeq: 8, lastReadEventSeq: 8 },
  ],
})
authoritativeBootstrapStore.getState().replaceScope({
  scope: firstScope,
  version,
  counts: { unresolved: 0, resolved: 0, detached: 0 },
  accessibleScopes: [],
  threads: [],
  eventSeq: 9,
  lastReadEventSeq: 8,
  threadReadStates: [
    { threadId: 'deleted-thread', latestCommentEventSeq: 8, lastReadEventSeq: 8 },
  ],
})
assert.deepEqual(authoritativeBootstrapStore.getState().threadReadStateById, {})

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
assert.equal(store.getState().scopeEpoch, 1)
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
assert.equal(store.getState().scopeEpoch, 2)
assert.deepEqual(store.getState().draftsByThreadKey, {})

const switchingStore = createResumeCommentStore()
switchingStore.getState().beginScopeSwitch()
assert.equal(switchingStore.getState().scopeEpoch, 1)

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
store.getState().replaceScope({
  scope: store.getState().scope!,
  version: store.getState().version!,
  counts: store.getState().counts,
  accessibleScopes: store.getState().accessibleScopes,
  threads: [],
  eventSeq: 7,
  lastReadEventSeq: 2,
})
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
const advancedCache = advanceCommentReadCursor({
  scope: firstScope,
  version,
  counts,
  accessibleScopes: [{
    id: firstScope.id,
    kind: firstScope.kind,
    resumeId: firstScope.resumeId,
    versionId: firstScope.versionId,
    documentRevision: firstScope.documentRevision,
    projectionReferenceDate: firstScope.projectionReferenceDate,
    nextEventSeq: firstScope.nextEventSeq,
    lastReadEventSeq: 2,
    updatedAt: '2026-08-14T00:00:00.000Z',
  }],
  threads: [],
  lastReadEventSeq: 2,
}, 7)
assert.equal(advancedCache.lastReadEventSeq, 7)
assert.equal(advancedCache.accessibleScopes[0]?.lastReadEventSeq, 7)
assert.equal(isCommentCacheEntryCompatible({ protocolVersion: 1 }), true)
assert.equal(isCommentCacheEntryCompatible({}), false)
assert.equal(isCommentCacheEntryCompatible({ protocolVersion: 2 }), false)
assert.deepEqual(
  parseCommentServerTiming([
    'auth_anonymous;dur=12.4',
    'rpc;dur=31.2',
    'rpc;dur=99',
    'edge_total;dur=128.8',
    'total;dur=130',
    'db;dur=88',
    'unknown;dur=9',
    'repair;dur=',
    'serialize;dur=NaN',
    'auth_local;dur=Infinity',
    'auth_legacy;dur=-1',
  ].join(',')),
  {
    auth_anonymous: 12.4,
    rpc: 31.2,
    edge_total: 128.8,
    total: 130,
  },
)
assert.ok(Math.abs(calculateCommentTransportOverhead(
  { fetch_headers: 180, response_body: 900 },
  { edge_total: 128.8, total: 130 },
) - 51.2) < 1e-9)
assert.equal(calculateCommentTransportOverhead(
  { fetch_headers: 100 },
  { edge_total: 128.8 },
), 0)

const basePerformanceDimensions = {
  authMode: 'anonymous' as const,
  coldStart: false,
  repair: false,
  protocolVersion: 1 as const,
  edgeRegion: 'us-east-1' as const,
}
resetCommentPerformanceSamples()
for (let duration = 1; duration <= 55; duration += 1) {
  recordCommentPerformanceSample({
    stage: 'bootstrap',
    duration,
    dimensions: basePerformanceDimensions,
  })
}
assert.deepEqual(getCommentPerformanceSnapshot(), [{
  stage: 'bootstrap',
  ...basePerformanceDimensions,
  count: 50,
  windowSize: 50,
  p50: 30,
  p95: 53,
  max: 55,
}])

resetCommentPerformanceSamples()
const dimensionVariants = [
  basePerformanceDimensions,
  { ...basePerformanceDimensions, authMode: 'local_jwks' as const },
  { ...basePerformanceDimensions, coldStart: true },
  { ...basePerformanceDimensions, repair: true },
  { ...basePerformanceDimensions, protocolVersion: 'unknown' as const },
  { ...basePerformanceDimensions, edgeRegion: 'other' as const },
]
for (const [duration, dimensions] of dimensionVariants.entries()) {
  recordCommentPerformanceSample({
    stage: 'bootstrap',
    duration,
    dimensions,
  })
}
recordCommentPerformanceSample({
  stage: 'bootstrap',
  duration: 99,
  dimensions: {
    ...basePerformanceDimensions,
    edgeRegion: 'arbitrary-region' as 'other',
  },
})
const dimensionBuckets = getCommentPerformanceSnapshot()
assert.equal(dimensionBuckets.length, dimensionVariants.length)
assert.equal(dimensionBuckets.reduce((total, bucket) => total + bucket.count, 0), 7)
assert.equal(dimensionBuckets.some(bucket => bucket.edgeRegion === 'arbitrary-region'), false)
assert.equal(
  dimensionBuckets.some(bucket => Object.hasOwn(bucket, 'requestId')),
  false,
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

const optimisticStore = createResumeCommentStore()
optimisticStore.getState().replaceScope({
  scope: firstScope,
  version,
  counts,
  accessibleScopes: [],
  threads: [],
  eventSeq: 8,
  lastReadEventSeq: 0,
})
const pendingThread = optimisticStore.getState().enqueuePendingThread({
  requestId: '11111111-1111-4111-8111-111111111111',
  scopeId: firstScope.id,
  scopeEpoch: optimisticStore.getState().scopeEpoch,
  anchor,
  originalPageIndex: 0,
  documentHash: firstScope.documentHash,
  body: '立即显示的新评论',
  createdAt: '2026-08-22T08:00:00.000Z',
})
assert.equal(pendingThread.threadId, `local-thread:${pendingThread.requestId}`)
assert.equal(optimisticStore.getState().activeThreadId, pendingThread.threadId)
assert.equal(optimisticStore.getState().threadsById[pendingThread.threadId]?.localOnly, true)
assert.equal(
  optimisticStore.getState().threadsById[pendingThread.threadId]?.comments[0]?.delivery?.state,
  'sending',
)
assert.deepEqual(optimisticStore.getState().counts, counts)
optimisticStore.getState().failPendingCreation(pendingThread.requestId, '网络中断')
assert.equal(
  optimisticStore.getState().threadsById[pendingThread.threadId]?.comments[0]?.delivery?.state,
  'failed',
)
assert.equal(
  optimisticStore.getState().markPendingCreationSending(pendingThread.requestId)?.requestId,
  pendingThread.requestId,
)
assert.equal(
  optimisticStore.getState().threadsById[pendingThread.threadId]?.comments[0]?.delivery?.state,
  'sending',
)

const confirmedRootThread: ResumeCommentThread = {
  ...thread('server-thread-1', '2026-08-22T08:00:01.000Z'),
  comments: [{
    id: 'server-comment-1',
    threadId: 'server-thread-1',
    parentId: null,
    author: { kind: 'user', userId: 'user-1', displayName: 'seams', avatarUrl: null },
    body: pendingThread.body,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-08-22T08:00:01.000Z',
    updatedAt: '2026-08-22T08:00:01.000Z',
  }],
}
optimisticStore.getState().settlePendingCreation(pendingThread.requestId, {
  thread: confirmedRootThread,
  counts: { ...counts, unresolved: counts.unresolved + 1 },
  event: {
    eventSeq: 9,
    type: 'thread_created',
    threadId: confirmedRootThread.id,
    createdAt: '2026-08-22T08:00:01.000Z',
    clientRequestId: pendingThread.requestId,
  },
  eventSeq: 9,
})
assert.equal(optimisticStore.getState().threadsById[pendingThread.threadId], undefined)
assert.equal(optimisticStore.getState().activeThreadId, confirmedRootThread.id)
assert.equal(optimisticStore.getState().counts.unresolved, counts.unresolved + 1)

const pendingReply = optimisticStore.getState().enqueuePendingReply({
  requestId: '22222222-2222-4222-8222-222222222222',
  scopeId: firstScope.id,
  scopeEpoch: optimisticStore.getState().scopeEpoch,
  threadId: confirmedRootThread.id,
  parentCommentId: confirmedRootThread.comments[0]!.id,
  threadRevision: confirmedRootThread.revision,
  documentHash: firstScope.documentHash,
  body: '立即显示的新回复',
  createdAt: '2026-08-22T08:01:00.000Z',
})
assert.ok(pendingReply)
assert.equal(
  optimisticStore.getState().threadsById[confirmedRootThread.id]?.comments.at(-1)?.delivery?.state,
  'sending',
)
const confirmedReplyThread: ResumeCommentThread = {
  ...confirmedRootThread,
  revision: confirmedRootThread.revision + 1,
  comments: [...confirmedRootThread.comments, {
    id: 'server-comment-2',
    threadId: confirmedRootThread.id,
    parentId: confirmedRootThread.comments[0]!.id,
    author: { kind: 'user', userId: 'user-1', displayName: 'seams', avatarUrl: null },
    body: pendingReply!.body,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-08-22T08:01:01.000Z',
    updatedAt: '2026-08-22T08:01:01.000Z',
  }],
}
optimisticStore.getState().applyRealtimePatch({
  threads: [confirmedReplyThread],
  events: [{
    eventSeq: 10,
    type: 'comment_replied',
    threadId: confirmedRootThread.id,
    createdAt: '2026-08-22T08:01:01.000Z',
    clientRequestId: pendingReply!.requestId,
  }],
  eventSeq: 10,
})
assert.equal(
  optimisticStore.getState().pendingCreationsByRequestId[pendingReply!.requestId],
  undefined,
)
assert.equal(
  optimisticStore.getState().threadsById[confirmedRootThread.id]?.comments.filter(
    comment => comment.body === pendingReply!.body,
  ).length,
  1,
)
optimisticStore.getState().settlePendingCreation(pendingReply!.requestId, {
  thread: confirmedReplyThread,
  counts: optimisticStore.getState().counts,
  event: {
    eventSeq: 10,
    type: 'comment_replied',
    threadId: confirmedRootThread.id,
    createdAt: '2026-08-22T08:01:01.000Z',
    clientRequestId: pendingReply!.requestId,
  },
  eventSeq: 10,
})
assert.equal(
  optimisticStore.getState().threadsById[confirmedRootThread.id]?.comments.filter(
    comment => comment.body === pendingReply!.body,
  ).length,
  1,
)

const removablePending = optimisticStore.getState().enqueuePendingReply({
  requestId: '33333333-3333-4333-8333-333333333333',
  scopeId: firstScope.id,
  scopeEpoch: optimisticStore.getState().scopeEpoch,
  threadId: confirmedRootThread.id,
  parentCommentId: confirmedRootThread.comments[0]!.id,
  threadRevision: confirmedReplyThread.revision,
  documentHash: firstScope.documentHash,
  body: '需要移除',
  createdAt: '2026-08-22T08:02:00.000Z',
})
assert.ok(removablePending)
optimisticStore.getState().discardPendingCreation(removablePending!.requestId)
assert.equal(
  optimisticStore.getState().threadsById[confirmedRootThread.id]?.comments.some(
    comment => comment.id === removablePending!.commentId,
  ),
  false,
)
optimisticStore.getState().beginScopeSwitch()
assert.deepEqual(optimisticStore.getState().pendingCreationsByRequestId, {})

const commentSurfaceSource = readFileSync(
  new URL('../src/features/resume-comments/components/comment-surface.tsx', import.meta.url),
  'utf8',
)
const commentTreeSource = readFileSync(
  new URL('../src/features/resume-comments/components/comment-tree.tsx', import.meta.url),
  'utf8',
)
const highlightOverlaySource = readFileSync(
  new URL('../src/features/resume-comments/components/highlight-overlay.tsx', import.meta.url),
  'utf8',
)
const commentsPanelSource = readFileSync(
  new URL('../src/features/resume-comments/components/comments-panel.tsx', import.meta.url),
  'utf8',
)
const commentMobileLayoutSource = readFileSync(
  new URL('../src/features/resume-comments/hooks/use-comment-mobile-layout.ts', import.meta.url),
  'utf8',
)
const commentSelectionSource = readFileSync(
  new URL('../src/features/resume-comments/hooks/use-comment-selection.ts', import.meta.url),
  'utf8',
)
const commentActionsSource = readFileSync(
  new URL('../src/features/resume-comments/hooks/use-comment-actions.ts', import.meta.url),
  'utf8',
)
const commentBookmarkSource = readFileSync(
  new URL('../src/features/resume-comments/components/comment-bookmark.tsx', import.meta.url),
  'utf8',
)
const threadDetailSource = readFileSync(
  new URL('../src/features/resume-comments/components/thread-detail.tsx', import.meta.url),
  'utf8',
)
const drawerSource = readFileSync(
  new URL('../src/components/ui/drawer.tsx', import.meta.url),
  'utf8',
)
const editorSource = readFileSync(
  new URL('../src/pages/resume/editor/index.tsx', import.meta.url),
  'utf8',
)
const commentReviewBannerSource = readFileSync(
  new URL('../src/pages/resume/editor/components/comment-review-banner/index.tsx', import.meta.url),
  'utf8',
)
const threadListSource = readFileSync(
  new URL('../src/features/resume-comments/components/thread-list.tsx', import.meta.url),
  'utf8',
)
const threadPickerSource = readFileSync(
  new URL('../src/features/resume-comments/components/thread-picker.tsx', import.meta.url),
  'utf8',
)
const trackerOverviewSource = readFileSync(
  new URL('../src/pages/tracker/components/overview-bar/index.tsx', import.meta.url),
  'utf8',
)
const trackerMetricCardSource = readFileSync(
  new URL('../src/pages/tracker/components/overview-bar/metric-card.tsx', import.meta.url),
  'utf8',
)
const commentClientSource = readFileSync(
  new URL('../src/features/resume-comments/api/client.ts', import.meta.url),
  'utf8',
)
const commentPerformanceSource = readFileSync(
  new URL('../src/features/resume-comments/api/performance.ts', import.meta.url),
  'utf8',
)
const commentCacheSource = readFileSync(
  new URL('../src/features/resume-comments/api/cache.ts', import.meta.url),
  'utf8',
)
const commentRealtimeHookSource = readFileSync(
  new URL('../src/features/resume-comments/hooks/use-comment-realtime.ts', import.meta.url),
  'utf8',
)
const commentBenchmarkSource = readFileSync(
  new URL('./benchmark-resume-comments-bootstrap.ts', import.meta.url),
  'utf8',
)
const mobileSortDrawerSource = readFileSync(
  new URL('../src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx', import.meta.url),
  'utf8',
)
const quickShareDialogSource = readFileSync(
  new URL('../src/pages/share/components/quick-dialog/index.tsx', import.meta.url),
  'utf8',
)
assert.equal(commentSurfaceSource.includes('useCommentReadReceipt'), false)
assert.match(commentSurfaceSource, /activeThreadId=\{open \? activeThreadId : null\}/u)
assert.match(commentSurfaceSource, /if \(!open\)[\s\S]*?setHoveredThread\(threadId\)/u)
assert.match(commentSurfaceSource, /useState<PendingCommentCreationSnapshot \| null>\(null\)/u)
assert.match(commentSurfaceSource, /setCreationSnapshot\(\{[\s\S]*?selection,[\s\S]*?scopeId: scope\.id,[\s\S]*?scopeEpoch,[\s\S]*?\}\)[\s\S]*?setOpen\(true\)/u)
assert.match(commentSurfaceSource, /creationSnapshot\.scopeId === scope\?\.id[\s\S]*?creationSnapshot\.scopeEpoch === scopeEpoch[\s\S]*?setCreationSnapshot\(null\)/u)
assert.match(commentsPanelSource, /creationSnapshot: PendingCommentCreationSnapshot \| null/u)
assert.match(commentsPanelSource, /\{creationSnapshot[\s\S]*?actions\.createThread\(value, creationSnapshot\)[\s\S]*?onFinishCreating\(\)/u)
assert.doesNotMatch(commentsPanelSource, /creating && selection/u)
assert.match(commentActionsSource, /creationSnapshot\?: PendingCommentCreationSnapshot/u)
assert.match(commentActionsSource, /const selection = creationSnapshot\?\.selection \?\? state\.selection/u)
assert.match(commentActionsSource, /const mutationScopeEpoch = initialState\.scopeEpoch/u)
assert.match(commentActionsSource, /assertMutationScopeCurrent\(\)[\s\S]*?await prepareActor\(\)[\s\S]*?assertMutationScopeCurrent\(\)[\s\S]*?const response = await operation\(\)[\s\S]*?assertMutationScopeCurrent\(\)/u)
assert.match(commentActionsSource, /if \(isMutationScopeCurrent\(\)\)[\s\S]*?rollbackMutation/u)
assert.match(commentTreeSource, /depth < 2/u)
assert.match(commentTreeSource, /depth >= 2/u)
assert.match(commentTreeSource, /pl-7/u)
assert.match(commentTreeSource, /-top-px left-0 h-\[calc\(1\.75rem\+1px\)\] w-7 rounded-bl-xl/u)
assert.match(commentTreeSource, /-bottom-px left-0 top-\[calc\(1\.75rem-1px\)\]/u)
assert.match(commentTreeSource, /<div className="ml-4 min-w-0">/u)
assert.equal(commentTreeSource.match(/<AnimatePresence>/gu)?.length, 2)
assert.match(commentTreeSource, /\{depth < 2[\s\S]*?<AnimatePresence>[\s\S]*?visibleChildren\.map/u)
assert.doesNotMatch(commentTreeSource, /\{visibleChildren\.length > 0\s*\?|mode="popLayout"/u)
assert.match(commentTreeSource, /<motion\.div\s+layout="position"/u)
assert.doesNotMatch(commentTreeSource, /<motion\.div\s+layout\s/u)
assert.match(commentTreeSource, /opacity: 0, y: 7, scale: 0\.985/u)
assert.doesNotMatch(commentTreeSource, /depth > 0 \? 'ml-6'/u)
assert.doesNotMatch(commentTreeSource, /depth > 0 \? 'ml-11'/u)
assert.match(commentTreeSource, /const \[detailPath, setDetailPath\]/u)
assert.match(commentTreeSource, /const \[navigationDirection, setNavigationDirection\]/u)
assert.match(commentTreeSource, /setNavigationDirection\(-1\)/u)
assert.match(commentTreeSource, /current\.slice\(0, -1\)/u)
assert.match(
  commentsPanelSource,
  /<Drawer[\s\S]*?<DrawerVirtualKeyboardProvider>[\s\S]*?<\/DrawerVirtualKeyboardProvider>[\s\S]*?<\/Drawer>/u,
)
assert.match(commentsPanelSource, /useCommentMobileLayout/u)
assert.match(commentsPanelSource, /swipeDirection="down"/u)
assert.match(commentsPanelSource, /overlayClassName="supports-backdrop-filter:backdrop-blur-none"/u)
assert.doesNotMatch(commentsPanelSource, /h-\[(?:60|70)vh\]/u)
assert.match(drawerSource, /data-\[swipe-axis=y\]:\[--drawer-content-height:70dvh\]/u)
assert.match(drawerSource, /data-\[swipe-axis=y\]:\[--drawer-content-max-height:70dvh\]/u)
assert.doesNotMatch(commentsPanelSource, /\[--drawer-content-height:auto\]|\[--drawer-content-max-height:auto\]/u)
assert.doesNotMatch(commentsPanelSource, /rounded-b-none|\[--drawer-inset:0px\]|border-x-0 border-b-0/u)
assert.match(commentsPanelSource, /grid shrink-0 grid-cols-3/u)
assert.match(commentsPanelSource, /flex min-h-0 flex-1 overflow-y-auto/u)
assert.match(commentsPanelSource, /actions\.markThreadRead\(threadId\)/u)
assert.match(commentsPanelSource, /actions\.markAllRead\(\)/u)
assert.match(
  commentsPanelSource,
  /const unreadThreadIds = useResumeCommentStore\(useShallow\([\s\S]*?getUnreadCommentThreadIds/u,
)
assert.match(commentActionsSource, /latestCommentEventSeq <= Math\.max/u)
assert.match(commentSelectionSource, /function getEventTargetElement\(target: EventTarget \| null\)/u)
assert.match(commentSelectionSource, /if \(target instanceof Element\)/u)
assert.match(commentSelectionSource, /if \(target instanceof Node\)[\s\S]*?target\.parentElement/u)
assert.equal(
  commentSelectionSource.match(/const target = getEventTargetElement\(event\.target\)/gu)?.length,
  2,
)
assert.match(commentSelectionSource, /document\.addEventListener\('pointerup', handlePointerEnd, true\)/u)
assert.match(commentSelectionSource, /document\.addEventListener\('pointercancel', handlePointerEnd, true\)/u)
assert.match(commentSelectionSource, /pointerSelecting\.current \|\| keyboardSelecting\.current/u)
assert.match(commentSelectionSource, /completionArmed\.current/u)
assert.match(commentSelectionSource, /scheduleEvaluation\(120\)/u)
assert.equal(commentSelectionSource.match(/requestAnimationFrame\(/gu)?.length, 2)
assert.match(threadDetailSource, /flex shrink-0 items-center/u)
assert.match(threadListSource, /w-full min-w-0 space-y-2 p-3/u)
assert.match(threadListSource, /className="w-full min-w-0"/u)
assert.match(commentSurfaceSource, /<AnimatePresence initial=\{false\}>[\s\S]*?<ThreadPicker[\s\S]*?key="resume-comment-thread-picker"/u)
assert.match(threadPickerSource, /className="fixed inset-0 z-60"/u)
assert.match(threadPickerSource, /onPointerDown=\{onClose\}/u)
assert.match(threadPickerSource, /exit=\{reduceMotion \? \{ opacity: 0 \} : \{ opacity: 0, y: 4, scale: 0\.98 \}\}/u)
assert.match(commentClientSource, /isOwn: event\.is_own === true/u)
assert.match(trackerMetricCardSource, /border-primary\/50 bg-primary\/5 text-foreground shadow-inner/u)
assert.doesNotMatch(trackerMetricCardSource, /bg-primary text-primary-foreground/u)
assert.equal(
  trackerOverviewSource.match(/border-primary\/50 bg-primary\/5 text-foreground shadow-inner/gu)?.length,
  2,
)
assert.doesNotMatch(trackerOverviewSource, /aria-pressed:bg-primary|bg-primary text-primary-foreground/u)
assert.match(threadDetailSource, /shrink-0 border-t bg-popover p-3/u)
assert.match(threadDetailSource, /keyboardAwareReply/u)
assert.match(threadDetailSource, /var\(--drawer-keyboard-inset,0px\)/u)
assert.match(threadDetailSource, /focus-within:pb-/u)
assert.match(threadDetailSource, /motion-reduce:transition-none/u)
assert.match(commentMobileLayoutSource, /\(hover: none\) and \(pointer: coarse\) and \(max-width: 1024px\)/u)
assert.doesNotMatch(commentBookmarkSource, /h-14 w-12/u)
assert.match(drawerSource, /overlayClassName\?: string/u)
assert.match(drawerSource, /data-base-ui-swipe-ignore=""/u)
assert.match(editorSource, /<CommentReviewBanner/u)
assert.doesNotMatch(editorSource, /presentation="docked"/u)
assert.doesNotMatch(commentSurfaceSource, /presentation/u)
assert.match(commentsPanelSource, /key="resume-comments-desktop"[\s\S]*?modal[\s\S]*?swipeDirection="right"/u)
assert.match(commentsPanelSource, /keyboardAwareReply=\{isMobile\}/u)
assert.match(highlightOverlaySource, /AnimatePresence, motion, useReducedMotion/u)
assert.match(highlightOverlaySource, /HIGHLIGHT_STAGGER_SECONDS = 0\.06/u)
assert.match(highlightOverlaySource, /enterDelay: orderIndex \* stagger/u)
assert.match(highlightOverlaySource, /exitDelay: \(ordered\.length - orderIndex - 1\) \* stagger/u)
assert.match(highlightOverlaySource, /initial=\{reduceMotion \? false : \{ clipPath: HIGHLIGHT_HIDDEN_CLIP_PATH \}\}/u)
assert.match(highlightOverlaySource, /animate=\{\{[\s\S]*?clipPath: HIGHLIGHT_VISIBLE_CLIP_PATH/u)
assert.match(highlightOverlaySource, /exit=\{\{[\s\S]*?clipPath: HIGHLIGHT_HIDDEN_CLIP_PATH/u)
assert.match(highlightOverlaySource, /pointer-events-none absolute rounded-\[2px\]/u)
assert.match(highlightOverlaySource, /mergeHighlightVisualRects\(flattenHighlightRects\(geometry\)\)/u)
assert.match(highlightOverlaySource, /rect\.threadIds\.includes\(activeThreadId \?\? ''\)/u)
assert.match(highlightOverlaySource, /visibleHitGeometry\.map\(rect =>/u)
assert.match(highlightOverlaySource, /pageHitGeometry[\s\S]*?rectanglesOverlap\(rect, candidate\)/u)
assert.match(highlightOverlaySource, /motion-reduce:transition-none/u)
assert.match(mobileSortDrawerSource, /from '@\/components\/ui\/drawer'/u)
assert.match(mobileSortDrawerSource, /swipeDirection="down"/u)
assert.match(mobileSortDrawerSource, /showSwipeHandle/u)
assert.doesNotMatch(mobileSortDrawerSource, /from '@\/components\/ui\/sheet'/u)
assert.match(mobileSortDrawerSource, /Reorder, useDragControls/u)
assert.match(mobileSortDrawerSource, /data-base-ui-swipe-ignore=""/u)
assert.doesNotMatch(mobileSortDrawerSource, /@hello-pangea\/dnd/u)
assert.match(quickShareDialogSource, /useIsMobile/u)
assert.match(quickShareDialogSource, /swipeDirection="down"/u)
assert.match(quickShareDialogSource, /showSwipeHandle/u)
assert.match(commentReviewBannerSource, /历史版本只读，返回当前版本后可继续编辑/u)
assert.match(commentReviewBannerSource, /fixed left-1\/2/u)
assert.match(commentReviewBannerSource, /inline-flex w-max max-w-full/u)
assert.doesNotMatch(commentReviewBannerSource, /justify-center border-b bg-muted\/30/u)
const commentRequestSource = readSourceSection(
  commentClientSource,
  '  private async request<T>',
  '\n  }\n}',
)
const bootstrapSource = readSourceSection(
  commentRealtimeHookSource,
  '    bootstrap = async () => {',
  '\n    const hydrateCache = async () => {',
)
const bootstrapRequestStartSource = readSourceSection(
  bootstrapSource,
  '      marker.countRequest()\n',
  '\n      if (cancelled)',
)
const initialOnlineBootstrapSource = readSourceSection(
  commentRealtimeHookSource,
  '    enqueue(async () => {\n      if (navigator.onLine) {',
  '\n      else {',
)
const cacheCursorUpdateSource = readSourceSection(
  commentCacheSource,
  'export async function updateCommentCacheReadCursor(',
  '\nexport async function deleteCommentCacheForPrincipal(',
)
const bootstrapTelemetrySource = readSourceSection(
  commentClientSource,
  'function readBootstrapTelemetry({',
  '\nfunction normalizeMutation(',
)
const bootstrapTelemetryGuardSource = readSourceSection(
  bootstrapTelemetrySource,
  '  if (\n',
  '\n  ) {',
)
const fetchRequestSource = readSourceSection(
  commentRequestSource,
  '    const response = await fetch(',
  '\n    ).catch',
)
const writeCommentCacheSource = readSourceSection(
  commentCacheSource,
  'export async function writeCommentCache(',
  '\nexport async function updateCommentCacheReadCursor(',
)
const updateThreadReadCursorSource = readSourceSection(
  commentCacheSource,
  'export async function updateCommentCacheThreadReadCursor(',
  '\nexport async function deleteCommentCache(',
)
const cachedBootstrapTypeSource = readSourceSection(
  commentCacheSource,
  'export type CachedCommentBootstrap = Omit<',
  '\n\nexport interface CommentCacheEntry',
)
const bootstrapTelemetryDecisionSource = readSourceSection(
  commentRequestSource,
  '    const telemetry = op === \'bootstrap_scope\'',
  '\n    return {',
)

function verifyBootstrapTelemetryGuard(candidate: string) {
  assert.equal(candidate, [
    '  if (',
    '    result.protocolVersion !== 1',
    '    || !isCommentAuthMode(meta.authMode)',
    '    || typeof meta.repair !== \'boolean\'',
    '    || typeof meta.coldStart !== \'boolean\'',
  ].join('\n'))
}
verifyBootstrapTelemetryGuard(bootstrapTelemetryGuardSource)
assertMutationRejected(
  'bootstrap protocol/meta OR guard',
  bootstrapTelemetryGuardSource,
  bootstrapTelemetryGuardSource.replace(
    '    || !isCommentAuthMode(meta.authMode)',
    '    && !isCommentAuthMode(meta.authMode)',
  ),
  verifyBootstrapTelemetryGuard,
)
assert.match(commentClientSource, /const telemetry = op === 'bootstrap_scope'/u)
function verifyBootstrapTelemetryDecision(candidate: string) {
  assertSourceOrder(candidate, [
    'const telemetry = op === \'bootstrap_scope\'',
    '? readBootstrapTelemetry({',
    '\n          result,',
    'response.headers.get(\'x-sb-edge-region\')',
    'new TextEncoder().encode(responseText).byteLength',
    '\n        })',
    '\n      : null',
  ])
  assert.equal(candidate.split('\n').filter(line => line === '          result,').length, 1)
  assert.equal(candidate.includes('\n          result:'), false)
}
verifyBootstrapTelemetryDecision(bootstrapTelemetryDecisionSource)
assertMutationRejected(
  'bootstrap telemetry receives original result',
  bootstrapTelemetryDecisionSource,
  bootstrapTelemetryDecisionSource.replace(
    '          result,',
    '          result: { protocolVersion: 1, meta: { authMode: \'anonymous\', repair: false, coldStart: false } },',
  ),
  verifyBootstrapTelemetryDecision,
)
assert.match(commentClientSource, /async bootstrapScope\(\): Promise<CommentApiSuccess<CommentBootstrapResult, CommentResponseTelemetry>>/u)
assert.match(commentClientSource, /if \(!response\.telemetry\)/u)
assertSourceOrder(commentRequestSource, [
  'const authStartedAt = performance.now()',
  'const authToken = await getCommentAuthToken()',
  'clientDurations.auth_token = performance.now() - authStartedAt',
  'const url = new URL(',
  'const requestHeaders = {',
  'const requestBody = JSON.stringify({',
  'const fetchStartedAt = performance.now()',
  'const response = await fetch(',
  'clientDurations.fetch_headers = performance.now() - fetchStartedAt',
  'const responseBodyStartedAt = performance.now()',
  'responseText = await response.text()',
  'payload = JSON.parse(responseText)',
  'clientDurations.response_body = performance.now() - responseBodyStartedAt',
  'if (!response.ok || result.ok !== true)',
  'const telemetry = op === \'bootstrap_scope\'',
])
assert.match(commentRequestSource, /const requestId = isUuid\(input\.requestId\) \? input\.requestId : crypto\.randomUUID\(\)/u)
assert.match(commentRequestSource, /['"]x-request-id['"]: requestId/u)
assert.match(commentRequestSource, /const responseRequestId = isUuid\(responseRequestIdHeader\)/u)
assert.match(commentRequestSource, /url\.searchParams\.set\('forceFunctionRegion', region\)/u)
assert.match(commentRequestSource, /response\.headers\.get\('x-sb-edge-region'\)/u)
assert.doesNotMatch(commentRequestSource, /['"]x-sb-edge-region['"]\s*:/u)
assert.match(commentBenchmarkSource, /url\.searchParams\.set\('forceFunctionRegion', region\)/u)
assert.match(commentBenchmarkSource, /url\.searchParams\.delete\('forceFunctionRegion'\)/u)
assert.equal(
  commentBenchmarkSource.match(/fetch\(requestUrl\(config, region\)/gu)?.length,
  2,
)
assert.match(commentBenchmarkSource, /response\.headers\.get\('x-sb-edge-region'\)/u)
assert.match(commentBenchmarkSource, /samples\.some\(sample => sample\.edgeRegion !== region\)/u)
assert.doesNotMatch(commentBenchmarkSource, /['"]x-sb-edge-region['"]\s*:/u)
assert.match(commentRequestSource, /new TextEncoder\(\)\.encode\(responseText\)\.byteLength/u)
assert.match(commentRequestSource, /serverTiming: response\.headers\.get\('server-timing'\)/u)
assert.doesNotMatch(commentRequestSource, /response\.json\(/u)
assert.doesNotMatch(commentClientSource, /scope_missing/u)
function verifyFetchRequest(candidate: string) {
  assertSourceOrder(candidate, [
    'const response = await fetch(',
    '\n      url,',
    '\n      {',
    'method: \'POST\'',
    'headers: requestHeaders',
    'body: requestBody',
  ])
  assert.equal(candidate.match(/headers: requestHeaders/gu)?.length, 1)
  assert.equal(candidate.match(/body: requestBody/gu)?.length, 1)
}
verifyFetchRequest(fetchRequestSource)
assertMutationRejected(
  'fetch RequestInit headers wiring',
  fetchRequestSource,
  fetchRequestSource.replace('        headers: requestHeaders,\n', ''),
  verifyFetchRequest,
)
assertSourceOrder(commentClientSource, [
  'const normalizeStartedAt = performance.now()',
  'const data = normalizeBootstrap(response.data)',
  'const normalizeDuration = performance.now() - normalizeStartedAt',
  'normalize: normalizeDuration',
])
function verifyFrozenRequestAccess(candidate: string) {
  assertSourceOrder(candidate, [
    'const access = this.access',
    'const accessBody = this.accessBody(access)',
    'const authToken = await getCommentAuthToken()',
    '...accessBody,',
    '...(access.kind === \'share\'',
  ])
  assert.equal(candidate.match(/this\.access\b/gu)?.length, 1)
}
verifyFrozenRequestAccess(commentRequestSource)
assertMutationRejected(
  'comment request freezes access before auth await',
  commentRequestSource,
  commentRequestSource.replace(
    '    const access = this.access\n    const accessBody = this.accessBody(access)\n',
    '',
  ),
  verifyFrozenRequestAccess,
)

assert.match(commentCacheSource, /export interface CommentCacheEntry \{\s*protocolVersion: 1/u)
assert.match(commentCacheSource, /if \(!isCommentCacheEntryCompatible\(entry\)\)\s*return null/u)
assert.match(commentCacheSource, /protocolVersion: 1,\s*key: serializedKey/u)
assert.match(cacheCursorUpdateSource, /if \(isCommentCacheEntryCompatible\(current\)\) \{[\s\S]*?transaction\.store\.put/u)
assert.match(commentCacheSource, /export async function deleteCommentCache\(key: CommentCacheKey\)/u)
assert.match(commentCacheSource, /new Set\(cacheValue\.threads\.map\(thread => thread\.id\)\)/u)
assert.match(commentCacheSource, /const cacheOperationQueues = new Map<string, Promise<void>>\(\)/u)
assert.match(commentCacheSource, /if \(fence && !isCommentCacheWriteFenceCurrent\(fence\)\)[\s\S]*?return false/u)
assert.match(commentCacheSource, /advanceCommentCacheMutationGeneration\(\)[\s\S]*?enqueueCommentCacheOperation/u)
assertSourceOrder(updateThreadReadCursorSource, [
  'persistCommentThreadReadCursor(key, threadId, eventSeq)',
  'const database = getDatabase()',
  'const current = await transaction.store.get(serializedKey)',
])
assert.match(commentCacheSource, /export function pruneCommentThreadReadCursors\(/u)
assert.doesNotMatch(commentCacheSource, /CommentResponseTelemetry|authMode|coldStart|repair|requestId|serverTiming|accessToken|jwt/iu)
assert.equal(cachedBootstrapTypeSource, [
  'export type CachedCommentBootstrap = Omit<',
  '  CommentBootstrapResult,',
  '  \'scopeRealtime\' | \'ownerRealtime\'',
  '>',
].join('\n'))
function verifyCacheProjection(candidate: string) {
  assert.match(
    candidate,
    /const \{ scopeRealtime: _scopeRealtime, ownerRealtime: _ownerRealtime, \.\.\.cacheValue \} = value/u,
  )
  assertSourceOrder(candidate, [
    '...cacheValue } = value',
    'const nextValue = advanceCommentReadCursor(',
    '\n        ...cacheValue,',
    'threadReadStates: mergeCachedThreadReadStates(',
    '\n      value: nextValue,',
  ])
  assert.doesNotMatch(candidate, /const cacheValue = value/u)
}
verifyCacheProjection(writeCommentCacheSource)
assertMutationRejected(
  'cache token-safe projection',
  writeCommentCacheSource,
  writeCommentCacheSource.replace(
    '  const { scopeRealtime: _scopeRealtime, ownerRealtime: _ownerRealtime, ...cacheValue } = value',
    '  const cacheValue = value',
  ),
  verifyCacheProjection,
)

assertSourceOrder(bootstrapSource, [
  'const responsePromise = client.bootstrapScope()',
  'const authenticatedUserIdPromise = client.getAuthenticatedUserId()',
  'const response = await responsePromise',
  'marker.mergeClientDurations(response.telemetry.clientDurations)',
  'const authenticatedUserId = await authenticatedUserIdPromise',
  'currentState.lastEventSeq > response.eventSeq',
  'detail: { status: \'superseded\' }',
  'marker.measureSync(\'store_commit\'',
  'marker.measureSync(\n        \'realtime_connect\'',
  'detail: { threadCount: response.data.threads.length }',
  'void writeCommentCache(cacheKey, {',
  'void client.markRead(persistedReadEventSeq).catch',
])
function verifySupersededBootstrapReconnect(candidate: string) {
  assertSourceOrder(candidate, [
    'const currentState = store.getState()',
    'const sameScope = currentState.scope?.id === response.data.scope.id',
    'if (sameScope) {',
    '() => connectRealtime(response.data.scopeRealtime)',
    'detail: { status: \'superseded\' }',
    '\n        return\n      }\n      if (cacheKey)',
  ])
}
verifySupersededBootstrapReconnect(bootstrapSource)
assertMutationRejected(
  'superseded bootstrap reconnects same scope realtime',
  bootstrapSource,
  bootstrapSource.replace(
    '            () => connectRealtime(response.data.scopeRealtime),\n',
    '',
  ),
  verifySupersededBootstrapReconnect,
)
assertSourceOrder(bootstrapSource, [
  'const liveThreadIds = new Set(response.data.threads.map(thread => thread.id))',
  'readCommentThreadReadCursors(cacheKey)',
  'const serverThreadReadStateById = new Map(',
  'detail: { status: \'superseded\' }',
  'pruneCommentThreadReadCursors(cacheKey, liveThreadIds)',
  'marker.measureSync(\'store_commit\'',
])
assertSourceOrder(bootstrapSource, [
  'const serverState = serverThreadReadStateById.get(cachedState.threadId)',
  'if (!serverState)',
  'continue',
  'client.markThreadRead(',
])
function verifyBootstrapRequestStart(candidate: string) {
  assertSourceOrder(candidate, [
    'const responsePromise = client.bootstrapScope()',
    'const authenticatedUserIdPromise = client.getAuthenticatedUserId()',
    'const response = await responsePromise',
  ])
}
verifyBootstrapRequestStart(bootstrapRequestStartSource)
assertMutationRejected(
  'bootstrap starts auth_token timing before shared auth lookup',
  bootstrapRequestStartSource,
  bootstrapRequestStartSource.replace(
    [
      '      const responsePromise = client.bootstrapScope()',
      '      const authenticatedUserIdPromise = client.getAuthenticatedUserId()',
    ].join('\n'),
    [
      '      const authenticatedUserIdPromise = client.getAuthenticatedUserId()',
      '      const responsePromise = client.bootstrapScope()',
    ].join('\n'),
  ),
  verifyBootstrapRequestStart,
)
function verifyInitialOnlineBootstrapStart(candidate: string) {
  assertSourceOrder(candidate, [
    'if (navigator.onLine) {',
    'try {',
    'await bootstrap()',
    'catch (error)',
    'await hydrateCache().catch(() => undefined)',
    'throw error',
  ])
  assert.doesNotMatch(candidate, /Promise\.all|cacheHydrationPromise/u)
}
verifyInitialOnlineBootstrapStart(initialOnlineBootstrapSource)
assertMutationRejected(
  'online bootstrap remains network-first',
  initialOnlineBootstrapSource,
  initialOnlineBootstrapSource.replace(
    '          await bootstrap()',
    '          await Promise.all([bootstrap(), hydrateCache()])',
  ),
  verifyInitialOnlineBootstrapStart,
)
assert.doesNotMatch(bootstrapSource, /await\s+(?:writeCommentCache|client\.markRead)/u)
assert.match(commentRealtimeHookSource, /if \(!cached \|\| cancelled\)/u)
assert.doesNotMatch(commentRealtimeHookSource, /hasFreshBootstrap/u)
assert.match(commentRealtimeHookSource, /applyRealtimePatch\([\s\S]*?deleteCommentCache\(cacheKey\)/u)
assert.equal(commentActionsSource.match(/await deleteCommentCache\(/gu)?.length, 3)
assert.doesNotMatch(commentActionsSource, /restoreReadSnapshot/u)
assertSourceOrder(commentActionsSource, [
  'error.code === \'not_found\'',
  'store.getState().finishPending(entityKey)',
  'onIdempotentNotFound()',
  'detail: { status: \'already_deleted\' }',
  'return null',
])
assert.ok((commentActionsSource.match(/if \(!isReadContextCurrent\(\)\)/gu)?.length ?? 0) >= 4)
assert.match(commentActionsSource, /const deleteComment = useCallback\([\s\S]*?alreadyDeleted \? true : null/u)
assert.match(commentActionsSource, /const deleteThread = useCallback\([\s\S]*?alreadyDeleted \? true : null/u)
assertSourceOrder(commentActionsSource, [
  'store.getState().markThreadReadLocally(threadId, eventSeq)',
  'await updateCommentCacheThreadReadCursor(',
  'const response = await client.markThreadRead(threadId, eventSeq)',
])

assert.doesNotMatch(commentPerformanceSource, /performanceBudgets|clientOverhead|warningMs|targetMs/u)
assert.doesNotMatch(commentPerformanceSource, /['"]db['"]/u)
assert.match(threadListSource, /<\/button>[\s\S]*?<CommentStatusBar/u)
assert.doesNotMatch(threadListSource, /<Button[\s\S]*?<CommentStatusBar/u)

console.warn('resume comment client verification passed')
