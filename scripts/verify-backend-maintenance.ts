import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildBackendAlertWebhook,
  readBackendOpsSnapshot,
  readHttpsWebhookUrl,
} from '../supabase/functions/backend-ops-monitor/core.ts'
import {
  constantTimeEqual,
  hasValidMaintenanceToken,
  readBearerToken,
} from '../supabase/functions/shared/maintenance-auth.ts'

const migration = readFileSync(
  'supabase/migrations/20260816170453_add_backend_maintenance_jobs.sql',
  'utf8',
)
const monitorEdge = readFileSync(
  'supabase/functions/backend-ops-monitor/index.ts',
  'utf8',
)
const githubEdge = readFileSync(
  'supabase/functions/github-stars-refresh/index.ts',
  'utf8',
)
const maintenanceAuth = readFileSync(
  'supabase/functions/shared/maintenance-auth.ts',
  'utf8',
)
const config = readFileSync('supabase/config.toml', 'utf8')
const workflow = readFileSync('.github/workflows/database.yml', 'utf8')

assert.equal(constantTimeEqual('same-secret', 'same-secret'), true)
assert.equal(constantTimeEqual('same-secret', 'wrong-secret'), false)
assert.equal(constantTimeEqual('same-secret', 'same-secret-longer'), false)

const token = 'a'.repeat(48)
const validRequest = new Request('https://example.invalid', {
  headers: { authorization: `Bearer ${token}` },
})
assert.equal(readBearerToken(validRequest), token)
assert.equal(hasValidMaintenanceToken(validRequest, token), true)
assert.equal(
  hasValidMaintenanceToken(new Request('https://example.invalid'), token),
  false,
)
assert.equal(
  hasValidMaintenanceToken(
    new Request('https://example.invalid', {
      headers: { authorization: 'Basic invalid' },
    }),
    token,
  ),
  false,
)
assert.equal(
  hasValidMaintenanceToken(
    new Request('https://example.invalid', {
      headers: { authorization: `Bearer ${token.slice(1)}` },
    }),
    token,
  ),
  false,
)

const rawSnapshot = {
  generatedAt: '2026-08-16T00:00:00.000Z',
  windowMinutes: 15,
  alerts: [
    {
      code: 'comment_transaction_failures',
      severity: 'high',
      count: 4,
      deadlocks: 1,
      cleanupBacklog: false,
    },
    {
      code: 'github_cache_stale',
      severity: 'warning',
      consecutiveFailures: 3,
      stale: true,
    },
  ],
  notificationCodes: ['comment_transaction_failures'],
  summary: { commentRequests: 20, commentFailures: 4 },
}
const snapshot = readBackendOpsSnapshot(rawSnapshot)
assert.ok(snapshot)
assert.deepEqual(snapshot.alerts[0]?.details, {
  count: 4,
  deadlocks: 1,
  cleanupBacklog: false,
})
assert.deepEqual(buildBackendAlertWebhook(snapshot), {
  event: 'resume_backend_alert',
  generatedAt: rawSnapshot.generatedAt,
  windowMinutes: 15,
  alerts: [snapshot.alerts[0]],
  summary: rawSnapshot.summary,
})
assert.equal(
  readBackendOpsSnapshot({
    ...rawSnapshot,
    notificationCodes: ['unknown_alert'],
  }),
  null,
)
assert.equal(
  readBackendOpsSnapshot({
    ...rawSnapshot,
    alerts: [{ code: 'bad-code', severity: 'critical', count: 1 }],
    notificationCodes: [],
  }),
  null,
)
assert.equal(
  readBackendOpsSnapshot({
    ...rawSnapshot,
    alerts: [{ code: 'valid_code', severity: 'critical', userId: 'secret' }],
    notificationCodes: [],
  }),
  null,
)
assert.equal(
  readBackendOpsSnapshot({ ...rawSnapshot, windowMinutes: 1441 }),
  null,
)
assert.equal(
  readBackendOpsSnapshot({
    ...rawSnapshot,
    alerts: Array.from({ length: 33 }, (_, index) => ({
      code: `alert_${index}`,
      severity: 'warning',
      count: 1,
    })),
    notificationCodes: [],
  }),
  null,
)

