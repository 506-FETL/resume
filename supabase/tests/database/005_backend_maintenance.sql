BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(32);

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron')
  AND EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_net')
  AND EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'supabase_vault'),
  'maintenance dependencies are enabled without pinned extension versions'
);

SELECT extensions.ok(
  to_regclass('private.backend_maintenance_config') IS NOT NULL
  AND to_regclass('private.backend_maintenance_runs') IS NOT NULL
  AND to_regclass('private.backend_edge_dispatches') IS NOT NULL
  AND to_regclass('private.backend_alert_state') IS NOT NULL
  AND to_regclass('private.ai_usage_daily_rollups') IS NOT NULL,
  'maintenance state and AI rollup tables exist in the private schema'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM private.backend_maintenance_config
    WHERE singleton
      AND NOT cleanup_enabled
      AND NOT edge_jobs_enabled
  ),
  'destructive cleanup and outbound jobs are disabled by default'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    WHERE namespaces.nspname = 'private'
      AND functions.proname IN (
        'preview_backend_transient_cleanup_v1',
        'cleanup_backend_transient_data_v1',
        'run_ai_reconciliation_job_v1',
        'set_backend_maintenance_flags_v1',
        'invoke_backend_edge_job_v1',
        'reconcile_backend_edge_dispatches_v1'
      )
      AND (
        NOT functions.prosecdef
        OR NOT coalesce(functions.proconfig, ARRAY[]::text[])
          @> ARRAY['search_path=""']::text[]
      )
  ),
  'maintenance functions are security definers with an empty search path'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    WHERE namespaces.nspname = 'private'
      AND functions.proname IN (
        'preview_backend_transient_cleanup_v1',
        'cleanup_backend_transient_data_v1',
        'run_ai_reconciliation_job_v1',
        'set_backend_maintenance_flags_v1',
        'invoke_backend_edge_job_v1',
        'reconcile_backend_edge_dispatches_v1'
      )
      AND (
        has_function_privilege('anon', functions.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', functions.oid, 'EXECUTE')
        OR has_function_privilege('service_role', functions.oid, 'EXECUTE')
      )
  ),
  'private maintenance entrypoints cannot be called through API roles'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    JOIN pg_catalog.pg_language AS languages
      ON languages.oid = functions.prolang
    WHERE namespaces.nspname = 'public'
      AND functions.prokind = 'f'
      AND languages.lanname IN ('sql', 'plpgsql')
      AND pg_catalog.pg_get_functiondef(functions.oid)
        ~ 'net\\.http_(get|post|delete)'
  ),
  'public RPC functions cannot invoke arbitrary pg_net HTTP entrypoints'
);

SELECT extensions.ok(
  has_function_privilege(
    'service_role',
    'public.evaluate_backend_ops_alerts_v1(integer)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'service_role',
    'public.ack_backend_alert_delivery_v1(text[])',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.evaluate_backend_ops_alerts_v1(integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.evaluate_backend_ops_alerts_v1(integer)',
    'EXECUTE'
  ),
  'only the Edge service role can evaluate and acknowledge alerts'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*)
    FROM cron.job
    WHERE jobname IN (
      'resume-backend-ai-reconcile',
      'resume-backend-edge-dispatch-reconcile',
      'resume-backend-transient-cleanup',
      'resume-backend-transient-catchup',
      'resume-backend-ops-monitor',
      'resume-github-stars-refresh'
    )
  ) = 6
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-edge-dispatch-reconcile' AND schedule = '* * * * *'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-ai-reconcile' AND schedule = '*/5 * * * *'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-edge-dispatch-reconcile'
      AND command = 'SELECT private.reconcile_backend_edge_dispatches_v1(200);'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-transient-cleanup' AND schedule = '17 * * * *'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-transient-catchup' AND schedule = '42 3 * * *'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-ops-monitor' AND schedule = '*/5 * * * *'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-github-stars-refresh' AND schedule = '11 */6 * * *'
  ),
  'cron contains one copy of every fixed maintenance schedule'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-ai-reconcile'
      AND command = 'SELECT private.run_ai_reconciliation_job_v1(200);'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-transient-cleanup'
      AND command = 'SELECT private.cleanup_backend_transient_data_v1(1000);'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-backend-ops-monitor'
      AND command = 'SELECT private.invoke_backend_edge_job_v1(''backend-ops-monitor'');'
  )
  AND EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'resume-github-stars-refresh'
      AND command = 'SELECT private.invoke_backend_edge_job_v1(''github-stars-refresh'');'
  ),
  'cron commands call only fixed private entrypoints and Edge names'
);

