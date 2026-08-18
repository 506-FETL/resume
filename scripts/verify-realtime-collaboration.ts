import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { next as Automerge } from '@automerge/automerge'
import { parseAutomergeUrl, Repo } from '@automerge/automerge-repo'
import { createJiti } from 'jiti'

function readSource(path: string) {
  return readFileSync(path, 'utf8')
}

function readSourceSection(
  source: string,
  startMarker: string,
  endMarker: string,
  label: string,
) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `${label}：缺少源码起点 ${startMarker}`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(end, -1, `${label}：缺少源码终点 ${endMarker}`)
  assert.ok(end > start, `${label}：源码终点位于起点之前`)
  return source.slice(start, end)
}

function assertSourceOrder(label: string, source: string, markers: string[]) {
  let previous = -1

  for (const marker of markers) {
    const current = source.indexOf(marker, previous + 1)
    assert.notEqual(current, -1, `${label}：缺少源码标记 ${marker}`)
    assert.ok(current > previous, `${label}：源码顺序错误 ${marker}`)
    previous = current
  }
}

function assertContains(label: string, source: string, marker: string) {
  assert.ok(source.includes(marker), `${label}：缺少源码标记 ${marker}`)
}

function assertNotContains(label: string, source: string, marker: string) {
  assert.ok(!source.includes(marker), `${label}：禁止出现源码标记 ${marker}`)
}

const jiti = createJiti(import.meta.url)
const { sanitizeAppRedirect } = await jiti.import<
  typeof import('../src/lib/auth/redirect.ts')
>('../src/lib/auth/redirect.ts')
const { decodeDocumentData, encodeBytesToBase64 } = await jiti.import<
  typeof import('../src/lib/automerge/shared/utils.ts')
>('../src/lib/automerge/shared/utils.ts')

// 同一份 Automerge 二进制快照无论来自原始字节、Base64 还是 PostgreSQL
// bytea 文本，都必须按邀请 URL 的 documentId 导入，而不是创建随机空文档。
const sourceRepo = new Repo()
const sourceHandle = sourceRepo.create<{ value: string }>()
sourceHandle.change((doc) => {
  doc.value = '协作快照'
})
const sourceDocument = sourceHandle.doc()
assert.ok(sourceDocument, '动态快照：源 Automerge 文档未就绪')
const binary = Automerge.save(sourceDocument)
const { documentId } = parseAutomergeUrl(sourceHandle.url)

async function assertImportedSnapshot(label: string, bytes: Uint8Array) {
  const targetRepo = new Repo()
  const imported = targetRepo.import<{ value: string }>(bytes, { docId: documentId })
  await imported.whenReady()
  assert.equal(imported.documentId, documentId, `${label}：导入后 documentId 发生变化`)
  assert.equal(imported.doc()?.value, '协作快照', `${label}：导入后快照内容丢失`)
}

const base64 = encodeBytesToBase64(binary)
const bytea = `\\x${Buffer.from(binary).toString('hex')}`
const decodedBase64 = decodeDocumentData(base64)
const decodedBytea = decodeDocumentData(bytea)
assert.ok(decodedBase64, '动态快照：Base64 未解码为字节')
assert.ok(decodedBytea, '动态快照：bytea 未解码为字节')
assert.deepEqual(decodedBase64, binary, '动态快照：Base64 解码结果与原始二进制不一致')
assert.deepEqual(decodedBytea, binary, '动态快照：bytea 解码结果与原始二进制不一致')
await assertImportedSnapshot('动态快照/原始二进制', binary)
await assertImportedSnapshot('动态快照/Base64', decodedBase64)
await assertImportedSnapshot('动态快照/bytea', decodedBytea)

// 登录返回地址只允许站内绝对路径；query/hash 可保留，但路径中的原始、单层或
// 多层编码反斜杠与双斜杠都必须被拒绝。
const legalRedirect = '/resume/editor?resumeId=resume-1&next=%2Fresume%2Feditor#collaboration'
assert.equal(
  sanitizeAppRedirect(legalRedirect),
  legalRedirect,
  'redirect：合法 query/hash 未被原样保留',
)
assert.equal(
  sanitizeAppRedirect('/resume/editor?target=//evil.example#/%252f%252fevil.example'),
  '/resume/editor?target=//evil.example#/%252f%252fevil.example',
  'redirect：query/hash 不应被误判为跨站路径',
)
for (const unsafeRedirect of [
  'https://evil.example/resume',
  '//evil.example/resume',
  '/\\evil.example/resume',
  '/%2f%2fevil.example/resume',
  '/%5cevil.example/resume',
  '/%252f%252fevil.example/resume',
  '/%255cevil.example/resume',
  '/%25252f%25252fevil.example/resume',
]) {
  assert.equal(
    sanitizeAppRedirect(unsafeRedirect),
    '/resume',
    `redirect：危险返回地址未被拒绝 ${unsafeRedirect}`,
  )
}

