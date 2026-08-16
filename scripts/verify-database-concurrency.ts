import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { env } from 'node:process'
import { Client } from 'pg'
import { buildCommentAnchorDocument } from '../supabase/functions/shared/resume-comment-core.ts'

const rounds = Number.parseInt(env.DATABASE_CONCURRENCY_ROUNDS ?? '20', 10)
assert.ok(
  Number.isInteger(rounds) && rounds >= 1 && rounds <= 100,
  'database concurrency rounds must be an integer between 1 and 100',
)
const userId = '60000000-0000-4000-8000-000000000001'
const projectionReferenceDate = '2026-08-16'
const productionProjectRef = 'bitxrpdtlohlnywgusfw'
const usesLinkedDatabase = env.DATABASE_CONCURRENCY_TARGET === 'linked'
const directDatabaseUrl = env.DATABASE_CONCURRENCY_DB_URL?.trim()
const databaseSslCaPath = env.DATABASE_CONCURRENCY_CA_CERT_PATH?.trim()
let expectedProjectRef: string | undefined
let verifiedDatabaseConnection: {
  database: string
  host: string
  password: string
  port: number
  user: string
} | undefined
let databaseSslCa: string | undefined

assert.ok(
  !directDatabaseUrl || usesLinkedDatabase,
  'direct database verification requires DATABASE_CONCURRENCY_TARGET=linked',
)

if (usesLinkedDatabase) {
  expectedProjectRef = env.DATABASE_CONCURRENCY_PROJECT_REF?.trim()
  const linkedProjectRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  assert.ok(expectedProjectRef, 'linked concurrency verification requires an explicit project ref')
  assert.notEqual(
    expectedProjectRef,
    productionProjectRef,
    'linked concurrency verification is forbidden on the production project',
  )
  assert.equal(
    linkedProjectRef,
    expectedProjectRef,
    'the linked project must match the explicitly allowed isolated project',
  )
  if (directDatabaseUrl) {
    const parsedDatabaseUrl = new URL(directDatabaseUrl)
    assert.equal(parsedDatabaseUrl.protocol, 'postgresql:')
    assert.equal(parsedDatabaseUrl.username, `postgres.${expectedProjectRef}`)
    assert.ok(parsedDatabaseUrl.password, 'direct database verification requires a password')
    assert.match(parsedDatabaseUrl.hostname, /^[a-z0-9-]+\.pooler\.supabase\.com$/u)
    assert.equal(parsedDatabaseUrl.pathname, '/postgres')
    assert.ok(
      parsedDatabaseUrl.searchParams.size === 0,
      'direct database URL must not contain query parameters; connection fields and TLS are configured separately',
    )
    assert.equal(parsedDatabaseUrl.hash, '', 'direct database URL must not contain a fragment')
    const databasePort = Number.parseInt(parsedDatabaseUrl.port, 10)
    assert.ok(
      databasePort === 5432 || databasePort === 6543,
      'direct database verification requires a Supabase pooler port',
    )
    assert.ok(
      databaseSslCaPath,
      'direct database verification requires DATABASE_CONCURRENCY_CA_CERT_PATH',
    )
    databaseSslCa = readFileSync(databaseSslCaPath, 'utf8')
    assert.match(
      databaseSslCa,
      /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/u,
      'the database CA file must contain a PEM certificate',
    )
    verifiedDatabaseConnection = {
      database: 'postgres',
      host: parsedDatabaseUrl.hostname,
      password: decodeURIComponent(parsedDatabaseUrl.password),
      port: databasePort,
      user: parsedDatabaseUrl.username,
    }
  }
}
const databaseTarget = [usesLinkedDatabase ? '--linked' : '--local']
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

