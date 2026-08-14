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
const edgeSource = readFileSync('supabase/functions/resume-comments/index.ts', 'utf8')
const corsSource = readFileSync('supabase/functions/shared/cors.ts', 'utf8')
const prewarmSource = readFileSync('scripts/prewarm-resume-comment-scopes.ts', 'utf8')
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
const normalizedBootstrapMigrationSource = bootstrapMigrationSource.replace(/\s+/gu, ' ')
assert.match(edgeSource, /ensure_resume_version_comment_scope/u)
assert.doesNotMatch(edgeSource, /ensure_resume_working_comment_scope/u)
assert.match(edgeSource, /execute_resume_version_comment_write/u)
assert.match(edgeSource, /parentCommentId/u)
assert.match(edgeSource, /op === 'list_events'/u)
assert.match(edgeSource, /scheduleBackground\(notifyWrite/u)
assert.match(edgeSource, /Server-Timing/u)
assert.match(edgeSource, /X-Request-Id/u)
assert.match(edgeSource, /authenticateSupabaseUser/u)
assert.doesNotMatch(edgeSource, /\.auth\.getUser\(/u)
assert.match(corsSource, /Access-Control-Max-Age/u)
assert.match(corsSource, /X-Sb-Edge-Region/u)
assert.match(edgeSource, /timeOperation\('threads'/u)
assert.match(edgeSource, /const counts = countThreadRows\(threads\)/u)
assert.match(edgeSource, /return existing as ScopeRow/u)
assert.match(corsSource, /x-request-id/u)
assert.match(
  prewarmSource,
  /console\.log\(JSON\.stringify\(summary\)\)[\s\S]*?if \(summary\.failed > 0\) \{\s*process\.exitCode = 1/u,
)
assert.match(edgeSource, /stale_document/u)
assert.match(edgeSource, /expectedDocumentRevision/u)
assert.match(edgeSource, /nodeMap\.get\(anchor\.nodeKey\),\s+documentHash/u)
assert.match(edgeSource, /loadThreads\(admin, access\.scope\.id, \[threadId\]\)/u)
assert.doesNotMatch(edgeSource, /await notifyWrite/u)
assert.match(edgeSource, /token\.resumeId !== session\.resume_id/u)
assert.match(edgeSource, /token\.role !== member\.role/u)
assert.match(edgeSource, /token\.versionId !== scope\.version_id/u)
assert.match(edgeSource, /session\.revoked_at/u)
assert.match(edgeSource, /\.eq\('host_lease_id', hostLeaseId\)/u)
assert.match(migrationSource, /kind = 'version'/u)
assert.match(migrationSource, /version_id = p_version_id/u)
assert.match(migrationSource, /invalid reply parent/u)
assert.match(migrationSource, /SET parent_id = v_parent_id/u)
assert.match(transactionSource, /SET body = '', deleted_at = now\(\)/u)
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
  bootstrapMigrationSource,
  /v_scope\.owner_user_id <> p_owner_user_id\s+OR v_scope\.resume_id <> v_version\.resume_id\s+OR v_scope\.version_id <> v_version\.id/u,
)
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
const shareEdgeSource = readFileSync('supabase/functions/resume-share/index.ts', 'utf8')
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
await assert.rejects(
  verifyCommentToken(token, 'collaborator', secret),
  (error: unknown) => error instanceof CommentApiError && error.code === 'unauthorized',
)

const collaboratorPayload = {
  version: 1 as const,
  kind: 'collaborator' as const,
  issuedAt: now,
  expiresAt: now + 15 * 60,
  sessionId: 'session-comment-0001',
  resumeId: '00000000-0000-4000-8000-000000000011',
  scopeId: '00000000-0000-4000-8000-000000000012',
  versionId: 42,
  userId: '00000000-0000-4000-8000-000000000013',
  role: 'editor' as const,
}
const collaboratorToken = await signCommentToken(collaboratorPayload, secret)
assert.deepEqual(
  await verifyCommentToken(collaboratorToken, 'collaborator', secret),
  collaboratorPayload,
)
const [, collaboratorSignature] = collaboratorToken.split('.') as [string, string]
const forgedRolePayload = Buffer.from(JSON.stringify({
  ...collaboratorPayload,
  role: 'viewer',
})).toString('base64url')
await assert.rejects(
  verifyCommentToken(`${forgedRolePayload}.${collaboratorSignature}`, 'collaborator', secret),
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
