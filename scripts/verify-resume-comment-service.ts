import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import {
  hashAnonymousSecret,
  signCommentToken,
  verifyCommentToken,
} from '../supabase/functions/shared/resume-comment-auth.ts'
import {
  buildCommentAnchorDocument,
} from '../supabase/functions/shared/resume-comment-core.ts'
import {
  broadcastCommentInvalidation,
  deriveOwnerRealtimeTopic,
  deriveScopeRealtimeTopic,
} from '../supabase/functions/shared/resume-comment-events.ts'
import {
  CommentApiError,
  isSafeCommentLink,
  normalizeCommentBody,
  readCommentAnchor,
  readCommentOp,
} from '../supabase/functions/shared/resume-comment-schema.ts'

assert.match(
  buildCommentAnchorDocument({ basics: { name: '张三' }, order: ['basics'] }, '2026-08-14').documentHash,
  /^[0-9a-f]{64}$/u,
)

function readSourceSection(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`)
  assert.ok(end > start, `Missing source marker: ${endMarker}`)
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

const edgeSource = readFileSync('supabase/functions/resume-comments/index.ts', 'utf8')
const commentClientSource = readFileSync('src/features/resume-comments/api/client.ts', 'utf8')
const editorSource = readFileSync('src/pages/resume/editor/index.tsx', 'utf8')
const resumeLoaderSource = readFileSync('src/pages/resume/editor/hooks/use-resume-loader.ts', 'utf8')
const persistenceSource = readFileSync('src/lib/automerge/document/persistence.ts', 'utf8')
const corsSource = readFileSync('supabase/functions/shared/cors.ts', 'utf8')
const requestContextSource = readFileSync('supabase/functions/shared/request-context.ts', 'utf8')
const benchmarkSource = readFileSync('scripts/benchmark-resume-comments-bootstrap.ts', 'utf8')
const prewarmSource = readFileSync('scripts/prewarm-resume-comment-scopes.ts', 'utf8')
const shareEdgeSource = readFileSync('supabase/functions/resume-share/index.ts', 'utf8')
const migrationSource = readFileSync(
  'supabase/migrations/20260814000001_add_version_centric_resume_comments.sql',
  'utf8',
)
const forwardCompatibilityMigrationSource = readFileSync(
  'supabase/migrations/20260814000002_ensure_comment_collaboration_and_active_version.sql',
  'utf8',
)
const crossBlockAnchorMigrationSource = readFileSync(
  'supabase/migrations/20260814050307_allow_cross_block_resume_comment_anchors.sql',
  'utf8',
)
const originalCommentMigrationSource = readFileSync(
  'supabase/migrations/20260813000002_add_resume_comments.sql',
  'utf8',
)
const transactionSource = readFileSync(
  'supabase/migrations/20260813000003_add_resume_comment_api_transactions.sql',
  'utf8',
)
const bootstrapMigrationSource = readFileSync(
  'supabase/migrations/20260814060000_optimize_resume_comment_bootstrap.sql',
  'utf8',
)
const threadReadMigrationSource = readFileSync(
  'supabase/migrations/20260815170650_add_resume_comment_thread_read_states.sql',
  'utf8',
)
const hardeningMigrationSource = readFileSync(
  'supabase/migrations/20260816080301_fix_comment_lock_order_and_function_paths.sql',
  'utf8',
)
const normalizedBootstrapMigrationSource = bootstrapMigrationSource.replace(/\s+/gu, ' ')
const eventProjectionSource = readSourceSection(
  edgeSource,
  'function projectCommentEventsForAccess',
  '\ninterface BootstrapRpcInput',
)
const genericWriteResponseSource = readSourceSection(
  edgeSource,
  '    let data: Record<string, unknown>',
  '\n    const eventSeq = Number(data.eventSeq)',
)
const genericWriteCompletionSource = readSourceSection(
  edgeSource,
  '    let data: Record<string, unknown>',
  '\n  }\n  catch (error)',
)
const finalMutationResponseSource = genericWriteCompletionSource.slice(
  genericWriteCompletionSource.indexOf('    const eventSeq = Number(data.eventSeq)'),
)
const documentSyncSource = readSourceSection(
  edgeSource,
  '    if (op === \'sync_working_document\')',
  '\n    requireActor(access)',
)
assert.match(edgeSource, /ensure_resume_version_comment_scope/u)
assert.doesNotMatch(edgeSource, /ensure_resume_working_comment_scope/u)
assert.match(edgeSource, /execute_resume_version_comment_write/u)
assert.match(edgeSource, /parentCommentId/u)
assert.match(edgeSource, /op === 'list_events'/u)
assert.match(edgeSource, /op === 'mark_thread_read'/u)
assert.match(edgeSource, /mark_resume_comment_thread_read_v1/u)
assert.match(edgeSource, /threadReadStates/u)
assert.match(edgeSource, /create_thread: 'thread_created'/u)
assert.match(edgeSource, /create_reply: 'comment_replied'/u)
assert.match(edgeSource, /function projectCommentEventsForAccess/u)
assert.match(edgeSource, /value\.actor_kind === access\.actorKind/u)
assert.match(edgeSource, /value\.actor_id === access\.actorId/u)
assert.doesNotMatch(eventProjectionSource, /actor_kind:|actor_id:/u)
assert.match(edgeSource, /events: projectCommentEventsForAccess\(eventResult\.data \?\? \[\], access\)/u)
assert.match(edgeSource, /events: projectCommentEventsForAccess\(events, access\)/u)
assert.match(edgeSource, /type: resolveCommentEventType\(op\),[\s\S]*?is_own: true/u)
assert.match(genericWriteResponseSource, /if \(replay\)[\s\S]*?data = replay[\s\S]*?else \{[\s\S]*?execute_resume_version_comment_write/u)
assert.match(genericWriteResponseSource, /scheduleBackground\(notifyWrite/u)
assert.match(documentSyncSource, /if \(replay\)[\s\S]*?loadThreads\(admin, access\.scope\.id\)[\s\S]*?loadThreadCounts\(admin, access\.scope\.id\)/u)
assert.match(documentSyncSource, /\.\.\.replay,[\s\S]*?threads,[\s\S]*?profiles,[\s\S]*?counts,[\s\S]*?type: 'document_synced'/u)
assert.doesNotMatch(documentSyncSource, /return finalize\(success\(replay,/u)
assertSourceOrder(finalMutationResponseSource, [
  '    const eventSeq = Number(data.eventSeq)',
  '    const threadId = typeof data.threadId',
  'event: {',
  'type: resolveCommentEventType(op),',
])
assert.match(edgeSource, /scheduleBackground\(notifyWrite/u)
assert.match(edgeSource, /Server-Timing/u)
assert.match(edgeSource, /X-Request-Id/u)
assert.match(edgeSource, /authenticateSupabaseUser/u)
assert.doesNotMatch(edgeSource, /\.auth\.getUser\(/u)
assert.match(corsSource, /Access-Control-Max-Age/u)
assert.match(corsSource, /X-Sb-Edge-Region/u)
assert.match(edgeSource, /return existing as ScopeRow/u)
assert.match(corsSource, /x-request-id/u)
assert.match(corsSource, /X-Comment-Auth-Mode/u)
assert.match(corsSource, /X-Comment-Scope-Repair/u)
const optionsGateSource = readSourceSection(
  benchmarkSource,
  'const options = await runOptions(config, region)',
  'const samples: Sample[] = []',
)
assert.match(optionsGateSource, /options\.status < 200 \|\| options\.status >= 300/u)
assert.match(
  optionsGateSource,
  /throw new Error\('benchmark OPTIONS request was not successful'\)/u,
)
assert.match(
  prewarmSource,
  /console\.log\(JSON\.stringify\(summary\)\)[\s\S]*?if \(summary\.failed > 0\) \{\s*process\.exitCode = 1/u,
)
assert.match(edgeSource, /stale_document/u)
assert.match(edgeSource, /expectedDocumentRevision/u)
assert.match(edgeSource, /nodeMap\.get\(anchor\.nodeKey\),\s+documentHash/u)
assert.match(edgeSource, /loadThreads\(admin, access\.scope\.id, \[threadId\]\)/u)
assert.doesNotMatch(edgeSource, /await notifyWrite/u)
assert.match(edgeSource, /RETIRED_COLLABORATION_OPS\.has\(op\) \|\| body\.accessKind === 'collaborator'/u)
assert.doesNotMatch(edgeSource, /handleCollaborationSessionOperation|validateCollaboratorTokenClaims|RESUME_COMMENT_COLLABORATOR_SECRET/u)
assert.doesNotMatch(commentClientSource, /kind: 'collaborator'|accessKind: 'collaborator'/u)
assert.doesNotMatch(editorSource, /CollaborationRuntime|CollaborationDialog|useCollaborationStore|collabSession/u)
assert.doesNotMatch(resumeLoaderSource, /docUrl|documentUrl|useCollaborationStore/u)
assert.doesNotMatch(persistenceSource, /sharedDocumentUrl|loadHandleByUrl/u)
assert.match(hardeningMigrationSource, /p_access_kind = 'collaborator'[\s\S]*?ERRCODE = '42501', MESSAGE = 'unauthorized'/u)
assert.match(hardeningMigrationSource, /UPDATE public\.resume_comment_collaboration_members[\s\S]*?WHERE revoked_at IS NULL/u)
assert.match(hardeningMigrationSource, /UPDATE public\.resume_comment_collaboration_sessions[\s\S]*?WHERE revoked_at IS NULL/u)

const bootstrapInputSource = edgeSource.slice(
  edgeSource.indexOf('async function buildBootstrapInput'),
  edgeSource.indexOf('function bootstrapProtocolError'),
)
const bootstrapValidatorSource = edgeSource.slice(
  edgeSource.indexOf('function validateBootstrapAccess'),
  edgeSource.indexOf('function mapBootstrapRpcError'),
)
const bootstrapRpcHelperSource = edgeSource.slice(
  edgeSource.indexOf('function mapBootstrapRpcError'),
  edgeSource.indexOf('async function assertCurrentSharePasswordGeneration'),
)
const bootstrapRepairSource = edgeSource.slice(
  edgeSource.indexOf('async function repairBootstrapScope'),
  edgeSource.indexOf('async function ensureVersionScopeForOwner'),
)
const bootstrapRepairErrorSource = readSourceSection(
  edgeSource,
  'function mapBootstrapRepairError',
  'async function bootstrapResumeComments',
)
const ownerScopeEnsureSource = readSourceSection(
  edgeSource,
  'async function ensureVersionScopeForOwner',
  'async function resolveCurrentVersionId',
)
const shareScopeEnsureSource = readSourceSection(
  shareEdgeSource,
  'async function ensureShareCommentScope',
  'async function notifyShareCommentSettings',
)
const privateEnsureSource = readSourceSection(
  bootstrapMigrationSource,
  'CREATE OR REPLACE FUNCTION private.ensure_resume_version_comment_scope_v1',
  '-- 保留五参数签名',
)
const publicFiveArgumentEnsureSource = readSourceSection(
  bootstrapMigrationSource,
  '-- 保留五参数签名',
  '-- 新调用方必须携带',
)
const publicSixArgumentEnsureSource = readSourceSection(
  bootstrapMigrationSource,
  '-- 新调用方必须携带',
  'REVOKE ALL ON FUNCTION public.assert_resume_comment_service_role()',
)
const normalizedPrivateEnsureSource = privateEnsureSource.replace(/\s+/gu, ' ')
const normalizedPublicFiveArgumentEnsureSource = publicFiveArgumentEnsureSource.replace(/\s+/gu, ' ')
const normalizedPublicSixArgumentEnsureSource = publicSixArgumentEnsureSource.replace(/\s+/gu, ' ')
const handlerSource = edgeSource.slice(edgeSource.indexOf('Deno.serve'))
const bootstrapBranchStart = handlerSource.indexOf('if (op === \'bootstrap_scope\')')
const legacyAccessStart = handlerSource.indexOf('const access = await resolveAccess')
assert.ok(bootstrapBranchStart >= 0)
assert.ok(legacyAccessStart > bootstrapBranchStart)
const bootstrapBranchSource = handlerSource.slice(bootstrapBranchStart, legacyAccessStart)

assert.equal(
  edgeSource.match(/admin\.rpc\('bootstrap_resume_comments_v1'/gu)?.length,
  1,
)
assert.doesNotMatch(
  bootstrapBranchSource,
  /resolveAccess|loadThreads|loadReadState|loadVersionReference|Promise\.all/u,
)
assert.match(
  bootstrapInputSource,
  /body\.historyVersionId !== undefined \|\| body\.shareReleaseId !== undefined/u,
)
assert.match(
  bootstrapInputSource,
  /\['scopeId', 'resumeId', 'versionId'\][\s\S]*?locatorKeys\.length !== 1/u,
)
assert.match(bootstrapInputSource, /validateShareTokenClaims\(verifiedToken\)/u)
assert.doesNotMatch(
  bootstrapInputSource,
  /accessKind === 'collaborator'|validateCollaboratorTokenClaims|verifyCommentToken\([^)]*'collaborator'/u,
)
assert.match(
  edgeSource,
  /value\.kind !== 'share'[\s\S]*?!isUuidValue\(value\.shareId\)[\s\S]*?!isUuidValue\(value\.releaseId\)[\s\S]*?!isUuidValue\(value\.scopeId\)[\s\S]*?!isPositiveSafeInteger\(value\.versionId\)[\s\S]*?value\.passwordGeneration\.trim\(\)\.length === 0/u,
)
assert.match(
  bootstrapInputSource,
  /if \(isRecord\(body\.anonymous\)\)[\s\S]*?hashAnonymousSecret\(anonymousSecret, anonymousPepper\)[\s\S]*?if \(!userId\)[\s\S]*?invalidBootstrapCredential\('匿名评论凭证无效'\)/u,
)
assert.doesNotMatch(bootstrapInputSource, /\badmin\b|\.from\(|\.rpc\(/u)
const bootstrapRpcInputSource = edgeSource.slice(
  edgeSource.indexOf('interface BootstrapRpcInput'),
  edgeSource.indexOf('interface BootstrapInputContext'),
)
assert.doesNotMatch(
  bootstrapRpcInputSource,
  /p_access_token|p_jwt|p_anonymous_secret(?:\s|:)/u,
)

assert.match(
  bootstrapValidatorSource,
  /value\.protocolVersion !== 1[\s\S]*?value\.status !== 'ok' && value\.status !== 'scope_missing'/u,
)
assert.doesNotMatch(bootstrapValidatorSource, /input\.p_access_kind === 'collaborator'/u)
assert.match(
  edgeSource,
  /function isPositiveSafeInteger\(value: unknown\): value is number \{\s*return Number\.isSafeInteger\(value\) && Number\(value\) > 0\s*\}/u,
)
assert.equal(Number.isSafeInteger(0) && Number(0) > 0, false)
assert.equal(Number.isSafeInteger(1) && Number(1) > 0, true)
assert.equal(Number.isSafeInteger(1e100), false)
assert.match(
  bootstrapInputSource,
  /const requestedVersionId = readNonNegativeInteger\(body, 'versionId'\)\s+if \(!isPositiveSafeInteger\(requestedVersionId\)\)\s+throw new CommentApiError\('not_found', '简历版本不存在', 404\)\s+versionId = requestedVersionId/u,
)
const scopeMissingValidatorStart = bootstrapValidatorSource.indexOf(
  'if (value.status === \'scope_missing\')',
)
const scopeMissingValidatorEnd = bootstrapValidatorSource.indexOf(
  'if (!isNonNegativeSafeInteger(value.eventSeq))',
  scopeMissingValidatorStart,
)
assert.ok(scopeMissingValidatorStart >= 0)
assert.ok(scopeMissingValidatorEnd > scopeMissingValidatorStart)
const scopeMissingValidatorSource = bootstrapValidatorSource.slice(
  scopeMissingValidatorStart,
  scopeMissingValidatorEnd,
)
assert.match(
  scopeMissingValidatorSource,
  /!isPositiveSafeInteger\(value\.repair\.versionId\)[\s\S]*?!isPositiveSafeInteger\(value\.repair\.documentRevision\)/u,
)
assert.doesNotMatch(
  scopeMissingValidatorSource,
  /isNonNegativeSafeInteger\(value\.repair\.documentRevision\)/u,
)
assert.match(
  bootstrapValidatorSource,
  /scopeValue\.id !== access\.scopeId[\s\S]*?scopeValue\.owner_user_id !== access\.ownerUserId[\s\S]*?scopeValue\.version_id !== access\.versionId[\s\S]*?scopeValue\.next_event_seq !== eventSeq/u,
)
assert.match(
  bootstrapValidatorSource,
  /!Array\.isArray\(value\.threads\)[\s\S]*?!Array\.isArray\(value\.profiles\)[\s\S]*?!Array\.isArray\(value\.accessibleScopes\)/u,
)
assert.match(
  bootstrapValidatorSource,
  /typeof node\.nodeKey === 'string'/u,
)
assert.match(
  bootstrapValidatorSource,
  /value\.accessibleScopes\.length !== 1[\s\S]*?accessibleScope\.id !== access\.scopeId[\s\S]*?accessibleScope\.last_read_event_seq !== value\.lastReadEventSeq/u,
)
assert.doesNotMatch(bootstrapValidatorSource, /\sas\s/u)
assert.doesNotMatch(
  bootstrapValidatorSource,
  /\.\.\.value|\.\.\.scopeValue|\.\.\.versionValue|\.\.\.countsValue/u,
)
assert.match(
  bootstrapValidatorSource,
  /return \{\s*scope,\s*version: \{[\s\S]*?counts: \{[\s\S]*?threads: value\.threads,[\s\S]*?profiles: value\.profiles,[\s\S]*?accessibleScopes: \[\{/u,
)
assert.match(
  edgeSource,
  /interface BootstrapScope[\s\S]*?nodes: Array<\{ nodeKey: string \}>/u,
)

assert.match(
  bootstrapRpcHelperSource,
  /`\$\{error\.code\}:\$\{error\.message\}`/u,
)
for (const expectedMapping of [
  '42501:unauthorized',
  'P0002:not_found',
  'P0404:share_unavailable',
  'P0403:comments_disabled',
  'P0409:stale_release',
]) {
  assert.ok(bootstrapRpcHelperSource.includes(expectedMapping))
}
assert.doesNotMatch(bootstrapRpcHelperSource, /details|hint|error_description/u)

assert.match(
  bootstrapBranchSource,
  /result\.status === 'scope_missing'[\s\S]*?&& !repaired[\s\S]*?rpcInput\.p_access_kind === 'owner' \|\| rpcInput\.p_access_kind === 'share'/u,
)
assert.match(
  bootstrapBranchSource,
  /const canonicalScopeId = await timeOperation\('repair'[\s\S]*?repaired = true[\s\S]*?rpcInput = \{ \.\.\.rpcInput, p_scope_id: canonicalScopeId \}/u,
)
assert.match(bootstrapRepairSource, /buildCommentAnchorDocument\([\s\S]*?ensure_resume_version_comment_scope/u)
assert.equal(
  edgeSource.match(/admin\.rpc\(\s*'ensure_resume_version_comment_scope'/gu)?.length,
  2,
)
assert.equal(
  shareEdgeSource.match(/admin\.rpc\(\s*'ensure_resume_version_comment_scope'/gu)?.length,
  1,
)
assert.equal(
  prewarmSource.match(/admin\.rpc\(\s*'ensure_resume_version_comment_scope'/gu)?.length,
  1,
)
assert.match(
  bootstrapRepairSource,
  /ensure_resume_version_comment_scope'[\s\S]*?p_expected_document_revision: repair\.documentRevision/u,
)
assert.match(
  bootstrapRepairSource,
  /if \(error\)\s+throw mapBootstrapRepairError\(error\)/u,
)
assert.match(
  bootstrapRepairSource,
  /error instanceof BootstrapInternalError \|\| error instanceof CommentApiError/u,
)
assert.match(
  bootstrapRepairErrorSource,
  /error\.code === 'P0409'\s+&& error\.message === 'stale_document'[\s\S]*?new CommentApiError\(\s*'stale_document',[\s\S]*?409,/u,
)
assert.doesNotMatch(bootstrapRepairErrorSource, /details|hint|error_description/u)
assert.match(
  ownerScopeEnsureSource,
  /select\('id,resume_id,user_id,snapshot,projection_reference_date,document_revision'\)[\s\S]*?ensure_resume_version_comment_scope'[\s\S]*?p_expected_document_revision: version\.document_revision/u,
)
assert.match(
  shareScopeEnsureSource,
  /ensure_resume_version_comment_scope'[\s\S]*?p_expected_document_revision: version\.document_revision/u,
)
assert.match(
  prewarmSource,
  /interface ResumeVersionRow[\s\S]*?document_revision: number[\s\S]*?\.select\('id, user_id, snapshot, document_revision, projection_reference_date,[\s\S]*?ensure_resume_version_comment_scope'[\s\S]*?p_expected_document_revision: row\.document_revision/u,
)
assert.equal(
  bootstrapBranchSource.match(/assertCurrentSharePasswordGeneration\(/gu)?.length,
  2,
)
const firstPasswordCheck = bootstrapBranchSource.indexOf('assertCurrentSharePasswordGeneration')
const repairCall = bootstrapBranchSource.indexOf('timeOperation(\'repair\'')
const secondPasswordCheck = bootstrapBranchSource.indexOf(
  'assertCurrentSharePasswordGeneration',
  firstPasswordCheck + 1,
)
const realtimeCall = bootstrapBranchSource.indexOf('timeOperation(\'realtime_token\'')
assert.ok(firstPasswordCheck >= 0 && firstPasswordCheck < repairCall)
assert.ok(secondPasswordCheck > repairCall && secondPasswordCheck < realtimeCall)
assert.match(bootstrapBranchSource, /if \(result\.status !== 'ok'\)/u)
assert.match(
  edgeSource,
  /derivePasswordGeneration\([\s\S]*?result\.access\.sharePasswordHash[\s\S]*?timingSafeStringEqual\(currentGeneration, input\.p_password_generation\)/u,
)
assert.match(
  bootstrapBranchSource,
  /data: \{ \.\.\.result\.bootstrap, \.\.\.realtime \}/u,
)
const bootstrapSuccessResponseStart = bootstrapBranchSource.indexOf(
  'const bootstrapResponse = json({',
)
const bootstrapSuccessResponseEndMarker = 'return finalize(bootstrapResponse)'
const bootstrapSuccessResponseEnd = bootstrapBranchSource.indexOf(
  bootstrapSuccessResponseEndMarker,
  bootstrapSuccessResponseStart,
)
assert.ok(bootstrapSuccessResponseStart >= 0)
assert.ok(bootstrapSuccessResponseEnd > bootstrapSuccessResponseStart)
const bootstrapSuccessResponseSource = bootstrapBranchSource.slice(
  bootstrapSuccessResponseStart,
  bootstrapSuccessResponseEnd + bootstrapSuccessResponseEndMarker.length,
)
assert.match(
  bootstrapSuccessResponseSource,
  /ok: true,[\s\S]*?protocolVersion: 1,[\s\S]*?meta: \{ authMode, repair: repaired, coldStart \},[\s\S]*?data: \{ \.\.\.result\.bootstrap, \.\.\.realtime \},[\s\S]*?eventSeq: result\.eventSeq/u,
)
assert.match(
  bootstrapSuccessResponseSource,
  /bootstrapResponse\.headers\.set\('X-Comment-Auth-Mode', authMode\)/u,
)
assert.match(
  bootstrapSuccessResponseSource,
  /bootstrapResponse\.headers\.set\('X-Comment-Scope-Repair', String\(repaired\)\)/u,
)
assert.doesNotMatch(
  bootstrapSuccessResponseSource,
  /result\.access|result\.repair|sharePasswordHash/u,
)

assert.match(
  handlerSource,
  /operationDurations\[name\] = \(operationDurations\[name\] \?\? 0\) \+ duration/u,
)
assert.equal(bootstrapBranchSource.match(/timeOperation\('rpc'/gu)?.length, 2)
assert.equal(bootstrapBranchSource.match(/timeOperation\('repair'/gu)?.length, 1)
assert.match(
  handlerSource,
  /const serializeStartedAt = performance\.now\(\)[\s\S]*?const serializedBody = JSON\.stringify\(body\)[\s\S]*?recordTiming\('serialize', performance\.now\(\) - serializeStartedAt\)[\s\S]*?new Response\(serializedBody/u,
)
assert.doesNotMatch(edgeSource, /db;dur|access;dur|total;dur|broadcast;desc|Math\.max\(0, total/u)
for (const timingName of [
  'auth_anonymous',
  'auth_local',
  'auth_legacy',
  'access_token',
  'rpc',
  'repair',
  'realtime_token',
  'serialize',
  'edge_total',
]) {
  assert.ok(edgeSource.includes(timingName))
}
assert.match(handlerSource, /const coldStart = nextRequestIsColdStart[\s\S]*?nextRequestIsColdStart = false/u)
assert.match(handlerSource, /const requestId = context\.requestId/u)
assert.match(requestContextSource, /Deno\.env\.get\('SB_REGION'\)/u)
assert.doesNotMatch(handlerSource, /headers\.get\(['"]x-sb-edge-region/iu)
assert.match(handlerSource, /const sharedHeaders = context\.responseHeaders\(\)/u)
assert.match(
  bootstrapBranchSource,
  /meta: \{ authMode, repair: repaired, coldStart \}/u,
)
assert.match(
  handlerSource,
  /if \(req\.method === 'OPTIONS'\) \{\s*const response = corsPreflightResponse\(req, 'allowlist'\)/u,
)
assert.match(migrationSource, /kind = 'version'/u)
assert.match(migrationSource, /version_id = p_version_id/u)
assert.match(migrationSource, /invalid reply parent/u)
assert.match(migrationSource, /SET parent_id = v_parent_id/u)
assert.match(transactionSource, /SET body = '', deleted_at = now\(\)/u)
assert.match(threadReadMigrationSource, /CREATE TABLE private\.resume_comment_thread_read_states/u)
assert.match(threadReadMigrationSource, /resume_comment_thread_read_states_thread_fk_idx/u)
assert.match(threadReadMigrationSource, /resume_comment_thread_read_states_user_fk_idx/u)
assert.match(threadReadMigrationSource, /resume_comment_thread_read_states_anonymous_fk_idx/u)
assert.match(
  threadReadMigrationSource,
  /REVOKE ALL ON TABLE private\.resume_comment_thread_read_states\s+FROM PUBLIC, anon, authenticated, service_role/u,
)
assert.match(threadReadMigrationSource, /CREATE OR REPLACE FUNCTION public\.mark_resume_comment_thread_read_v1/u)
assert.match(threadReadMigrationSource, /latest\.latest_event_seq > GREATEST/u)
assert.match(threadReadMigrationSource, /IF NOT v_has_unread THEN/u)
assert.match(threadReadMigrationSource, /SET last_read_event_seq = v_previous_read_event_seq/u)
assert.match(threadReadMigrationSource, /build_resume_comment_bootstrap_without_thread_reads_v1/u)
assert.match(threadReadMigrationSource, /'\{bootstrap,threadReadStates\}'/u)
assert.equal(
  threadReadMigrationSource.match(/RENAME TO execute_resume_version_comment_write_without_thread_reads_v1/gu)?.length,
  1,
)
assert.equal(
  threadReadMigrationSource.match(/RENAME TO sync_resume_version_comment_document_without_read_cursor_v1/gu)?.length,
  1,
)
assert.match(migrationSource, /version_id = v_version\.id/u)
assert.match(migrationSource, /p_expected_document_revision/u)
assert.match(migrationSource, /stale_document/u)
assert.match(migrationSource, /create_resume_comment_anonymous_identity_v2/u)
assert.match(migrationSource, /version_id = p_version_id/u)
assert.match(forwardCompatibilityMigrationSource, /initialize_resume_active_version/u)
assert.match(forwardCompatibilityMigrationSource, /AFTER INSERT ON public\.resume_config/u)
assert.match(forwardCompatibilityMigrationSource, /CREATE TABLE IF NOT EXISTS public\.resume_comment_collaboration_sessions/u)
assert.doesNotMatch(originalCommentMigrationSource, /resume_comment_collaboration_sessions/u)
assert.match(crossBlockAnchorMigrationSource, /end_block\.ordinal >= start_block\.ordinal/u)
assert.match(crossBlockAnchorMigrationSource, /end_block\.end_offset/u)
assert.equal(
  bootstrapMigrationSource.match(
    /CREATE OR REPLACE FUNCTION public\.ensure_resume_version_comment_scope\(/gu,
  )?.length,
  2,
)
assert.equal(
  bootstrapMigrationSource.match(
    /CREATE OR REPLACE FUNCTION private\.ensure_resume_version_comment_scope_v1\(/gu,
  )?.length,
  1,
)
assert.ok(normalizedPrivateEnsureSource.includes(
  'CREATE OR REPLACE FUNCTION private.ensure_resume_version_comment_scope_v1( '
  + 'p_owner_user_id uuid, p_version_id bigint, p_anchor_document jsonb, '
  + 'p_document_hash text, p_projection_reference_date date, '
  + 'p_expected_document_revision bigint ) RETURNS uuid LANGUAGE plpgsql '
  + 'SECURITY DEFINER SET search_path = \'\'',
))
assert.ok(normalizedPublicFiveArgumentEnsureSource.includes(
  'CREATE OR REPLACE FUNCTION public.ensure_resume_version_comment_scope( '
  + 'p_owner_user_id uuid, p_version_id bigint, p_anchor_document jsonb, '
  + 'p_document_hash text, p_projection_reference_date date ) RETURNS uuid '
  + 'LANGUAGE plpgsql SECURITY DEFINER SET search_path = \'\'',
))
assert.doesNotMatch(publicFiveArgumentEnsureSource, /p_expected_document_revision/u)
assert.match(
  publicFiveArgumentEnsureSource,
  /PERFORM public\.assert_resume_comment_service_role\(\);[\s\S]*?private\.ensure_resume_version_comment_scope_v1\([\s\S]*?p_projection_reference_date,\s+NULL\s+\)/u,
)
assert.ok(normalizedPublicSixArgumentEnsureSource.includes(
  'CREATE OR REPLACE FUNCTION public.ensure_resume_version_comment_scope( '
  + 'p_owner_user_id uuid, p_version_id bigint, p_anchor_document jsonb, '
  + 'p_document_hash text, p_projection_reference_date date, '
  + 'p_expected_document_revision bigint ) RETURNS uuid LANGUAGE plpgsql '
  + 'SECURITY DEFINER SET search_path = \'\'',
))
assert.doesNotMatch(publicSixArgumentEnsureSource, /\bDEFAULT\b/u)
assert.match(
  publicSixArgumentEnsureSource,
  /PERFORM public\.assert_resume_comment_service_role\(\);\s+IF p_expected_document_revision IS NULL\s+OR p_expected_document_revision <= 0 THEN\s+RAISE EXCEPTION USING\s+ERRCODE = '22023',\s+MESSAGE = 'invalid expected document revision';/u,
)
assert.match(
  publicSixArgumentEnsureSource,
  /private\.ensure_resume_version_comment_scope_v1\([\s\S]*?p_projection_reference_date,\s+p_expected_document_revision\s+\)/u,
)
const privateEnsureLockIndex = privateEnsureSource.indexOf('FOR SHARE;')
const privateEnsureAnchorValidationIndex = privateEnsureSource.indexOf(
  'IF NOT public.is_valid_resume_comment_anchor_document(',
)
const existingScopeBranchStartMarker = 'IF v_scope.id IS NOT NULL THEN'
const existingScopeBranchEndMarker = 'IF p_expected_document_revision IS NOT NULL AND ('
const existingScopeAuthorityCondition = [
  'IF v_scope.owner_user_id <> p_owner_user_id',
  '      OR v_scope.resume_id <> v_version.resume_id',
  '      OR v_scope.version_id <> v_version.id THEN',
].join('\n')

function assertExistingScopeAuthority(source: string): string {
  const branchSource = readSourceSection(
    source,
    existingScopeBranchStartMarker,
    existingScopeBranchEndMarker,
  )
  const authorityConditionIndex = branchSource.indexOf(existingScopeAuthorityCondition)
  const authorityFailureIndex = branchSource.indexOf(
    'RAISE EXCEPTION USING ERRCODE = \'55000\', MESSAGE = \'version scope authority conflict\';',
  )
  const returnIndex = branchSource.indexOf('RETURN v_scope.id;')
  assert.ok(authorityConditionIndex >= 0)
  assert.ok(authorityFailureIndex > authorityConditionIndex)
  assert.ok(returnIndex > authorityFailureIndex)
  return branchSource
}

const existingScopeAuthoritySource = assertExistingScopeAuthority(privateEnsureSource)
const existingAuthorityConditionIndex = existingScopeAuthoritySource.indexOf(
  existingScopeAuthorityCondition,
)
const existingScopeReturnIndex = existingScopeAuthoritySource.indexOf('RETURN v_scope.id;')
const existingScopeWithoutAuthority = existingScopeAuthoritySource.slice(
  0,
  existingAuthorityConditionIndex,
) + existingScopeAuthoritySource.slice(existingScopeReturnIndex)
const privateEnsureWithoutExistingAuthority = privateEnsureSource.replace(
  existingScopeAuthoritySource,
  existingScopeWithoutAuthority,
)
assert.notEqual(privateEnsureWithoutExistingAuthority, privateEnsureSource)
assert.throws(() => assertExistingScopeAuthority(privateEnsureWithoutExistingAuthority))

const postInsertAuthoritySource = readSourceSection(
  privateEnsureSource,
  'IF v_scope.id IS NULL THEN',
  'RETURN v_scope.id;\nEND;',
)
assert.match(
  postInsertAuthoritySource,
  /IF v_scope\.owner_user_id <> p_owner_user_id\s+OR v_scope\.resume_id <> v_version\.resume_id\s+OR v_scope\.version_id <> v_version\.id THEN[\s\S]*?RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'version scope authority conflict';/u,
)
const privateEnsureExistingScopeIndex = privateEnsureSource.indexOf(
  existingScopeBranchStartMarker,
)
const privateEnsureExpectedRevisionIndex = privateEnsureSource.indexOf(
  'IF p_expected_document_revision IS NOT NULL AND (',
)
const privateEnsureInsertIndex = privateEnsureSource.indexOf(
  'INSERT INTO public.resume_comment_scopes',
)
assert.ok(privateEnsureLockIndex >= 0)
assert.ok(privateEnsureAnchorValidationIndex > privateEnsureLockIndex)
assert.ok(privateEnsureExistingScopeIndex > privateEnsureAnchorValidationIndex)
assert.ok(privateEnsureExpectedRevisionIndex > privateEnsureExistingScopeIndex)
assert.ok(privateEnsureInsertIndex > privateEnsureExpectedRevisionIndex)
assert.match(
  privateEnsureSource,
  /v_version\.document_revision IS DISTINCT FROM p_expected_document_revision\s+OR v_version\.projection_reference_date IS DISTINCT FROM p_projection_reference_date[\s\S]*?ERRCODE = 'P0409', MESSAGE = 'stale_document'/u,
)
assert.match(
  privateEnsureSource,
  /document_revision,[\s\S]*?projection_reference_date,[\s\S]*?VALUES \([\s\S]*?v_version\.document_revision,\s+p_projection_reference_date,/u,
)
assert.ok(normalizedBootstrapMigrationSource.includes(
  'CREATE OR REPLACE FUNCTION public.bootstrap_resume_comments_v1( '
  + 'p_protocol_version integer, p_access_kind text, p_user_id uuid DEFAULT NULL, '
  + 'p_scope_id uuid DEFAULT NULL, p_resume_id uuid DEFAULT NULL, '
  + 'p_version_id bigint DEFAULT NULL, p_share_id uuid DEFAULT NULL, '
  + 'p_release_id uuid DEFAULT NULL, p_password_generation text DEFAULT NULL, '
  + 'p_session_id text DEFAULT NULL, p_collaborator_role text DEFAULT NULL, '
  + 'p_anonymous_id uuid DEFAULT NULL, p_anonymous_secret_hash text DEFAULT NULL ) '
  + 'RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = \'\'',
))
assert.match(
  bootstrapMigrationSource,
  /FUNCTION public\.bootstrap_resume_comments_v1\([\s\S]*?LANGUAGE plpgsql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''[\s\S]*?AS \$\$[\s\S]*?BEGIN\s+PERFORM public\.assert_resume_comment_service_role\(\);/u,
)
assert.match(
  bootstrapMigrationSource,
  /p_access_kind NOT IN \('owner', 'collaborator', 'share'\)/u,
)
assert.doesNotMatch(
  bootstrapMigrationSource,
  /p_access_kind NOT IN \([^)]*'anonymous'/u,
)
assert.match(
  bootstrapMigrationSource,
  /CREATE OR REPLACE FUNCTION private\.resolve_resume_comment_bootstrap_access_v1\([\s\S]*?LANGUAGE plpgsql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''/u,
)
assert.match(
  bootstrapMigrationSource,
  /CREATE OR REPLACE FUNCTION private\.build_resume_comment_bootstrap_v1\(\s*p_access jsonb/u,
)
assert.equal(
  bootstrapMigrationSource.match(/SECURITY DEFINER/gu)?.length,
  bootstrapMigrationSource.match(/SET search_path = ''/gu)?.length,
)
assert.match(
  bootstrapMigrationSource,
  /thread_rows AS MATERIALIZED \([\s\S]*?FROM public\.resume_comment_threads AS threads/u,
)
assert.match(
  bootstrapMigrationSource,
  /comment_rows AS MATERIALIZED \([\s\S]*?JOIN thread_rows AS threads/u,
)
assert.match(
  bootstrapMigrationSource,
  /thread_counts AS \([\s\S]*?FROM thread_rows AS threads/u,
)
assert.equal(
  bootstrapMigrationSource.match(/FROM public\.resume_comment_threads AS threads/gu)?.length,
  1,
)
assert.match(
  bootstrapMigrationSource,
  /ORDER BY comments\.created_at ASC, comments\.id ASC/u,
)
assert.match(
  bootstrapMigrationSource,
  /ORDER BY threads\.last_activity_at DESC, threads\.id ASC/u,
)
assert.match(
  bootstrapMigrationSource,
  /profile_user_ids AS MATERIALIZED \([\s\S]*?UNION[\s\S]*?threads\.resolved_by_kind = 'user'/u,
)
assert.match(
  bootstrapMigrationSource,
  /'nodes', coalesce\([\s\S]*?jsonb_build_object\('nodeKey', nodes\.value ->> 'nodeKey'\)/u,
)
assert.doesNotMatch(
  bootstrapMigrationSource,
  /nodes\.value\s*->>?\s*'(?:text|blocks)'/u,
)
assert.match(
  bootstrapMigrationSource,
  /JOIN public\.resume_share_releases AS releases\s+ON releases\.id = shares\.current_release_id\s+AND releases\.share_id = shares\.id/u,
)
assert.match(
  bootstrapMigrationSource,
  /'accessibleScopes', pg_catalog\.jsonb_build_array\([\s\S]*?'last_read_event_seq', cursor\.value/u,
)
assert.match(
  bootstrapMigrationSource,
  /WHEN 'user' THEN[\s\S]*?states\.principal_kind = 'user'[\s\S]*?states\.principal_user_id = access\.actor_id/u,
)
assert.match(
  bootstrapMigrationSource,
  /WHEN 'anonymous' THEN[\s\S]*?states\.principal_kind = 'anonymous'[\s\S]*?states\.principal_anonymous_id = access\.actor_id/u,
)
assert.doesNotMatch(
  bootstrapMigrationSource,
  /(?:UPDATE|INSERT INTO)\s+public\.resume_comment_(?:anonymous_identities|collaboration_members)[\s\S]{1,240}\blast_seen_at\b/u,
)
assert.match(
  bootstrapMigrationSource,
  /identities\.id = p_anonymous_id[\s\S]*?identities\.version_id = p_version_id[\s\S]*?identities\.secret_hash = p_anonymous_secret_hash[\s\S]*?identities\.revoked_at IS NULL/u,
)
assert.doesNotMatch(bootstrapMigrationSource, /identities\.share_id = p_share_id/u)
assert.match(
  bootstrapMigrationSource,
  /ELSIF p_user_id IS NULL\s+AND \(p_anonymous_id IS NOT NULL OR p_anonymous_secret_hash IS NOT NULL\)/u,
)
assert.match(bootstrapMigrationSource, /'canWrite', v_share\.allow_comments/u)
assert.match(bootstrapMigrationSource, /'sharePasswordHash', v_share\.password_hash/u)
assert.match(
  bootstrapMigrationSource,
  /p_collaborator_role IS NULL\s+OR p_collaborator_role NOT IN \('editor', 'viewer'\)/u,
)
assert.match(
  bootstrapMigrationSource,
  /v_member\.role IS DISTINCT FROM p_collaborator_role/u,
)
assert.match(bootstrapMigrationSource, /ERRCODE = 'P0409', MESSAGE = 'stale_release'/u)
assert.doesNotMatch(bootstrapMigrationSource, /ERRCODE = '40001', MESSAGE = 'stale_release'/u)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON FUNCTION public\.assert_resume_comment_service_role\(\) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public\.assert_resume_comment_service_role\(\) TO service_role;/u,
)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON FUNCTION public\.bootstrap_resume_comments_v1\( integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text \) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public\.bootstrap_resume_comments_v1\( integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text \) TO service_role;/u,
)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON FUNCTION private\.resolve_resume_comment_bootstrap_access_v1\([\s\S]*?\) FROM PUBLIC, anon, authenticated, service_role;/u,
)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON FUNCTION private\.build_resume_comment_bootstrap_v1\(jsonb\) FROM PUBLIC, anon, authenticated, service_role;/u,
)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON FUNCTION private\.ensure_resume_version_comment_scope_v1\( uuid, bigint, jsonb, text, date, bigint \) FROM PUBLIC, anon, authenticated, service_role;/u,
)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON FUNCTION public\.ensure_resume_version_comment_scope\( uuid, bigint, jsonb, text, date \) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public\.ensure_resume_version_comment_scope\( uuid, bigint, jsonb, text, date \) TO service_role;/u,
)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON FUNCTION public\.ensure_resume_version_comment_scope\( uuid, bigint, jsonb, text, date, bigint \) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public\.ensure_resume_version_comment_scope\( uuid, bigint, jsonb, text, date, bigint \) TO service_role;/u,
)
assert.match(
  normalizedBootstrapMigrationSource,
  /REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;/u,
)
const resolverSource = bootstrapMigrationSource.slice(
  bootstrapMigrationSource.indexOf(
    'CREATE OR REPLACE FUNCTION private.resolve_resume_comment_bootstrap_access_v1',
  ),
  bootstrapMigrationSource.indexOf(
    'CREATE OR REPLACE FUNCTION private.build_resume_comment_bootstrap_v1',
  ),
)
assert.doesNotMatch(resolverSource, /FOR (?:KEY )?SHARE/u)
assert.match(shareEdgeSource, /authenticateSupabaseUser/u)
assert.doesNotMatch(shareEdgeSource, /\.auth\.getUser\(/u)
assert.match(shareEdgeSource, /comment_access_token/u)
assert.match(shareEdgeSource, /projection_reference_date/u)
assert.match(shareEdgeSource, /version_id/u)
assert.match(shareEdgeSource, /version:resume_config_versions/u)
assert.match(shareEdgeSource, /if \(!refreshOnly\)/u)

const secret = 'resume-comment-verification-secret-000000000000'
const now = Math.floor(Date.now() / 1_000)
const sharePayload = {
  version: 1 as const,
  kind: 'share' as const,
  issuedAt: now,
  expiresAt: now + 15 * 60,
  shareId: '00000000-0000-4000-8000-000000000001',
  versionId: 42,
  releaseId: '00000000-0000-4000-8000-000000000002',
  scopeId: '00000000-0000-4000-8000-000000000003',
  passwordGeneration: 'generation',
}

const token = await signCommentToken(sharePayload, secret)
assert.deepEqual(await verifyCommentToken(token, 'share', secret), sharePayload)
const [encodedPayload, encodedSignature] = token.split('.') as [string, string]
const tamperedSignature = Buffer.from(encodedSignature, 'base64url')
tamperedSignature[0] ^= 1
await assert.rejects(
  verifyCommentToken(
    `${encodedPayload}.${tamperedSignature.toString('base64url')}`,
    'share',
    secret,
  ),
  (error: unknown) => error instanceof CommentApiError && error.code === 'unauthorized',
)
const anonymousSecret = Buffer.alloc(32, 7).toString('base64url')
assert.match(await hashAnonymousSecret(anonymousSecret, secret), /^[0-9a-f]{64}$/u)
assert.equal(normalizeCommentBody('  评论 👨‍👩‍👧‍👦  '), '评论 👨‍👩‍👧‍👦')
assert.throws(
  () => normalizeCommentBody('x\u0000y'),
  (error: unknown) => error instanceof CommentApiError,
)
assert.throws(
  () => normalizeCommentBody('字'.repeat(2_001)),
  (error: unknown) => error instanceof CommentApiError && error.code === 'content_too_long',
)
assert.equal(isSafeCommentLink('https://example.com/path'), true)
assert.equal(isSafeCommentLink('mailto:user@example.com'), true)
assert.equal(isSafeCommentLink('javascript:alert(1)'), false)
assert.equal(readCommentOp({ op: 'create_thread' }), 'create_thread')
assert.equal(readCommentOp({ op: 'mark_thread_read' }), 'mark_thread_read')
assert.equal(
  readCommentOp({ op: 'join_collaboration_session' }),
  'join_collaboration_session',
)
assert.throws(
  () => readCommentOp({ op: 'unknown' }),
  (error: unknown) => error instanceof CommentApiError && error.code === 'not_found',
)

assert.deepEqual(readCommentAnchor({
  nodeKey: 'basics/singleton/name',
  startGraphemeOffset: 0,
  endGraphemeOffset: 1,
  blockOrdinal: 0,
  exactQuote: '张',
  prefix: '',
  suffix: '三',
  nodeTextHash: 'a'.repeat(64),
  createdAtContentHash: 'b'.repeat(64),
}), {
  nodeKey: 'basics/singleton/name',
  startGraphemeOffset: 0,
  endGraphemeOffset: 1,
  blockOrdinal: 0,
  exactQuote: '张',
  prefix: '',
  suffix: '三',
  nodeTextHash: 'a'.repeat(64),
  createdAtContentHash: 'b'.repeat(64),
})

const scopeTopic = await deriveScopeRealtimeTopic({
  scopeId: sharePayload.scopeId,
  versionId: sharePayload.versionId,
  secret,
  nowSeconds: 1_800,
})
const sameScopeTopic = await deriveScopeRealtimeTopic({
  scopeId: sharePayload.scopeId,
  versionId: sharePayload.versionId,
  secret,
  nowSeconds: 2_699,
})
const nextScopeTopic = await deriveScopeRealtimeTopic({
  scopeId: sharePayload.scopeId,
  versionId: sharePayload.versionId,
  secret,
  nowSeconds: 2_700,
})
assert.equal(scopeTopic.topic, sameScopeTopic.topic)
assert.notEqual(scopeTopic.topic, nextScopeTopic.topic)
assert.equal(scopeTopic.topic.includes(sharePayload.scopeId), false)
assert.equal(scopeTopic.expiresAt, 2_700)
assert.notEqual(
  scopeTopic.topic,
  (await deriveOwnerRealtimeTopic({
    userId: '00000000-0000-4000-8000-000000000004',
    secret,
    nowSeconds: 1_800,
  })).topic,
)

const broadcasts: unknown[] = []
await broadcastCommentInvalidation({
  admin: {
    channel: topic => ({
      async httpSend(event, payload) {
        broadcasts.push({ topic, event, payload })
      },
      async unsubscribe() {},
    }),
  },
  topics: [scopeTopic.topic],
  eventSeq: 42,
  type: 'comment_replied',
})
assert.deepEqual(broadcasts, [{
  topic: scopeTopic.topic,
  event: 'invalidate',
  payload: { eventSeq: 42, type: 'comment_replied' },
}])

console.warn('resume comment service verification passed')