const edgeSource = readSource('supabase/functions/resume-comments/index.ts')
const documentManagerSource = readSource('src/lib/automerge/document/manager.ts')
const documentPersistenceSource = readSource('src/lib/automerge/document/persistence.ts')
const adapterSource = readSource('src/lib/automerge/collaboration/supabase-network-adapter.ts')
const sessionStoreSource = readSource('src/lib/collaboration/session/store.ts')
const sessionCallbacksSource = readSource('src/lib/collaboration/session/callbacks.ts')
const leaseSource = readSource('src/lib/collaboration/session/lease.ts')
const loaderSource = readSource('src/pages/resume/editor/hooks/use-resume-loader.ts')
const collaborationPanelSource = readSource(
  'src/pages/resume/editor/hooks/use-collaboration-panel-value.ts',
)
const documentSliceSource = readSource('src/store/resume/slices/document.ts')
const syncSliceSource = readSource('src/store/resume/slices/sync.ts')

const edgeBootstrapSource = readSourceSection(
  edgeSource,
  'async function loadCollaborationDocumentBootstrap(',
  '\nasync function issueCollaboratorToken',
  'Edge 协作快照查询',
)
assertSourceOrder('Edge 协作快照查询', edgeBootstrapSource, [
  '.from(\'automerge_documents\')',
  '.select(\'document_data,heads,document_version,updated_at\')',
  '.eq(\'resume_id\', session.resume_id)',
  '.eq(\'user_id\', session.owner_user_id)',
  '.maybeSingle()',
])
assertSourceOrder('Edge 协作快照 fail-closed', edgeBootstrapSource, [
  'if (error)',
  'typeof row.document_data !== \'string\'',
  '\'collaboration_snapshot_unavailable\'',
  'documentData: row.document_data',
])
assertNotContains('Edge 协作快照查询', edgeBootstrapSource, '.select(\'*\')')

const edgeOwnerJoinGateSource = readSourceSection(
  edgeSource,
  '  const session = await getActiveCollaborationSession(admin, sessionId, resumeId)',
  '  const protocolVersion = negotiateCollaborationProtocolVersion(',
  'Edge owner join 门禁',
)
assertSourceOrder('Edge owner join 门禁', edgeOwnerJoinGateSource, [
  'if (op === \'join_collaboration_session\' && session.owner_user_id === userId)',
  '\'owner_must_host\'',
  '409',
])
assertNotContains('Edge owner join 门禁', edgeOwnerJoinGateSource, '\'unauthorized\'')

const managerInitializeSource = readSourceSection(
  documentManagerSource,
  '  async initialize() {',
  '\n  canPersist() {',
  'DocumentManager 初始化',
)
const guestInitializeSource = readSourceSection(
  managerInitializeSource,
  '    if (this.source.kind === \'collaboration\') {',
  '\n    const existingHandle =',
  'DocumentManager guest 初始化',
)
assertSourceOrder('DocumentManager guest 初始化', guestInitializeSource, [
  'this.persistence.importCollaborationHandle(',
  'this.source.documentUrl',
  'this.source.documentData',
  'return this.attachHandle(handle)',
])
for (const forbidden of [
  'loadPersistedHandle',
  'loadResumeConfig',
  'createResumeDocument',
  'saveToSupabase',
]) {
  assertNotContains('DocumentManager guest 初始化', guestInitializeSource, forbidden)
}

const guestImportSource = readSourceSection(
  documentPersistenceSource,
  '  async importCollaborationHandle(',
  '\n  async loadResumeConfig()',
  '共享快照导入',
)
assertSourceOrder('共享快照导入', guestImportSource, [
  'parseAutomergeUrl(documentUrl as AutomergeUrl)',
  'decodeDocumentData(documentData)',
  'repo.import<AutomergeResumeDocument>(bytes, { docId: documentId })',
  'await handle.whenReady()',
  'doc._metadata?.resumeId !== this.resumeId',
  'return handle',
])
for (const forbidden of ['repo.find', 'repo.create', 'createResumeDocument']) {
  assertNotContains('共享快照导入', guestImportSource, forbidden)
}

