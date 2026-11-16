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