SELECT extensions.ok(
  pg_catalog.pg_get_functiondef(
    'private.cleanup_backend_transient_data_v1(integer)'::regprocedure
  ) LIKE '%FOR UPDATE SKIP LOCKED%'
  AND pg_catalog.pg_get_functiondef(
    'private.cleanup_backend_transient_data_v1(integer)'::regprocedure
  ) LIKE '%requests.state <> ''pending''%'
  AND pg_catalog.pg_get_functiondef(
    'private.cleanup_backend_transient_data_v1(integer)'::regprocedure
  ) NOT ILIKE '%TRUNCATE%'
  AND pg_catalog.pg_get_functiondef(
    'private.cleanup_backend_transient_data_v1(integer)'::regprocedure
  ) NOT ILIKE '%VACUUM FULL%',
  'cleanup is bounded and never deletes pending AI requests directly'
);

SELECT extensions.ok(
  to_regclass('public.resume_comment_collaboration_sessions') IS NOT NULL
  AND to_regclass('public.resume_comment_collaboration_members') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attributes
    JOIN pg_catalog.pg_class AS tables ON tables.oid = attributes.attrelid
    JOIN pg_catalog.pg_namespace AS namespaces ON namespaces.oid = tables.relnamespace
    JOIN pg_catalog.pg_attrdef AS defaults
      ON defaults.adrelid = tables.oid
     AND defaults.adnum = attributes.attnum
    WHERE namespaces.nspname = 'public'
      AND tables.relname = 'resume_comment_collaboration_sessions'
      AND attributes.attname = 'default_role'
      AND pg_catalog.pg_get_expr(defaults.adbin, defaults.adrelid) = '''editor''::text'
  ),
  'realtime collaboration remains available and new links default to editor'
);

SELECT extensions.is(
  private.cleanup_backend_transient_data_v1(100) ->> 'outcome',
  'skipped',
  'cleanup performs no deletion before the guarded rollout flag is enabled'
);

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'ops_monitor_dispatch', 'queued', '{"requestId":900000000001}'::jsonb,
    pg_catalog.now(), pg_catalog.now(), 0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000001, run.id, 'backend-ops-monitor', pg_catalog.now()
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'ops_monitor_dispatch', 'queued', '{"requestId":900000000002}'::jsonb,
    pg_catalog.now(), pg_catalog.now(), 0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000002, run.id, 'backend-ops-monitor', pg_catalog.now()
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'github_refresh_dispatch', 'queued', '{"requestId":900000000003}'::jsonb,
    pg_catalog.now(), pg_catalog.now(), 0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000003, run.id, 'github-stars-refresh', pg_catalog.now()
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'github_refresh_dispatch', 'queued', '{"requestId":900000000004}'::jsonb,
    pg_catalog.now() - interval '3 minutes',
    pg_catalog.now() - interval '3 minutes',
    0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000004, run.id, 'github-stars-refresh', pg_catalog.now() - interval '3 minutes'
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'github_refresh_dispatch', 'queued', '{"requestId":900000000005}'::jsonb,
    pg_catalog.now() - interval '3 minutes',
    pg_catalog.now() - interval '3 minutes',
    0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000005, run.id, 'github-stars-refresh', pg_catalog.now() - interval '3 minutes'
FROM run;

INSERT INTO net.http_request_queue (
  id, method, url, headers, body, timeout_milliseconds
) VALUES (
  900000000005,
  'POST',
  'https://example.invalid/functions/v1/github-stars-refresh',
  '{}'::jsonb,
  pg_catalog.convert_to('{}', 'UTF8'),
  10000
);

INSERT INTO net._http_response (
  id, status_code, content_type, headers, content, timed_out, error_msg
) VALUES
  (900000000001, 204, 'application/json', '{}'::jsonb, '', false, NULL),
  (900000000002, 401, 'application/json', '{}'::jsonb, '', false, NULL),
  (900000000003, NULL, NULL, '{}'::jsonb, NULL, true, 'Timeout was reached');

SELECT extensions.is(
  private.reconcile_backend_edge_dispatches_v1(20) ->> 'processed',
  '4',
  'edge dispatch reconciliation consumes success, HTTP error, timeout and missing responses'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches AS dispatches
    JOIN private.backend_maintenance_runs AS runs
      ON runs.id = dispatches.maintenance_run_id
    WHERE dispatches.request_id = 900000000001
      AND dispatches.state = 'succeeded'
      AND dispatches.status_code = 204
      AND runs.outcome = 'success'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches AS dispatches
    JOIN private.backend_maintenance_runs AS runs
      ON runs.id = dispatches.maintenance_run_id
    WHERE dispatches.request_id = 900000000002
      AND dispatches.state = 'failed'
      AND dispatches.status_code = 401
      AND dispatches.error_code = 'edge_http_status'
      AND runs.outcome = 'failed'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches
    WHERE request_id = 900000000003
      AND state = 'failed'
      AND error_code = 'edge_response_timeout'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches
    WHERE request_id = 900000000004
      AND state = 'failed'
      AND error_code = 'edge_response_missing'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches
    WHERE request_id = 900000000005
      AND state = 'queued'
      AND completed_at IS NULL
  ),
  'edge dispatch outcomes wait for responses and never finalize a request still in the pg_net queue'
);

INSERT INTO private.backend_error_events (
  request_id,
  function_name,
  operation,
  error_code,
  status,
  duration_ms,
  created_at
)
SELECT
  gen_random_uuid(),
  'maintenance-test',
  'cleanup',
  'maintenance_test_old',
  500,
  1,
  pg_catalog.now() - interval '8 days' - (series.value * interval '1 second')
FROM pg_catalog.generate_series(1, 101) AS series(value);

INSERT INTO private.backend_error_events (
  request_id,
  function_name,
  operation,
  error_code,
  status,
  duration_ms,
  created_at
) VALUES (
  gen_random_uuid(),
  'maintenance-test',
  'cleanup',
  'maintenance_test_live',
  500,
  1,
  pg_catalog.now()
);

INSERT INTO auth.users (id, email)
VALUES ('70000000-0000-4000-8000-000000000001', 'maintenance@example.invalid');

INSERT INTO auth.users (id, email)
SELECT
  ('72000000-0000-4000-8001-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
  'maintenance-member-' || series.value::text || '@example.invalid'
FROM pg_catalog.generate_series(1, 101) AS series(value);

INSERT INTO public.resume_config (
  resume_id, user_id, display_name, basics, "order"
) VALUES (
  '73000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'maintenance-collaboration',
  '{"name":"maintenance"}'::jsonb,
  '["basics"]'::jsonb
);

INSERT INTO public.resume_comment_scopes (
  id,
  kind,
  owner_user_id,
  resume_id,
  anchor_document,
  document_hash,
  projection_reference_date
) VALUES (
  '74000000-0000-4000-8000-000000000001',
  'working',
  '70000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  '{"nodes":[]}'::jsonb,
  pg_catalog.repeat('0', 64),
  (pg_catalog.timezone('UTC', pg_catalog.now()))::date
);

INSERT INTO public.resume_comment_collaboration_sessions (
  session_id,
  resume_id,
  scope_id,
  owner_user_id,
  default_role,
  expires_at,
  created_at,
  updated_at
) VALUES
  (
    'maintenance-active-session',
    '73000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'editor',
    pg_catalog.now() + interval '1 day',
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    'maintenance-expired-many',
    '73000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'editor',
    pg_catalog.now() - interval '2 days',
    pg_catalog.now() - interval '4 days',
    pg_catalog.now() - interval '2 days'
  ),
  (
    'maintenance-expired-empty',
    '73000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'editor',
    pg_catalog.now() - interval '2 days',
    pg_catalog.now() - interval '4 days',
    pg_catalog.now() - interval '2 days'
  );

INSERT INTO public.resume_comment_collaboration_members (
  session_id, user_id, role, expires_at, created_at, last_seen_at
) VALUES (
  'maintenance-active-session',
  '70000000-0000-4000-8000-000000000001',
  'editor',
  pg_catalog.now() + interval '1 day',
  pg_catalog.now(),
  pg_catalog.now()
);

INSERT INTO public.resume_comment_collaboration_members (
  session_id, user_id, role, expires_at, created_at, last_seen_at
)
SELECT
  'maintenance-expired-many',
  ('72000000-0000-4000-8001-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
  'editor',
  pg_catalog.now() - interval '2 days',
  pg_catalog.now() - interval '4 days',
  pg_catalog.now() - interval '2 days'
FROM pg_catalog.generate_series(1, 101) AS series(value);

INSERT INTO public.resume_comment_rate_limits (
  bucket_key,
  window_started_at,
  window_seconds,
  attempt_count,
  blocked_until,
  updated_at
) VALUES
  (
    'maintenance-expired-rate-limit',
    pg_catalog.now() - interval '3 days',
    60,
    1,
    NULL,
    pg_catalog.now() - interval '3 days'
  ),
  (
    'maintenance-blocked-rate-limit',
    pg_catalog.now() - interval '3 days',
    60,
    1,
    pg_catalog.now() + interval '1 day',
    pg_catalog.now() - interval '3 days'
  ),
  (
    'maintenance-boundary-rate-limit',
    pg_catalog.now() - interval '3 days',
    60,
    1,
    NULL,
    pg_catalog.now() - interval '47 hours'
  );

INSERT INTO public.ai_credit_requests (
  request_id,
  user_id,
  quota_date,
  action,
  reserved_cost,
  quota_debited,
  state,
  delivery_state,
  reserved_at,
  finalized_at,
  expires_at,
  failure_code
) VALUES
  (
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    (pg_catalog.timezone('UTC', pg_catalog.now()))::date - 200,
    'chat',
    1,
    0,
    'pending',
    'none',
    pg_catalog.now() - interval '200 days',
    NULL,
    pg_catalog.now() - interval '199 days',
    NULL
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000001',
    (pg_catalog.timezone('UTC', pg_catalog.now()))::date - 200,
    'chat',
    1,
    0,
    'released',
    'none',
    pg_catalog.now() - interval '200 days',
    pg_catalog.now() - interval '181 days',
    pg_catalog.now() - interval '199 days',
    'maintenance_test'
  );

UPDATE private.backend_maintenance_config
SET cleanup_enabled = true,
    updated_at = pg_catalog.now()
WHERE singleton;

CREATE TEMP TABLE maintenance_test_results (
  phase text PRIMARY KEY,
  result jsonb NOT NULL
);

INSERT INTO maintenance_test_results (phase, result)
VALUES ('first', private.cleanup_backend_transient_data_v1(100));

SELECT extensions.is(
  (SELECT result ->> 'outcome' FROM maintenance_test_results WHERE phase = 'first'),
  'success',
  'enabled cleanup completes successfully'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM private.backend_error_events
    WHERE error_code = 'maintenance_test_old'
  ),
  1,
  'one cleanup pass deletes no more than its per-table batch limit'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM private.backend_error_events
    WHERE error_code = 'maintenance_test_live'
  ),
  1,
  'cleanup preserves events inside their retention period'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.resume_comment_collaboration_sessions
    WHERE session_id = 'maintenance-active-session'
      AND default_role = 'editor'
  )
  AND EXISTS (
    SELECT 1
    FROM public.resume_comment_collaboration_members
    WHERE session_id = 'maintenance-active-session'
      AND user_id = '70000000-0000-4000-8000-000000000001'
      AND role = 'editor'
  ),
  'cleanup preserves a valid realtime collaboration session and editor member'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.resume_comment_collaboration_sessions
    WHERE session_id = 'maintenance-expired-many'
  )
  AND (
    SELECT pg_catalog.count(*)
    FROM public.resume_comment_collaboration_members
    WHERE session_id = 'maintenance-expired-many'
  ) = 1,
  'cleanup removes expired collaboration members before the session and respects the batch limit'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM public.resume_comment_collaboration_sessions
    WHERE session_id = 'maintenance-expired-empty'
  ),
  0,
  'cleanup removes an expired collaboration session only after it has no members'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.resume_comment_rate_limits
    WHERE bucket_key = 'maintenance-expired-rate-limit'
  )
  AND EXISTS (
    SELECT 1 FROM public.resume_comment_rate_limits
    WHERE bucket_key = 'maintenance-blocked-rate-limit'
      AND blocked_until > pg_catalog.now()
  )
  AND EXISTS (
    SELECT 1 FROM public.resume_comment_rate_limits
    WHERE bucket_key = 'maintenance-boundary-rate-limit'
  ),
  'cleanup removes only expired unblocked rate-limit buckets and preserves live boundaries'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM public.ai_credit_requests
    WHERE request_id = '71000000-0000-4000-8000-000000000001'
      AND state = 'pending'
  ),
  1,
  'cleanup preserves pending AI ledger rows even when they are expired'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM public.ai_credit_requests
    WHERE request_id = '71000000-0000-4000-8000-000000000002'
  ),
  0,
  'cleanup removes finalized AI ledger rows after the audit period'
);

SELECT extensions.is(
  (
    SELECT request_count::integer
    FROM private.ai_usage_daily_rollups
    WHERE action = 'chat'
      AND final_state = 'released'
      AND quota_date = (pg_catalog.timezone('UTC', pg_catalog.now()))::date - 200
  ),
  1,
  'finalized AI usage is rolled up before detailed ledger deletion'
);

SELECT extensions.is(
  (
    SELECT (result -> 'counts' ->> 'backendErrorEvents')::integer
    FROM maintenance_test_results
    WHERE phase = 'first'
  ),
  100,
  'cleanup response reports a sanitized per-table deletion count'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM private.backend_maintenance_runs
    WHERE job_name = 'transient_cleanup'
      AND outcome = 'success'
      AND processed_count = 203
      AND details ->> 'backendErrorEvents' = '100'
      AND details ->> 'collaborationMembers' = '100'
      AND details ->> 'collaborationSessions' = '1'
  ),
  'maintenance history persists sanitized counts and duration metadata'
);

INSERT INTO maintenance_test_results (phase, result)
VALUES ('second', private.cleanup_backend_transient_data_v1(100));

SELECT extensions.is(
  (SELECT result ->> 'outcome' FROM maintenance_test_results WHERE phase = 'second'),
  'success',
  'a repeated cleanup pass is safe and completes'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM private.backend_error_events
    WHERE error_code = 'maintenance_test_old'
  ),
  0,
  'repeated bounded passes eventually clear all expired rows'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM private.backend_error_events
    WHERE error_code = 'maintenance_test_live'
  ),
  1,
  'repeated cleanup still preserves live rows'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.resume_comment_collaboration_sessions
    WHERE session_id = 'maintenance-expired-many'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.resume_comment_collaboration_members
    WHERE session_id = 'maintenance-expired-many'
  )
  AND EXISTS (
    SELECT 1
    FROM public.resume_comment_collaboration_sessions
    WHERE session_id = 'maintenance-active-session'
  ),
  'repeated cleanup converges expired collaboration leases without touching the live link'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    WHERE functions.oid = 'private.cleanup_backend_transient_data_v1(integer)'::regprocedure
      AND functions.proconfig @> ARRAY['lock_timeout=2s']::text[]
      AND functions.proconfig @> ARRAY['statement_timeout=30s']::text[]
  ),
  'cleanup has bounded lock and statement timeouts'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ai_credit_requests_finalized_cleanup_idx'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'resume_comment_collaboration_sessions_expiry_idx'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'private'
      AND indexname = 'backend_maintenance_runs_job_created_idx'
  ),
  'cleanup and alert predicates have supporting indexes'
);

SELECT * FROM extensions.finish();

ROLLBACK;