const ownerPersistenceReadSource = readSourceSection(
  documentPersistenceSource,
  '  async loadPersistedHandle(',
  '\n  async importCollaborationHandle(',
  'owner Automerge 读取',
)
assertSourceOrder('owner Automerge 读取', ownerPersistenceReadSource, [
  'const snapshot = await this.fetchSnapshotRow()',
  'decodeDocumentData(snapshot.document_data)',
  'throw new Error(\'持久化简历文档解码失败\'',
  'repo.import<AutomergeResumeDocument>(bytes)',
  'await handle.whenReady()',
  'throw new Error(\'持久化简历文档导入失败\'',
])

const ownerConfigReadSource = readSourceSection(
  documentPersistenceSource,
  '  async loadResumeConfig()',
  '\n  async saveHandle(',
  'owner resume_config 读取',
)
assertSourceOrder('owner resume_config 读取', ownerConfigReadSource, [
  '.from(\'resume_config\')',
  '.eq(\'resume_id\', this.resumeId)',
  '.eq(\'user_id\', this.userId)',
  '.maybeSingle()',
  'if (error)',
  'throw new Error(\'读取所有者简历配置失败\'',
  'if (!data)',
  'throw new Error(\'所有者简历配置不存在，无法初始化文档\')',
])

const ownerSnapshotQuerySource = readSourceSection(
  documentPersistenceSource,
  '  private async fetchSnapshotRow()',
  '\n}\n\nif (import.meta.hot)',
  'owner Automerge 行查询',
)
assertSourceOrder('owner Automerge 行查询', ownerSnapshotQuerySource, [
  '.from(\'automerge_documents\')',
  '.eq(\'resume_id\', this.resumeId)',
  '.maybeSingle()',
  'if (error)',
  'if (data === null)',
  'if (data === undefined)',
  'throw new Error(\'读取持久化简历文档失败：服务端未返回明确结果\')',
])

const ownerInitializeSource = managerInitializeSource.slice(
  managerInitializeSource.indexOf('    const existingHandle ='),
)
assertSourceOrder('owner 文档初始化与初始保存', ownerInitializeSource, [
  'this.persistence.loadPersistedHandle(repo)',
  'if (existingHandle)',
  'return this.attachHandle(existingHandle)',
  'this.persistence.loadResumeConfig()',
  'createResumeDocument({',
  'if (this.persistence.canPersist())',
  'await this.saveToSupabase(handle)',
  'return this.attachHandle(handle)',
])
const managerSaveSource = readSourceSection(
  documentManagerSource,
  '  async saveToSupabase(',
  '\n  async enableCollaboration(',
  'owner 初始保存失败传播',
)
assertSourceOrder('owner 初始保存失败传播', managerSaveSource, [
  'const result = await this.persistence.saveHandle(handle)',
  'if (!result.success)',
  'throw normalizeSaveError(result.error)',
])

const routeParserSource = readSourceSection(
  loaderSource,
  'function parseCollaborationRoute(',
  '\nfunction getCollaborationLoadKey(',
  '协作路由解析',
)
assertSourceOrder('协作路由解析', routeParserSource, [
  'params.has(\'collabSession\')',
  'params.has(\'docUrl\')',
  'return { kind: \'host-recovery\', resumeId, sessionId }',
  'parseAutomergeUrl(documentUrl as AutomergeUrl)',
  'kind: \'invite\'',
])
assertContains('协作路由解析', routeParserSource, 'return { kind: \'invalid\' }')

const loadKeySource = readSourceSection(
  loaderSource,
  'function getCollaborationLoadKey(',
  '\nfunction hydrateLoadedAppearance(',
  '协作文档 loadKey',
)
assertSourceOrder('协作文档 loadKey', loadKeySource, [
  'if (route.kind === \'invalid\')',
  'if (route.kind === \'invite\')',
  'route.sessionId',
  'route.documentId',
  'return activeResumeId ? `resume:' + '$' + '{activeResumeId}` : \'empty\'',
])

