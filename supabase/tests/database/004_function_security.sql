BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(10);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    JOIN pg_catalog.pg_language AS languages
      ON languages.oid = functions.prolang
    WHERE namespaces.nspname IN ('public', 'private')
      AND languages.lanname IN ('sql', 'plpgsql')
      AND NOT coalesce(functions.proconfig, ARRAY[]::text[])
        @> ARRAY['search_path=""']::text[]
  ),
  'all application SQL functions pin an empty search path'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      coalesce(
        functions.proacl,
        pg_catalog.acldefault('f', functions.proowner)
      )
    ) AS grants
    WHERE namespaces.nspname IN ('public', 'private')
      AND functions.prosecdef
      AND grants.grantee = 0
      AND grants.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute any application security-definer function'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    WHERE namespaces.nspname IN ('public', 'private')
      AND functions.prosecdef
      AND has_function_privilege('anon', functions.oid, 'EXECUTE')
      AND functions.oid <> 'public.get_github_stars(text,text)'::regprocedure
  ),
  'anon security-definer execution is limited to the temporary read-only stars API'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    WHERE namespaces.nspname = 'private'
      AND (
        has_function_privilege('anon', functions.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', functions.oid, 'EXECUTE')
        OR has_function_privilege('service_role', functions.oid, 'EXECUTE')
      )
  ),
  'private functions have no direct client or service execution grant'
);

SELECT extensions.ok(
  NOT has_schema_privilege('anon', 'private', 'USAGE')
  AND NOT has_schema_privilege('authenticated', 'private', 'USAGE')
  AND NOT has_schema_privilege('service_role', 'private', 'USAGE'),
  'private schema remains owner-internal'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM (VALUES
      ('resume_shares'),
      ('resume_share_releases'),
      ('resume_comment_scopes'),
      ('resume_comment_threads'),
      ('resume_comments'),
      ('resume_comment_events'),
      ('resume_comment_requests'),
      ('resume_comment_collaboration_sessions'),
      ('resume_comment_collaboration_members')
    ) AS protected(table_name)
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS client(role_name)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS operation(privilege_name)
    WHERE has_table_privilege(
      client.role_name,
      pg_catalog.format('public.%I', protected.table_name),
      operation.privilege_name
    )
  ),
  'share and comment tables are reachable only through Edge service code'
);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.ai_credit_requests', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.ai_credit_requests', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.ai_quota_daily_usage', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.ai_quota_daily_usage', 'SELECT'),
  'AI ledger tables are not client-readable'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'authenticated',
    'public.reserve_ai_credits(uuid,uuid,integer,text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.record_backend_operation(uuid,text,text,text,text,text,integer,integer)',
    'EXECUTE'
  ),
  'browser clients cannot mutate AI or observability ledgers'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('SELECT', 'ALL')
      AND coalesce(qual, '') = 'true'
      AND tablename IN (
        'resume_config',
        'resume_config_versions',
        'ats',
        'automerge_documents',
        'company',
        'resume_templates'
      )
  ),
  'owner base tables have no unconditional read policy'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_default_acl AS defaults
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = defaults.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(defaults.defaclacl) AS grants
    WHERE namespaces.nspname = 'public'
      AND defaults.defaclobjtype = 'f'
      AND grants.grantee IN (
        0,
        'anon'::regrole::oid,
        'authenticated'::regrole::oid
      )
      AND grants.privilege_type = 'EXECUTE'
  ),
  'new public functions do not inherit browser execute grants'
);

SELECT * FROM extensions.finish();

ROLLBACK;