assert.equal(
  readHttpsWebhookUrl('https://hooks.example.invalid/backend-alert'),
  'https://hooks.example.invalid/backend-alert',
)
for (const invalidUrl of [
  undefined,
  'http://hooks.example.invalid/backend-alert',
  'https://user:password@hooks.example.invalid/backend-alert',
  'https://hooks.example.invalid/backend-alert#fragment',
  'not-a-url',
]) {
  assert.equal(readHttpsWebhookUrl(invalidUrl), null)
}

assert.match(
  migration,
  /CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog/u,
)
assert.match(
  migration,
  /CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions/u,
)
assert.match(
  migration,
  /CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault/u,
)
assert.match(
  migration,
  /REVOKE USAGE ON SCHEMA net FROM PUBLIC, anon, authenticated, service_role/u,
)
assert.match(
  migration,
  /REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA net\s+FROM PUBLIC, anon, authenticated, service_role/u,
)
assert.match(
  config,
  /\[api\]\s+schemas = \["public", "storage", "graphql_public"\]\s+extra_search_path = \["public", "extensions"\]/u,
)
assert.doesNotMatch(config, /schemas\s*=\s*\[[^\]]*"(?:net|private)"/u)
assert.match(migration, /cleanup_enabled boolean NOT NULL DEFAULT false/u)
assert.match(migration, /edge_jobs_enabled boolean NOT NULL DEFAULT false/u)
assert.match(migration, /CREATE TABLE private\.backend_edge_dispatches/u)
assert.match(migration, /preview_backend_transient_cleanup_v1/u)
assert.match(migration, /p_batch_size < 100 OR p_batch_size > 5000/u)
assert.ok((migration.match(/FOR UPDATE SKIP LOCKED/gu) ?? []).length >= 8)
assert.match(migration, /pg_try_advisory_xact_lock/u)
assert.match(migration, /SET lock_timeout = '2s'/u)
assert.match(migration, /SET statement_timeout = '30s'/u)
assert.match(migration, /requests\.state <> 'pending'/u)
assert.ok(
  migration.indexOf('INSERT INTO private.ai_usage_daily_rollups')
  < migration.indexOf('DELETE FROM public.ai_credit_requests'),
)
assert.match(migration, /events\.created_at < v_now - interval '7 days'/u)
assert.match(migration, /metrics\.bucket_minute < v_now - interval '30 days'/u)
assert.match(migration, /requests\.finalized_at < v_now - interval '180 days'/u)
assert.match(migration, /sessions\.expires_at < v_now - interval '24 hours'/u)
assert.match(migration, /members\.expires_at < v_now - interval '24 hours'/u)
assert.ok(
  migration.indexOf('DELETE FROM public.resume_comment_collaboration_members')
  < migration.indexOf('DELETE FROM public.resume_comment_collaboration_sessions'),
)
assert.match(
  migration,
  /NOT EXISTS \(\s+SELECT 1\s+FROM public\.resume_comment_collaboration_members AS members\s+WHERE members\.session_id = sessions\.session_id\s+\)/u,
)
assert.doesNotMatch(
  migration,
  /DROP TABLE[^;]*resume_comment_collaboration_(?:sessions|members)/iu,
)
assert.doesNotMatch(
  migration,
  /ALTER TABLE[^;]*resume_comment_collaboration_(?:sessions|members)[^;]*RENAME/iu,
)
assert.match(migration, /resume_backend_project_url/u)
assert.match(migration, /resume_backend_maintenance_token/u)
assert.match(
  migration,
  /p_function_name NOT IN \('github-stars-refresh', 'backend-ops-monitor'\)/u,
)
assert.match(migration, /timeout_milliseconds => 10000/u)
assert.match(migration, /'outcome', 'queued', 'requestId', v_request_id/u)
assert.match(migration, /reconcile_backend_edge_dispatches_v1/u)
assert.match(migration, /LEFT JOIN net\._http_response AS responses/u)
assert.match(migration, /LEFT JOIN net\.http_request_queue AS queued_requests/u)
assert.match(migration, /queued_requests\.id IS NULL/u)
assert.match(migration, /'edge_response_missing'/u)
assert.match(migration, /'edge_response_timeout'/u)
assert.match(migration, /'edge_transport_error'/u)
assert.match(migration, /'edge_http_status'/u)
assert.match(migration, /WHEN lock_not_available THEN/u)
assert.match(migration, /WHEN query_canceled THEN/u)
assert.match(migration, /details\.status <> 'succeeded'/u)
assert.match(migration, /v_stale_edge_dispatches > 0/u)
assert.match(migration, /observation_rank <= 3/u)
assert.match(
  migration,
  /bool_and\(recent\.outcome = 'success' AND recent\.batch_limit_hit\)/u,
)
assert.match(migration, /last_notified_at < v_now - interval '1 hour'/u)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION private\.cleanup_backend_transient_data_v1\(integer\)/u,
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.evaluate_backend_ops_alerts_v1\(integer\)\s+TO service_role/u,
)
assert.doesNotMatch(
  migration,
  /(?:TRUNCATE|VACUUM\s+FULL|DROP\s+EXTENSION[^;]*CASCADE)/iu,
)
assert.doesNotMatch(migration, /Bearer\s+[\w-]{24,}/u)