const loaderEffectSource = readSourceSection(
  loaderSource,
  '  // effect 只以稳定文档身份为键',
  '\n  // 监听简历删除',
  '简历加载编排 effect',
)
assertNotContains('简历加载编排 effect', loaderEffectSource, 'getCurrentUser')
const ownerNoOpSource = readSourceSection(
  loaderEffectSource,
  '    const expectedDocumentSource = route.kind === \'invite\' ? \'collaboration\' : \'owner\'',
  '    const isCollaborationRoute =',
  '已加载 owner 文档 no-op 门禁',
)
assertSourceOrder('已加载 owner 文档 no-op 门禁', ownerNoOpSource, [
  'loadedIdentity.source === expectedDocumentSource',
  'loadedIdentity.loadKey === loadKey',
  'resumeState.docManager.canPersist() === (expectedDocumentSource === \'owner\')',
  'const isCurrentHostUrlTransition',
  'if (hasReusableDocument && (route.kind === \'none\' || isCurrentHostUrlTransition))',
  'setLoading(false)',
  'return () =>',
])
const noOpGateIndex = loaderEffectSource.indexOf(
  'if (hasReusableDocument && (route.kind === \'none\' || isCurrentHostUrlTransition))',
)
for (const destructiveMarker of [
  'useResumeConfigStore.getState().discardSpacingPreview()',
  'setLoading(true)',
  'const loadOwnerResume = async',
  'await loadResumeData(',
  'await useCollaborationStore.getState().resumeHosting(params)',
  'const runLoad = async',
]) {
  const destructiveIndex = loaderEffectSource.indexOf(destructiveMarker)
  assert.notEqual(destructiveIndex, -1, `已加载 owner 文档 no-op 门禁：缺少后续标记 ${destructiveMarker}`)
  assert.ok(
    noOpGateIndex < destructiveIndex,
    `已加载 owner 文档 no-op 门禁：${destructiveMarker} 不得早于 no-op`,
  )
}

const authGateSource = readSourceSection(
  loaderEffectSource,
  '    const isCollaborationRoute =',
  '    useResumeConfigStore.getState().discardSpacingPreview()',
  '邀请鉴权与登录跳转',
)
assertSourceOrder('邀请鉴权与登录跳转', authGateSource, [
  'authState.authStatus === \'unknown\'',
  'markInviteAuthenticating()',
  'authState.authStatus === \'anonymous\'',
  'sanitizeAppRedirect(',
  'encodeURIComponent(redirect)',
  '{ replace: true }',
])

const runLoadSource = readSourceSection(
  loaderEffectSource,
  '    const runLoad = async () => {',
  '\n    runLoad().catch(',
  '协作邀请分阶段加载',
)
assertSourceOrder('协作邀请分阶段加载', runLoadSource, [
  'preparedGuest = await useCollaborationStore.getState().prepareGuestSession(params)',
  'useCollaborationStore.getState().markGuestSessionHydrating(preparedGuest)',
  'const result = await loadResumeData(route.resumeId,',
  'kind: \'collaboration\'',
  'documentData: preparedGuest.authorization.bootstrap.documentData',
  'hydrateLoadedAppearance(result, { collaborationSource: true })',
  'await useCollaborationStore.getState().connectPreparedGuestSession(preparedGuest)',
  'source: \'collaboration\'',
  'preparedGuest = null\n        toast.info',
])

assertNotContains('协作面板职责边界', collaborationPanelSource, '.joinSession(')
assertNotContains('协作面板职责边界', collaborationPanelSource, '.resumeHosting(')
const panelStartSource = readSourceSection(
  collaborationPanelSource,
  '  const handleStartSharing = useCallback(async () => {',
  '\n  const handleStopSharing = useCallback(',
  '协作面板开启共享',
)
assertSourceOrder('协作面板开启共享', panelStartSource, [
  'await startSharing({',
  'const newSessionId = useCollaborationStore.getState().sessionId',
  'params.set(\'collabSession\', newSessionId)',
  'params.delete(\'docUrl\')',
  'setSearchParams(params, { replace: true })',
])
const panelStopSource = readSourceSection(
  collaborationPanelSource,
  '  const handleStopSharing = useCallback(async () => {',
  '\n  const handleCopyShareLink = useCallback(',
  '协作面板停止共享',
)
assertSourceOrder('协作面板停止共享', panelStopSource, [
  'await stopSharing()',
  'if (collaborationRole === \'guest\')',
  'navigate(\'/resume\', { replace: true })',
  'params.delete(\'collabSession\')',
  'params.delete(\'docUrl\')',
  'params.set(\'resumeId\', activeResumeId)',
  'setSearchParams(params, { replace: true })',
])

