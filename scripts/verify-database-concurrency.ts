import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { buildCommentAnchorDocument } from '../supabase/functions/shared/resume-comment-core.ts'

const rounds = 20
const userId = '60000000-0000-4000-8000-000000000001'
const projectionReferenceDate = '2026-08-16'
const snapshot = {
  basics: { name: '并发契约测试' },
  order: ['basics'],
}
const { document: anchorDocument, documentHash } = buildCommentAnchorDocument(
  snapshot,
  projectionReferenceDate,
)

interface QueryResult {
  code: number
  stdout: string
  stderr: string
  durationMs: number
}

function sqlJson(value: unknown) {
  const quote = String.fromCodePoint(39)
  const escaped = JSON.stringify(value).replaceAll(quote, quote.repeat(2))
  return `${quote}${escaped}${quote}::jsonb`
}

function resumeIdForRound(round: number) {
  return `60000000-0000-4000-8001-${String(round + 1).padStart(12, '0')}`
}

function requestIdForRound(round: number, offset: number) {
  return `61000000-0000-4000-8001-${String(round * 10 + offset).padStart(12, '0')}`
}

function runQuery(sql: string): Promise<QueryResult> {
  const startedAt = performance.now()
  return new Promise((resolve, reject) => {
    const child = spawn(
      'supabase',
      ['db', 'query', '--local', '--output-format', 'json', sql],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => stdout += chunk)
    child.stderr.on('data', chunk => stderr += chunk)
    child.on('error', reject)
    child.on('close', code => resolve({
      code: code ?? 1,
      stdout,
      stderr,
      durationMs: performance.now() - startedAt,
    }))
  })
}

function classify(result: QueryResult) {
  if (result.code === 0)
    return 'success' as const
  const output = `${result.stdout}\n${result.stderr}`
  if (/40P01|deadlock detected/iu.test(output))
    return 'deadlock' as const
  if (/40001|55P03|P0002|request_in_progress|stale_|not_found|lock timeout/iu.test(output))
    return 'retryable' as const
  return 'unexpected' as const
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}

function summarize(values: number[]) {
  return {
    p50Ms: Math.round(percentile(values, 0.5) * 10) / 10,
    p95Ms: Math.round(percentile(values, 0.95) * 10) / 10,
    maxMs: Math.round(Math.max(...values, 0) * 10) / 10,
  }
}

function serviceTransaction(statement: string) {
  return `
    BEGIN;
    SET LOCAL ROLE service_role;
    SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    ${statement}
    COMMIT;
  `
}

function ownerTransaction(statement: string) {
  return `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT pg_catalog.set_config('request.jwt.claim.sub', '${userId}', true);
    SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    ${statement}
    COMMIT;
  `
}

const connectivity = await runQuery('SELECT 1 AS local_database_ready;')
if (connectivity.code !== 0) {
  throw new Error(
    'Local Supabase database is unavailable; start it before running concurrency verification',
  )
}

const resumeSeeds = Array.from({ length: rounds }, (_, round) => {
  const resumeId = resumeIdForRound(round)
  return `
    INSERT INTO public.resume_config (
      resume_id, user_id, display_name, basics, "order"
    ) VALUES (
      '${resumeId}',
      '${userId}',
      'concurrency-${round + 1}',
      ${sqlJson(snapshot.basics)},
      ${sqlJson(snapshot.order)}
    );
    UPDATE public.resume_config_versions AS versions
    SET snapshot = ${sqlJson(snapshot)},
        content_hash = '${documentHash}',
        projection_reference_date = '${projectionReferenceDate}'::date
    FROM public.resume_config AS configs
    WHERE configs.resume_id = '${resumeId}'
      AND versions.id = configs.current_version_id;
    INSERT INTO public.resume_comment_scopes (
      kind,
      owner_user_id,
      resume_id,
      version_id,
      anchor_document,
      document_hash,
      document_revision,
      projection_reference_date,
      next_event_seq
    )
    SELECT
      'version',
      configs.user_id,
      configs.resume_id,
      versions.id,
      ${sqlJson(anchorDocument)},
      '${documentHash}',
      versions.document_revision,
      '${projectionReferenceDate}'::date,
      0
    FROM public.resume_config AS configs
    JOIN public.resume_config_versions AS versions
      ON versions.id = configs.current_version_id
    WHERE configs.resume_id = '${resumeId}';
  `
}).join('\n')

const seed = await runQuery(`
  INSERT INTO auth.users (id, email)
  VALUES ('${userId}', 'database-concurrency@example.invalid');
  ${resumeSeeds}
`)
assert.equal(seed.code, 0, 'concurrency fixtures must be created')

const versionOutcomes: Array<ReturnType<typeof classify>> = []
const idempotencyOutcomes: Array<ReturnType<typeof classify>> = []
const rateLimitOutcomes: Array<ReturnType<typeof classify>> = []
const versionDurations: number[] = []
const idempotencyDurations: number[] = []
const rateLimitDurations: number[] = []

