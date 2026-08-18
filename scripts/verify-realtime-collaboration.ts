import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { next as Automerge } from '@automerge/automerge'
import { parseAutomergeUrl, Repo } from '@automerge/automerge-repo'
import { createJiti } from 'jiti'
import { matchPath } from 'react-router-dom'
import ts from 'typescript'
import tseslint from 'typescript-eslint'

function readRawSource(path: string) {
  return readFileSync(path, 'utf8')
}

function stripTypeScriptComments(source: string) {
  const parsed = tseslint.parser.parseForESLint(source, {
    comment: true,
    loc: false,
    range: true,
  })
  const commentRanges = (parsed.ast.comments ?? [])
    .map(comment => comment.range)
    .sort((left, right) => left[0] - right[0])
  let result = ''
  let previousEnd = 0

  for (const [start, end] of commentRanges) {
    result += source.slice(previousEnd, start)
    result += source.slice(start, end).replace(/[^\r\n]/gu, ' ')
    previousEnd = end
  }

  return result + source.slice(previousEnd)
}

function readSource(path: string) {
  return stripTypeScriptComments(readRawSource(path))
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

const commentFixture = [
  'const url = \'https://resume.local/path//kept/*kept*/\'',
  '// removed-line-comment',
  'const value = 1 /* removed-block-comment */ + 2',
].join('\n')
const strippedCommentFixture = stripTypeScriptComments(commentFixture)
assert.equal(
  strippedCommentFixture.length,
  commentFixture.length,
  '注释剥离：必须保留源码长度以维持 section 边界',
)
assertContains(
  '注释剥离字符串安全',
  strippedCommentFixture,
  'https://resume.local/path//kept/*kept*/',
)
assertNotContains('注释剥离行注释', strippedCommentFixture, 'removed-line-comment')
assertNotContains('注释剥离块注释', strippedCommentFixture, 'removed-block-comment')

assert.ok(matchPath('/resume/editor', '/resume/editor'), '编辑器路由：标准路径必须匹配')
assert.ok(matchPath('/resume/editor', '/resume/editor/'), '编辑器路由：尾斜杠路径必须匹配')
assert.equal(
  matchPath('/resume/editor', '/resume/editor/extra'),
  null,
  '编辑器路由：相邻子路径不得误匹配',
)

const jiti = createJiti(import.meta.url)
const { sanitizeAppRedirect } = await jiti.import<
  typeof import('../src/lib/auth/redirect.ts')
>('../src/lib/auth/redirect.ts')
const { decodeDocumentData, encodeBytesToBase64 } = await jiti.import<
  typeof import('../src/lib/automerge/shared/utils.ts')
>('../src/lib/automerge/shared/utils.ts')
const { getParticipantColor } = await jiti.import<
  typeof import('../src/lib/collaboration/shared/color.ts')
>('../src/lib/collaboration/shared/color.ts')

const warningHueUserId = 'warning-user-1486'
const warningHueColor = getParticipantColor(warningHueUserId)
assert.match(warningHueColor, /^#[0-9a-f]{6}$/u, '协作颜色：必须满足 y-tiptap 的 6 位 HEX 契约')
assert.equal(
  getParticipantColor(warningHueUserId),
  warningHueColor,
  '协作颜色：同一登录用户必须跨连接保持稳定',
)
assert.equal(warningHueColor, '#f0e142', '协作颜色：hue 55 必须保持原 HSL 的等价视觉颜色')

// 覆盖 HSL 六个色相区段的两侧边界；避免“固定返回一个合法 HEX”或只实现单一区段也误绿。
const participantColorBoundaryCases = [
  ['boundary-user-286', '#f04242'], // hue 0
  ['boundary-user-52', '#f0ed42'], // hue 59
  ['boundary-user-347', '#f0f042'], // hue 60
  ['boundary-user-261', '#45f042'], // hue 119
  ['boundary-user-361', '#42f042'], // hue 120
  ['boundary-user-287', '#42f0ed'], // hue 179
  ['boundary-user-0', '#42f0f0'], // hue 180
  ['boundary-user-346', '#4245f0'], // hue 239
  ['boundary-user-53', '#4242f0'], // hue 240
  ['boundary-user-360', '#ed42f0'], // hue 299
  ['boundary-user-260', '#f042f0'], // hue 300
  ['boundary-user-1', '#f04245'], // hue 359
] as const
const participantBoundaryColors = participantColorBoundaryCases.map(([userId, expectedColor]) => {
  const color = getParticipantColor(userId)
  assert.match(color, /^#[0-9a-f]{6}$/u, `协作颜色：${userId} 不是 6 位 HEX`)
  assert.equal(color, expectedColor, `协作颜色：${userId} 的 HSL 等价色错误`)
  return color
})
assert.equal(
  new Set(participantBoundaryColors).size,
  participantColorBoundaryCases.length,
  '协作颜色：不同色相边界不得退化成恒定颜色',
)

// 同一份 Automerge 二进制快照无论来自原始字节、Base64 还是 PostgreSQL
// bytea 文本，都必须按邀请 URL 的 documentId 导入，而不是创建随机空文档。
const repos: Repo[] = []
try {
  const sourceRepo = new Repo()
  repos.push(sourceRepo)
  const sourceHandle = sourceRepo.create<{ value: string }>()
  sourceHandle.change((doc) => {
    doc.value = '协作快照'
  })
  const sourceDocument = sourceHandle.doc()
  assert.ok(sourceDocument, '动态快照：源 Automerge 文档未就绪')
  const binary = Automerge.save(sourceDocument)
  const { documentId } = parseAutomergeUrl(sourceHandle.url)

  const assertImportedSnapshot = async (label: string, bytes: Uint8Array) => {
    const targetRepo = new Repo()
    repos.push(targetRepo)
    const imported = targetRepo.import<{ value: string }>(bytes, { docId: documentId })
    await imported.whenReady()
    assert.equal(imported.documentId, documentId, `${label}：导入后 documentId 发生变化`)
    assert.equal(imported.doc()?.value, '协作快照', `${label}：导入后快照内容丢失`)
  }

  const base64 = encodeBytesToBase64(binary)
  const bytea = `\\x${Buffer.from(binary).toString('hex')}`
  // 生产 saveHandle() 先生成 Base64 字符串，再写入 PostgreSQL BYTEA。
  // PostgREST 读回时因此是“Base64 ASCII 字节的 \\x hex”，不能把这层
  // BYTEA 解包结果直接交给 Automerge。
  const byteaWrappedBase64 = `\\x${Buffer.from(base64, 'ascii').toString('hex')}`
  const wrappedBase64Bytes = new Uint8Array(Buffer.from(base64, 'ascii'))
  const decodedBase64 = decodeDocumentData(base64)
  const decodedBytea = decodeDocumentData(bytea)
  const decodedByteaWrappedBase64 = decodeDocumentData(byteaWrappedBase64)
  const decodedWrappedBase64Bytes = decodeDocumentData(wrappedBase64Bytes)
  const nonAutomergeBase64 = encodeBytesToBase64(new Uint8Array([1, 2, 3]))
  const nonAutomergeWrappedBytes = new Uint8Array(Buffer.from(nonAutomergeBase64, 'ascii'))
  const decodedNonAutomergeWrappedBytes = decodeDocumentData(nonAutomergeWrappedBytes)
  const malformedWrappedBytes = new Uint8Array(Buffer.from('not-base64!', 'ascii'))
  const decodedMalformedWrappedBytes = decodeDocumentData(malformedWrappedBytes)
  assert.ok(decodedBase64, '动态快照：Base64 未解码为字节')
  assert.ok(decodedBytea, '动态快照：bytea 未解码为字节')
  assert.ok(decodedByteaWrappedBase64, '动态快照：BYTEA 包裹的 Base64 未解码为字节')
  assert.ok(decodedWrappedBase64Bytes, '动态快照：Base64 ASCII 字节未解码为字节')
  assert.ok(decodedNonAutomergeWrappedBytes, '动态快照：非 Automerge Base64 ASCII 结果为空')
  assert.ok(decodedMalformedWrappedBytes, '动态快照：畸形 Base64 ASCII 结果为空')
  assert.deepEqual(decodedBase64, binary, '动态快照：Base64 解码结果与原始二进制不一致')
  assert.deepEqual(decodedBytea, binary, '动态快照：bytea 解码结果与原始二进制不一致')
  assert.deepEqual(
    decodedByteaWrappedBase64,
    binary,
    '动态快照：生产 BYTEA 包裹 Base64 解码结果与原始二进制不一致',
  )
  assert.deepEqual(
    decodedWrappedBase64Bytes,
    binary,
    '动态快照：Base64 ASCII 字节解码结果与原始二进制不一致',
  )
  assert.deepEqual(
    decodedNonAutomergeWrappedBytes,
    nonAutomergeWrappedBytes,
    '动态快照：非 Automerge Base64 ASCII 不应被误判为有效快照',
  )
  assert.deepEqual(
    decodedMalformedWrappedBytes,
    malformedWrappedBytes,
    '动态快照：畸形 Base64 ASCII 不应被误判为有效快照',
  )
  assert.throws(
    () => Automerge.load(decodedNonAutomergeWrappedBytes),
    '动态快照：非 Automerge Base64 ASCII 必须在导入时 fail-closed',
  )
  assert.throws(
    () => Automerge.load(decodedMalformedWrappedBytes),
    '动态快照：畸形 Base64 ASCII 必须在导入时 fail-closed',
  )
  await assertImportedSnapshot('动态快照/原始二进制', binary)
  await assertImportedSnapshot('动态快照/Base64', decodedBase64)
  await assertImportedSnapshot('动态快照/bytea', decodedBytea)
  await assertImportedSnapshot('动态快照/BYTEA 包裹 Base64', decodedByteaWrappedBase64)
  await assertImportedSnapshot('动态快照/Base64 ASCII 字节', decodedWrappedBase64Bytes)
  assert.equal(repos.length, 6, '动态快照：必须追踪 source 与五个 target Repo')
}
finally {
  await Promise.all(repos.map(repo => repo.shutdown()))
}

type RedirectSanitizer = typeof sanitizeAppRedirect

function verifyRedirectSanitizer(sanitize: RedirectSanitizer) {
  const legalRedirect = '/resume/editor?resumeId=resume-1&next=%2Fresume%2Feditor#collaboration'
  assert.equal(
    sanitize(legalRedirect),
    legalRedirect,
    'redirect：合法 query/hash 未被原样保留',
  )
  assert.equal(
    sanitize('/resume/editor?target=//evil.example#/%252f%252fevil.example'),
    '/resume/editor?target=//evil.example#/%252f%252fevil.example',
    'redirect：query/hash 不应被误判为跨站路径',
  )

  for (const unsafeRedirect of [
    'https://evil.example/resume',
    '//evil.example/resume',
    '/\\evil.example/resume',
    '/resume\u0000/editor',
    '/resume\u001F/editor',
    '/resume\u007F/editor',
    '/%0Aevil.example/resume',
    '/%0devil.example/resume',
    '/%250d%250aLocation:evil.example/resume',
    '/%2f%2fevil.example/resume',
    '/%5cevil.example/resume',
    '/%252f%252fevil.example/resume',
    '/%255cevil.example/resume',
    '/%25252f%25252fevil.example/resume',
  ]) {
    assert.equal(
      sanitize(unsafeRedirect),
      '/resume',
      `redirect：危险返回地址未被拒绝 ${JSON.stringify(unsafeRedirect)}`,
    )
  }
}

verifyRedirectSanitizer(sanitizeAppRedirect)

const redirectRawSource = readRawSource('src/lib/auth/redirect.ts')
const hasControlCharacterSource = readSourceSection(
  redirectRawSource,
  'function hasControlCharacter(',
  '\n\nfunction getRawPathname(',
  'redirect control-character mutation',
)
const hasControlCharacterMutant = redirectRawSource.replace(
  hasControlCharacterSource,
  'function hasControlCharacter(_value: string) {\n  return false\n}',
)
assert.notEqual(
  hasControlCharacterMutant,
  redirectRawSource,
  'mutation 未命中：hasControlCharacter 恒 false',
)
const transpiledRedirectMutant = ts.transpileModule(hasControlCharacterMutant, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const redirectMutantModule = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledRedirectMutant).toString('base64')}`,
) as { sanitizeAppRedirect: RedirectSanitizer }
assert.throws(
  () => verifyRedirectSanitizer(redirectMutantModule.sanitizeAppRedirect),
  { name: 'AssertionError' },
  'verifier 未拒绝 mutation：hasControlCharacter 恒 false',
)

const edgeRawSource = readRawSource('supabase/functions/resume-comments/index.ts')
const edgeSource = stripTypeScriptComments(edgeRawSource)
const documentManagerSource = readSource('src/lib/automerge/document/manager.ts')
const documentPersistenceSource = readSource('src/lib/automerge/document/persistence.ts')
const adapterSource = readSource('src/lib/automerge/collaboration/supabase-network-adapter.ts')
const sessionStoreSource = readSource('src/lib/collaboration/session/store.ts')
const sessionCallbacksSource = readSource('src/lib/collaboration/session/callbacks.ts')
const leaseSource = readSource('src/lib/collaboration/session/lease.ts')
const loaderRawSource = readRawSource('src/pages/resume/editor/hooks/use-resume-loader.ts')
const loaderSource = stripTypeScriptComments(loaderRawSource)
const collaborationPanelRawSource = readRawSource(
  'src/pages/resume/editor/hooks/use-collaboration-panel-value.ts',
)
const collaborationPanelSource = stripTypeScriptComments(collaborationPanelRawSource)
const documentSliceSource = readSource('src/store/resume/slices/document.ts')
const syncSliceSource = readSource('src/store/resume/slices/sync.ts')

function verifyEdgeBootstrap(candidateSource: string) {
  const source = stripTypeScriptComments(candidateSource)
  const bootstrapSource = readSourceSection(
    source,
    'async function loadCollaborationDocumentBootstrap(',
    '\nasync function issueCollaboratorToken',
    'Edge 协作快照查询',
  )
  assertSourceOrder('Edge 协作快照查询', bootstrapSource, [
    '.from(\'automerge_documents\')',
    '.select(\'document_data,heads,document_version,updated_at\')',
    '.eq(\'resume_id\', session.resume_id)',
    '.eq(\'user_id\', session.owner_user_id)',
    '.maybeSingle()',
  ])
  assertSourceOrder('Edge 协作快照 fail-closed', bootstrapSource, [
    'if (error)',
    'typeof row.document_data !== \'string\'',
    '\'collaboration_snapshot_unavailable\'',
    'documentData: row.document_data',
  ])
  assertNotContains('Edge 协作快照查询', bootstrapSource, '.select(\'*\')')
  return bootstrapSource
}

verifyEdgeBootstrap(edgeRawSource)
const edgeOwnerFilter = '.eq(\'user_id\', session.owner_user_id)'
const edgeOwnerFilterMutant = edgeRawSource.replace(
  edgeOwnerFilter,
  `.eq('user_id', 'review-mutant')\n    // ${edgeOwnerFilter}`,
)
assertMutationRejected(
  'Edge owner 过滤仅在注释中保留',
  edgeRawSource,
  edgeOwnerFilterMutant,
  verifyEdgeBootstrap,
)

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

function verifyOwnerDocumentNoOp(candidateSource: string) {
  const source = stripTypeScriptComments(candidateSource)
  const effectSource = readSourceSection(
    source,
    '  useEffect(() => {\n    let cancelled = false\n    const generation = ++loadGenerationRef.current',
    '\n  useEffect(() => {\n    if (!activeResumeId || isOfflineResumeId(activeResumeId) || !currentUser)',
    '简历加载编排 effect',
  )
  assertNotContains('简历加载编排 effect', effectSource, 'getCurrentUser')
  assertSourceOrder('退出中 Editor 路由生命周期门禁', effectSource, [
    'if (!matchPath(\'/resume/editor\', location.pathname))',
    'cancelled = true',
    'const route = parseCollaborationRoute(new URLSearchParams(location.search))',
  ])
  assertSourceOrder('退出中 Editor location 依赖', effectSource, [
    'runLoad().catch(',
    'location.pathname,',
    'location.search,',
    'navigate,',
  ])
  assertNotContains('退出中 Editor location 依赖', effectSource, 'location.hash,')
  const noOpSource = readSourceSection(
    effectSource,
    '    const expectedDocumentSource = route.kind === \'invite\' ? \'collaboration\' : \'owner\'',
    '    const isCollaborationRoute =',
    '已加载 owner 文档 no-op 门禁',
  )
  assertSourceOrder('已加载 owner 文档 no-op 门禁', noOpSource, [
    'loadedIdentity.source === expectedDocumentSource',
    'loadedIdentity.loadKey === loadKey',
    'resumeState.docManager.canPersist() === (expectedDocumentSource === \'owner\')',
    'const isCurrentHostUrlTransition',
    'route.kind === \'host-recovery\'',
    'collaborationState.role === \'host\'',
    'collaborationState.sessionId === route.sessionId',
    'collaborationState.resumeId === route.resumeId',
    'authState.authStatus === \'authenticated\'',
    'authenticatedUserId === collaborationState.self?.userId',
    'collaborationState.isSharing',
    'if (hasReusableDocument && (route.kind === \'none\' || isCurrentHostUrlTransition))',
    'setLoading(false)',
    'return () =>',
  ])
  const noOpGateIndex = effectSource.indexOf(
    'if (hasReusableDocument && (route.kind === \'none\' || isCurrentHostUrlTransition))',
  )
  assert.notEqual(noOpGateIndex, -1, '已加载 owner 文档 no-op 门禁：缺少 no-op 条件')
  for (const destructiveMarker of [
    'useResumeConfigStore.getState().discardSpacingPreview()',
    'setLoading(true)',
    'const loadOwnerResume = async',
    'await loadResumeData(',
    'await useCollaborationStore.getState().resumeHosting(params)',
    'const runLoad = async',
  ]) {
    const destructiveIndex = effectSource.indexOf(destructiveMarker)
    assert.notEqual(destructiveIndex, -1, `已加载 owner 文档 no-op 门禁：缺少后续标记 ${destructiveMarker}`)
    assert.ok(
      noOpGateIndex < destructiveIndex,
      `已加载 owner 文档 no-op 门禁：${destructiveMarker} 不得早于 no-op`,
    )
  }
  return effectSource
}

const loaderEffectSource = verifyOwnerDocumentNoOp(loaderRawSource)
const hostUrlTransitionSource = readSourceSection(
  loaderRawSource,
  '    const isCurrentHostUrlTransition =',
  '\n    if (hasReusableDocument',
  'host URL transition mutation',
)
const hostUrlTransitionMutant = loaderRawSource.replace(
  hostUrlTransitionSource,
  '    const isCurrentHostUrlTransition = true\n',
)
assertMutationRejected(
  'host URL transition 恒 true',
  loaderRawSource,
  hostUrlTransitionMutant,
  verifyOwnerDocumentNoOp,
)

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
function verifyPanelStop(candidateSource: string) {
  const source = stripTypeScriptComments(candidateSource)
  const stopSource = readSourceSection(
    source,
    '  const handleStopSharing = useCallback(async () => {',
    '\n  const handleCopyShareLink = useCallback(',
    '协作面板停止共享',
  )
  assertSourceOrder('协作面板停止共享', stopSource, [
    'await stopSharing()',
    'if (collaborationRole === \'guest\')',
    'navigate(\'/resume\', { replace: true })',
    'params.delete(\'collabSession\')',
    'params.delete(\'docUrl\')',
    'params.set(\'resumeId\', activeResumeId)',
    'setSearchParams(params, { replace: true })',
    '}, [activeResumeId, collaborationRole, navigate, setSearchParams, stopSharing])',
  ])
}

verifyPanelStop(collaborationPanelRawSource)
const panelStopDependencies = '}, [activeResumeId, collaborationRole, navigate, setSearchParams, stopSharing])'
const panelStopDependencyMutant = collaborationPanelRawSource.replace(
  panelStopDependencies,
  '}, [activeResumeId, navigate, setSearchParams, stopSharing])',
)
assertMutationRejected(
  'handleStopSharing 删除 collaborationRole 依赖',
  collaborationPanelRawSource,
  panelStopDependencyMutant,
  verifyPanelStop,
)

const stopSharingActionSource = readSourceSection(
  sessionStoreSource,
  '    stopSharing: async ({ silent, bestEffort } = {}) => {',
  '\n    refreshCommentAccess: async () => {',
  'stopSharing action',
)
const hostStopSource = readSourceSection(
  stopSharingActionSource,
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