async function runQuery(sql: string): Promise<QueryResult> {
  const startedAt = performance.now()
  if (verifiedDatabaseConnection && databaseSslCa) {
    // The direct path is allowed only after the isolated-project ref guards
    // above. Supabase's project CA is required so both the certificate chain
    // and pooler hostname are verified; URL parameters cannot downgrade TLS.
    const client = new Client({
      ...verifiedDatabaseConnection,
      connectionTimeoutMillis: 10_000,
      ssl: {
        ca: databaseSslCa,
        rejectUnauthorized: true,
      },
    })
    try {
      await client.connect()
      const queryResult = await client.query(sql)
      const results = Array.isArray(queryResult) ? queryResult : [queryResult]
      const selected = results.findLast(result => result.rows.length > 0)
        ?? results.at(-1)
      return {
        code: 0,
        stdout: JSON.stringify({ rows: selected?.rows ?? [] }),
        stderr: '',
        durationMs: performance.now() - startedAt,
      }
    }
    catch (error) {
      const databaseError = error as { code?: string, message?: string }
      return {
        code: 1,
        stdout: '',
        stderr: `${databaseError.code ?? 'database_error'}: ${databaseError.message ?? 'query failed'}`,
        durationMs: performance.now() - startedAt,
      }
    }
    finally {
      await client.end().catch(() => undefined)
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      'supabase',
      ['db', 'query', ...databaseTarget, '--output-format', 'json', sql],
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

function describeFailure(result: QueryResult) {
  const output = `${result.stdout}\n${result.stderr}`.trim()
  return {
    code: result.code,
    classification: classify(result),
    output: output.slice(-800),
  }
}

function readBooleanResult(result: QueryResult, field: string) {
  assert.equal(result.code, 0, `database query for ${field} must succeed`)
  const value = readResultField(result, field)
  assert.equal(typeof value, 'boolean', `database query for ${field} must return a boolean`)
  return value
}

function readResultField(result: QueryResult, field: string) {
  assert.equal(result.code, 0, `database query for ${field} must succeed`)
  const payload = JSON.parse(result.stdout) as {
    rows?: Array<Record<string, unknown>>
  }
  assert.ok(payload.rows?.[0], `database query for ${field} must return a row`)
  return payload.rows[0][field]
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

function delay(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
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
    `The selected Supabase database is unavailable for concurrency verification: ${JSON.stringify(describeFailure(connectivity))}`,
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
assert.equal(
  seed.code,
  0,
  `concurrency fixtures must be created: ${JSON.stringify(describeFailure(seed))}`,
)

const versionOutcomes: Array<ReturnType<typeof classify>> = []
const idempotencyOutcomes: Array<ReturnType<typeof classify>> = []
const rateLimitOutcomes: Array<ReturnType<typeof classify>> = []
const versionDurations: number[] = []
const idempotencyDurations: number[] = []
const rateLimitDurations: number[] = []
let maintenanceLockOutcome = 'not_run'

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
        versions.document_revision::integer,
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
    assert.ok(
      pairOutcomes.includes('success'),
      `round ${round + 1} must make progress: ${JSON.stringify({
        sync: describeFailure(syncResult),
        createNext: describeFailure(createResult),
      })}`,
    )
    const pairDiagnostics = JSON.stringify({
      sync: describeFailure(syncResult),
      createNext: describeFailure(createResult),
    })
    assert.ok(
      !pairOutcomes.includes('deadlock'),
      `round ${round + 1} must not deadlock: ${pairDiagnostics}`,
    )
    assert.ok(
      !pairOutcomes.includes('unexpected'),
      `round ${round + 1} returned an unexpected error: ${pairDiagnostics}`,
    )

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
    assert.deepEqual(
      replayOutcomes,
      ['success', 'success'],
      `round ${round + 1} idempotency replay failed: ${JSON.stringify({
        first: describeFailure(firstReplay),
        second: describeFailure(secondReplay),
      })}`,
    )
    assert.deepEqual(
      readResultField(firstReplay, 'result'),
      readResultField(secondReplay, 'result'),
      `round ${round + 1} idempotency replay must return the same business result`,
    )

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
    assert.deepEqual(
      limitOutcomes,
      ['success', 'success'],
      `round ${round + 1} rate limit race failed: ${JSON.stringify({
        first: describeFailure(firstLimit),
        second: describeFailure(secondLimit),
      })}`,
    )
  }

  const maintenanceState = await runQuery(`
    SELECT cleanup_enabled
    FROM private.backend_maintenance_config
    WHERE singleton;
  `)
  const cleanupWasEnabled = readBooleanResult(maintenanceState, 'cleanup_enabled')

  const enableMaintenance = await runQuery(`
    UPDATE private.backend_maintenance_config
    SET cleanup_enabled = true,
        updated_at = pg_catalog.now()
    WHERE singleton;
  `)
  assert.equal(
    enableMaintenance.code,
    0,
    `maintenance lock fixture must be enabled: ${JSON.stringify(describeFailure(enableMaintenance))}`,
  )

  try {
    const lockExpression = `pg_catalog.hashtextextended('resume-backend-transient-cleanup-v1', 0)`
    const lockHolder = runQuery(`
      SELECT pg_catalog.pg_advisory_lock(${lockExpression});
      SELECT pg_catalog.pg_sleep(5);
      SELECT pg_catalog.pg_advisory_unlock(${lockExpression});
    `)
    let lockObserved = false
    for (let attempt = 0; attempt < 20 && !lockObserved; attempt += 1) {
      await delay(250)
      const probe = await runQuery(`
        DO $probe$
        BEGIN
          IF pg_catalog.pg_try_advisory_lock(${lockExpression}) THEN
            PERFORM pg_catalog.pg_advisory_unlock(${lockExpression});
            RAISE EXCEPTION 'maintenance lock is not held';
          END IF;
        END
        $probe$;
      `)
      lockObserved = probe.code === 0
    }
    assert.equal(lockObserved, true, 'maintenance advisory lock must be observed')

    const blockedCleanup = await runQuery(`
      SELECT private.cleanup_backend_transient_data_v1(100) AS result;
    `)
    assert.equal(blockedCleanup.code, 0, 'contending cleanup must return a bounded result')
    assert.match(
      `${blockedCleanup.stdout}\n${blockedCleanup.stderr}`,
      /already_running/iu,
      'contending cleanup must skip instead of running concurrently',
    )
    maintenanceLockOutcome = 'skipped_already_running'
    const holderResult = await lockHolder
    assert.equal(holderResult.code, 0, 'maintenance advisory-lock holder must finish')
  }
  finally {
    const disableMaintenance = await runQuery(`
      UPDATE private.backend_maintenance_config
      SET cleanup_enabled = ${cleanupWasEnabled ? 'true' : 'false'},
          updated_at = pg_catalog.now()
      WHERE singleton;
    `)
    assert.equal(disableMaintenance.code, 0, 'maintenance lock fixture must be disabled')
  }
}
finally {
  const cleanup = await runQuery(`DELETE FROM auth.users WHERE id = '${userId}';`)
  assert.equal(
    cleanup.code,
    0,
    `concurrency fixtures must be removed: ${JSON.stringify(describeFailure(cleanup))}`,
  )
  const cleanupVerification = await runQuery(`
    SELECT NOT EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = '${userId}'
    ) AS cleanup_complete;
  `)
  assert.equal(
    readBooleanResult(cleanupVerification, 'cleanup_complete'),
    true,
    'concurrency fixture cleanup must be verified',
  )
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
  maintenanceCleanup: {
    lockContention: maintenanceLockOutcome,
  },
}

assert.equal(report.versionRace.deadlocks, 0)
assert.equal(report.idempotency.deadlocks, 0)
assert.equal(report.rateLimit.deadlocks, 0)
assert.equal(report.maintenanceCleanup.lockContention, 'skipped_already_running')
console.warn(JSON.stringify(report))
