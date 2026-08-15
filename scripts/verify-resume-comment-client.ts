import type { ResumeCommentThread } from '../src/features/resume-comments/types.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deriveAnonymousAvatarVisual } from '../src/features/resume-comments/api/anonymous-identity.ts'
import {
  advanceCommentReadCursor,
  deriveCommentCacheKey,
  isCommentCacheEntryCompatible,
  serializeCommentCacheKey,
} from '../src/features/resume-comments/api/cache.ts'
import {
  calculateCommentTransportOverhead,
  getCommentPerformanceSnapshot,
  parseCommentServerTiming,
  recordCommentPerformanceSample,
  resetCommentPerformanceSamples,
} from '../src/features/resume-comments/api/performance.ts'
import { decideCommentRealtimeRecovery } from '../src/features/resume-comments/api/realtime-recovery.ts'
import { createResumeCommentStore } from '../src/features/resume-comments/store/create-store.ts'
import { getUnreadCommentThreadIds } from '../src/features/resume-comments/store/read-state.ts'

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
const beforeThreadRead = threadReadStore.getState().markThreadReadLocally('thread-a', 9)
assert.deepEqual(unreadThreadIds(), ['thread-b'])
threadReadStore.getState().restoreReadSnapshot(beforeThreadRead)
assert.deepEqual(unreadThreadIds(), ['thread-a', 'thread-b'])
threadReadStore.getState().markAllReadLocally(10)
assert.deepEqual(unreadThreadIds(), [])

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
assert.match(commentTreeSource, /depth < 2/u)
assert.match(commentTreeSource, /depth >= 2/u)
assert.match(commentTreeSource, /pl-7/u)
assert.match(commentTreeSource, /-top-px left-0 h-\[calc\(1\.75rem\+1px\)\] w-7 rounded-bl-xl/u)
assert.match(commentTreeSource, /-bottom-px left-0 top-\[calc\(1\.75rem-1px\)\]/u)
assert.match(commentTreeSource, /<div className="ml-4 min-w-0">/u)
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
assert.match(commentActionsSource, /latestCommentEventSeq <= Math\.max/u)
assert.match(commentSelectionSource, /document\.addEventListener\('pointerup', handlePointerEnd, true\)/u)
assert.match(commentSelectionSource, /document\.addEventListener\('pointercancel', handlePointerEnd, true\)/u)
assert.match(commentSelectionSource, /pointerSelecting\.current \|\| keyboardSelecting\.current/u)
assert.match(commentSelectionSource, /completionArmed\.current/u)
assert.match(commentSelectionSource, /scheduleEvaluation\(120\)/u)
assert.equal(commentSelectionSource.match(/requestAnimationFrame\(/gu)?.length, 2)
assert.match(threadDetailSource, /flex shrink-0 items-center/u)
assert.match(threadDetailSource, /shrink-0 border-t p-3/u)
assert.match(commentMobileLayoutSource, /\(hover: none\) and \(pointer: coarse\) and \(max-width: 1024px\)/u)
assert.doesNotMatch(commentBookmarkSource, /h-14 w-12/u)
assert.match(drawerSource, /overlayClassName\?: string/u)
assert.match(drawerSource, /data-base-ui-swipe-ignore=""/u)
assert.match(editorSource, /<CommentReviewBanner/u)
assert.doesNotMatch(editorSource, /presentation="docked"/u)
assert.doesNotMatch(commentSurfaceSource, /presentation/u)
assert.match(commentsPanelSource, /key="resume-comments-desktop"[\s\S]*?modal[\s\S]*?swipeDirection="right"/u)
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

assert.match(commentCacheSource, /export interface CommentCacheEntry \{\s*protocolVersion: 1/u)
assert.match(commentCacheSource, /if \(!isCommentCacheEntryCompatible\(entry\)\)\s*return null/u)
assert.match(commentCacheSource, /protocolVersion: 1,\s*key: serializedKey/u)
assert.match(cacheCursorUpdateSource, /if \(isCommentCacheEntryCompatible\(current\)\) \{[\s\S]*?transaction\.store\.put/u)
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
    '\n      ...cacheValue,',
    'threadReadStates: mergeThreadReadStates(',
    '\n    value: nextValue,',
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
  'hasFreshBootstrap = true',
  'marker.mergeClientDurations(response.telemetry.clientDurations)',
  'const authenticatedUserId = await authenticatedUserIdPromise',
  'marker.measureSync(\'store_commit\'',
  'marker.measureSync(\n        \'realtime_connect\'',
  'marker.end({',
  'void writeCommentCache(cacheKey, {',
  'void client.markRead(persistedReadEventSeq).catch',
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
    'const bootstrapPromise = bootstrap()',
    'const cacheHydrationPromise = hydrateCache().catch(() => undefined)',
    'await Promise.all([',
    '\n          bootstrapPromise,',
    '\n          cacheHydrationPromise,',
  ])
}
verifyInitialOnlineBootstrapStart(initialOnlineBootstrapSource)
assertMutationRejected(
  'initial online bootstrap starts before cache hydration',
  initialOnlineBootstrapSource,
  initialOnlineBootstrapSource.replace(
    [
      '        const bootstrapPromise = bootstrap()',
      '        const cacheHydrationPromise = hydrateCache().catch(() => undefined)',
    ].join('\n'),
    [
      '        const cacheHydrationPromise = hydrateCache().catch(() => undefined)',
      '        const bootstrapPromise = bootstrap()',
    ].join('\n'),
  ),
  verifyInitialOnlineBootstrapStart,
)
assert.doesNotMatch(bootstrapSource, /await\s+(?:writeCommentCache|client\.markRead)/u)
assert.match(commentRealtimeHookSource, /!cached \|\| cancelled \|\| hasFreshBootstrap/u)

assert.doesNotMatch(commentPerformanceSource, /performanceBudgets|clientOverhead|warningMs|targetMs/u)
assert.doesNotMatch(commentPerformanceSource, /['"]db['"]/u)
assert.match(threadListSource, /<\/button>[\s\S]*?<CommentStatusBar/u)
assert.doesNotMatch(threadListSource, /<Button[\s\S]*?<CommentStatusBar/u)

console.warn('resume comment client verification passed')