const hostStopSource = readSourceSection(
  sessionStoreSource,
  '        try {\n          let result',
  '\n        if (cleaned && !silent)',
  '宿主停止共享事务',
)
assertSourceOrder('宿主停止共享事务', hostStopSource, [
  'result = await leaveCollaborationCommentSession({',
  'if (result?.revoked !== true)',
  'if (state.role === \'host\' && docManager)',
  'await broadcastShareEnded(docManager)',
  'const cleaned = cleanupSession({ generation, remote: false })',
])

const adapterConnectSource = readSourceSection(
  adapterSource,
  '  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {',
  '\n  disconnect() {',
  '协作 Realtime channel',
)
assertContains('协作 Realtime channel', adapterConnectSource, 'broadcast: { ack: true, self: false }')
const controlBroadcastSource = readSourceSection(
  adapterSource,
  '  async broadcastControlMessage(',
  '\n  private registerSyncBroadcast(',
  '协作控制消息确认',
)
assertSourceOrder('协作控制消息确认', controlBroadcastSource, [
  'const result = await this.channel.send({',
  'event: \'automerge-control\'',
  'if (result !== \'ok\')',
  'throw new Error(`协作控制消息发送失败: $' + '{result}`)',
])

assertContains('成员租约续期频率', leaseSource, 'COLLABORATION_LEASE_INTERVAL_MS = 30_000')
const revokedLeaseSource = readSourceSection(
  leaseSource,
  'export function isCollaborationRevokedError(',
  '\nexport function startCollaborationLeaseMonitor(',
  '成员租约失效识别',
)
assertContains('成员租约失效识别', revokedLeaseSource, 'error.code === \'unauthorized\' || error.status === 401')
const guestLeaseSource = readSourceSection(
  sessionStoreSource,
  '  const startGuestLease = (prepared: PreparedGuestSession) => {',
  '\n  const executeStartSharing = async',
  '成员租约远端结束处理',
)
assertSourceOrder('成员租约远端结束处理', guestLeaseSource, [
  'onRevoked: (error) =>',
  'cleanupSession({',
  'generation: prepared.generation',
  'remote: true',
])

const retirePendingMembershipSource = readSourceSection(
  sessionStoreSource,
  '  const retirePendingGuestMembership = (membership: PendingGuestMembership) => {',
  '\n  const setPhase =',
  '待定成员撤销',
)
assertSourceOrder('待定成员撤销', retirePendingMembershipSource, [
  'releaseGuestMembership(membership, { bestEffort: true })',
  'clearPendingGuestMembership(membership)',
])
const prepareGuestSource = readSourceSection(
  sessionStoreSource,
  '    prepareGuestSession: async (params) => {',
  '\n    markGuestSessionHydrating:',
  '协作者 join 前租约登记',
)
assertSourceOrder('协作者 join 前租约登记', prepareGuestSource, [
  'const memberLeaseId = crypto.randomUUID()',
  'const membership: PendingGuestMembership =',
  'pendingGuestMembership = membership',
  'joinAttempted = true',
  'await joinCollaborationCommentSession({',
  'await releaseGuestMembership(membership, { bestEffort: true })',
  'clearPendingGuestMembership(membership)',
])
const bestEffortStopSource = readSourceSection(
  sessionStoreSource,
  '        if (bestEffort) {',
  '\n        try {\n          let result',
  '协作者 best-effort 停止',
)
assertSourceOrder('协作者 best-effort 停止', bestEffortStopSource, [
  'if (state.role === \'guest\')',
  'const pendingMembership = getCurrentPendingGuestMembership(generation, state)',
  'releaseGuestMembership({',
  '}, { bestEffort: true })',
  'else if (pendingMembership)',
  'retirePendingGuestMembership(pendingMembership)',
  'cleanupSession({ generation, remote: false })',
])

const remoteControlSource = readSourceSection(
  sessionCallbacksSource,
  '    onControlMessage: ({ type }) => {',
  '\n    },\n  }',
  '共享结束控制消息',
)
assertSourceOrder('共享结束控制消息', remoteControlSource, [
  'isCurrentSession()',
  'type === \'share-ended\'',
  'getState().role !== \'host\'',
  'getState().handleRemoteShareEnd()',
])
const remoteCleanupSource = readSourceSection(
  sessionStoreSource,
  '    handleRemoteShareEnd: () => {',
  '\n    acknowledgeRemoteShareEnd:',
  '协作者被远端踢出',
)
assertSourceOrder('协作者被远端踢出', remoteCleanupSource, [
  'if (state.role !== \'guest\')',
  'cleanupSession({ generation: activeGeneration, remote: true })',
])