const expectedJobs = new Map([
  ['resume-backend-ai-reconcile', '*/5 * * * *'],
  ['resume-backend-edge-dispatch-reconcile', '* * * * *'],
  ['resume-backend-transient-cleanup', '17 * * * *'],
  ['resume-backend-transient-catchup', '42 3 * * *'],
  ['resume-backend-ops-monitor', '*/5 * * * *'],
  ['resume-github-stars-refresh', '11 */6 * * *'],
])
for (const [name, schedule] of expectedJobs) {
  assert.match(
    migration,
    new RegExp(`'${name}',\\s*'${schedule.replaceAll('*', '\\*')}'`, 'u'),
  )
}

for (const edge of [monitorEdge, githubEdge]) {
  assert.match(edge, /request\.method !== 'POST'/u)
  assert.match(edge, /BACKEND_MAINTENANCE_TOKEN/u)
  assert.match(edge, /maintenanceToken\.length < 32/u)
  assert.match(edge, /hasValidMaintenanceToken\(request, maintenanceToken\)/u)
  assert.match(edge, /const rawBody = await request\.text\(\)/u)
  assert.match(edge, /Object\.keys\(body\)\.length > 0/u)
}
assert.match(maintenanceAuth, /difference \|=/u)
assert.match(maintenanceAuth, /leftBytes\.length \^ rightBytes\.length/u)
assert.match(monitorEdge, /evaluate_backend_ops_alerts_v1/u)
assert.match(monitorEdge, /OPS_ALERT_WEBHOOK_URL/u)
assert.match(monitorEdge, /AbortSignal\.timeout\(5_000\)/u)
assert.ok(
  monitorEdge.indexOf('if (!webhookResponse.ok)')
  < monitorEdge.indexOf('ack_backend_alert_delivery_v1'),
)
assert.doesNotMatch(
  monitorEdge,
  /webhookResponse\.(?:json|text|arrayBuffer)\(/u,
)
assert.match(config, /\[functions\.backend-ops-monitor\]\s+verify_jwt = false/u)
assert.match(
  workflow,
  /uses: denoland\/setup-deno@[0-9a-f]{40} # v2\.0\.5/u,
)
assert.match(workflow, /deno-version: 2\.2\.7/u)
assert.match(workflow, /deno check --no-lock/u)
assert.match(workflow, /supabase\/functions\/backend-ops-monitor\/index\.ts/u)

console.warn('Backend maintenance verification passed')