try {
  for (let round = 0; round < rounds; round += 1) {
    const resumeId = resumeIdForRound(round)
    const syncRequestId = requestIdForRound(round, 1)
    const readRequestId = requestIdForRound(round, 2)
    const sync = serviceTransaction(`
      SELECT public.sync_resume_version_comment_document_v3(
        scopes.id,
        versions.id,
        '${userId}',
        ${sqlJson(snapshot)},
        ${sqlJson(anchorDocument)},
        '${documentHash}',
        versions.document_revision,
        '${projectionReferenceDate}'::date,
        '[]'::jsonb,
        'user:${userId}',
        '${syncRequestId}'
      ) AS result
      FROM public.resume_config AS configs
      JOIN public.resume_config_versions AS versions
        ON versions.id = configs.current_version_id
      JOIN public.resume_comment_scopes AS scopes
        ON scopes.version_id = versions.id
       AND scopes.kind = 'version'
       AND scopes.archived_at IS NULL
      WHERE configs.resume_id = '${resumeId}';
    `)
    const createNext = ownerTransaction(`
      SELECT public.create_next_resume_version(
        '${resumeId}',
        'concurrency-next-${round + 1}'
      ) AS result;
    `)
    const [syncResult, createResult] = await Promise.all([
      runQuery(sync),
      runQuery(createNext),
    ])
    const pairOutcomes = [classify(syncResult), classify(createResult)]
    versionOutcomes.push(...pairOutcomes)
    versionDurations.push(syncResult.durationMs, createResult.durationMs)
    assert.ok(pairOutcomes.includes('success'), `round ${round + 1} must make progress`)
    assert.ok(!pairOutcomes.includes('deadlock'), `round ${round + 1} must not deadlock`)
    assert.ok(!pairOutcomes.includes('unexpected'), `round ${round + 1} returned an unexpected error`)

    const originalScopeId = `(
      SELECT scopes.id
      FROM public.resume_comment_scopes AS scopes
      WHERE scopes.resume_id = '${resumeId}'
      ORDER BY scopes.created_at
      LIMIT 1
    )`
    const markRead = serviceTransaction(`
      SELECT public.execute_resume_version_comment_write(
        'mark_read',
        ${originalScopeId},
        'user',
        '${userId}',
        'user:${userId}',
        '${readRequestId}',
        '{"eventSeq":0}'::jsonb
      ) AS result;
    `)
    const [firstReplay, secondReplay] = await Promise.all([
      runQuery(markRead),
      runQuery(markRead),
    ])
    const replayOutcomes = [classify(firstReplay), classify(secondReplay)]
    idempotencyOutcomes.push(...replayOutcomes)
    idempotencyDurations.push(firstReplay.durationMs, secondReplay.durationMs)
    assert.deepEqual(replayOutcomes, ['success', 'success'])
    assert.equal(firstReplay.stdout.trim(), secondReplay.stdout.trim())

    const rateLimit = serviceTransaction(`
      SELECT public.check_resume_comment_rate_limit(
        'concurrency-actor-${round + 1}',
        'concurrency-network-${round + 1}',
        NULL,
        NULL
      ) AS retry_after;
    `)
    const [firstLimit, secondLimit] = await Promise.all([
      runQuery(rateLimit),
      runQuery(rateLimit),
    ])
    const limitOutcomes = [classify(firstLimit), classify(secondLimit)]
    rateLimitOutcomes.push(...limitOutcomes)
    rateLimitDurations.push(firstLimit.durationMs, secondLimit.durationMs)
    assert.deepEqual(limitOutcomes, ['success', 'success'])
  }
}
finally {
  await runQuery(`DELETE FROM auth.users WHERE id = '${userId}';`)
}

const report = {
  rounds,
  versionRace: {
    success: versionOutcomes.filter(outcome => outcome === 'success').length,
    retryable: versionOutcomes.filter(outcome => outcome === 'retryable').length,
    deadlocks: versionOutcomes.filter(outcome => outcome === 'deadlock').length,
    ...summarize(versionDurations),
  },
  idempotency: {
    success: idempotencyOutcomes.filter(outcome => outcome === 'success').length,
    deadlocks: idempotencyOutcomes.filter(outcome => outcome === 'deadlock').length,
    ...summarize(idempotencyDurations),
  },
  rateLimit: {
    success: rateLimitOutcomes.filter(outcome => outcome === 'success').length,
    deadlocks: rateLimitOutcomes.filter(outcome => outcome === 'deadlock').length,
    ...summarize(rateLimitDurations),
  },
}

assert.equal(report.versionRace.deadlocks, 0)
assert.equal(report.idempotency.deadlocks, 0)
assert.equal(report.rateLimit.deadlocks, 0)
console.warn(JSON.stringify(report))
