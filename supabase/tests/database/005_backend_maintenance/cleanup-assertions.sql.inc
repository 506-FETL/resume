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