const guestSyncEntrySource = readSourceSection(
  syncSliceSource,
  '    syncToSupabase: async () => {',
  '\n    manualSync: async () => {',
  'guest owner-write 门禁',
)
const guestPersistGuardSource = readSourceSection(
  guestSyncEntrySource,
  '      if (!state.docManager.canPersist()) {',
  '\n      const target = getOnlineTarget(state)',
  'guest owner-write 持久化门禁',
)
assertSourceOrder('guest owner-write 持久化门禁', guestPersistGuardSource, [
  'if (!state.docManager.canPersist())',
  'pendingChanges: false',
  'return',
])
assertSourceOrder('guest owner-write 门禁', guestSyncEntrySource, [
  'if (!state.docManager.canPersist())',
  'const target = getOnlineTarget(state)',
  'await syncOnlineTarget(target)',
])
assertNotContains('guest owner-write 门禁', guestSyncEntrySource, 'updateResumeConfig(')
const onlineTargetSource = readSourceSection(
  syncSliceSource,
  '  const getOnlineTarget = (state: ResumeState)',
  '\n  const isCurrentTarget =',
  'owner 在线同步目标',
)
assertSourceOrder('owner 在线同步目标', onlineTargetSource, [
  '!state.docManager.canPersist()',
  'return null',
  'manager: state.docManager',
  'revision: state.documentChangeRevision',
])
const onlineDrainSource = readSourceSection(
  syncSliceSource,
  '  const drainOnlineSync = async',
  '\n  const syncOnlineTarget = async',
  'owner 在线同步 drain',
)
assertSourceOrder('owner 在线同步 drain', onlineDrainSource, [
  'while (true)',
  'const target = getOnlineTarget(state)',
  'await target.manager.saveToSupabase(target.handle)',
  'get().documentChangeRevision !== target.revision',
  'await updateResumeConfig(target.resumeId, persistedPayload)',
  'get().documentChangeRevision !== target.revision',
  'await notifyWorkingDocumentPersisted(',
  'get().documentChangeRevision !== target.revision',
  'const isStable = latestState.documentChangeRevision === target.revision',
])
const singleActiveDrainSource = readSourceSection(
  syncSliceSource,
  '  const syncOnlineTarget = async',
  '\n  return {',
  'owner 单实例 drain',
)
assertSourceOrder('owner 单实例 drain', singleActiveDrainSource, [
  'let operation = onlineSyncOperation',
  'if (!operation)',
  'const drainPromise = drainOnlineSync(request)',
  'onlineSyncOperation = operation',
  'const outcome = await operation',
  'await syncOnlineTarget(latestTarget)',
])

const documentChangeSource = readSourceSection(
  documentSliceSource,
  '        const changeHandler = ({ doc }:',
  '\n        handle.on(\'change\', changeHandler)',
  'owner CRDT change 持久化调度',
)
assertSourceOrder('owner CRDT change 持久化调度', documentChangeSource, [
  'const canPersist = manager?.canPersist() === true',
  'pendingChanges: canPersist ? true : prev.pendingChanges',
  'documentChangeRevision: canPersist',
  'prev.documentChangeRevision + 1',
  'if (canPersist)',
  'scheduleOnlinePersist(() => get().syncToSupabase())',
])

const hostConnectSource = readSourceSection(
  sessionStoreSource,
  '  const connectHostSession = async',
  '\n  const startGuestLease =',
  '宿主共享前快照',
)
assertSourceOrder('宿主共享前快照', hostConnectSource, [
  'if (options.saveSnapshot)',
  'await useResumeStore.getState().syncToSupabase()',
  'const resumeState = useResumeStore.getState()',
  'if (resumeState.syncError)',
  'throw new Error(`共享前保存简历失败：$' + '{resumeState.syncError}`)',
  'await registerCollaborationCommentSession({',
])
assertNotContains('宿主共享前快照', hostConnectSource, 'docManager.saveToSupabase(')

// eslint-disable-next-line no-console
console.log('Realtime collaboration verification passed.')
