BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(8);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM (VALUES
      ('resume_config'),
      ('resume_config_versions'),
      ('ats'),
      ('automerge_documents'),
      ('company'),
      ('resume_templates')
    ) AS target(table_name)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS operation(privilege_name)
    WHERE has_table_privilege(
      'anon',
      pg_catalog.format('public.%I', target.table_name),
      operation.privilege_name
    )
  ),
  'anon has no direct DML privilege on owner-only base tables'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'resume_config',
        'resume_config_versions',
        'ats',
        'automerge_documents',
        'company',
        'resume_templates'
      ])
      AND roles <> ARRAY['authenticated']::name[]
  ),
  'base table policies apply only to authenticated users'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'resume_config',
        'resume_config_versions',
        'ats',
        'automerge_documents',
        'company',
        'resume_templates'
      ])
      AND cmd IN ('SELECT', 'ALL')
      AND coalesce(qual, '') = 'true'
  ),
  'base tables have no unconditional read policy'
);

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'rls-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'rls-b@example.invalid');

INSERT INTO public.resume_config (resume_id, user_id, display_name)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'B');

INSERT INTO public.resume_templates (
  template_id,
  user_id,
  family_id,
  name,
  visibility,
  status,
  manifest
)
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'rls-a',
    'A template',
    'private',
    'active',
    '{}'::jsonb
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'rls-b',
    'B template',
    'private',
    'active',
    '{}'::jsonb
  );

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

SELECT extensions.is(
  (SELECT count(*) FROM public.resume_config),
  1::bigint,
  'user A sees only the owned resume'
);

SELECT extensions.is(
  (SELECT count(*) FROM public.resume_templates),
  1::bigint,
  'templates remain owner-only regardless of legacy publication state'
);

SELECT extensions.throws_ok(
  $$
    INSERT INTO public.resume_config (resume_id, user_id, display_name)
    VALUES (
      '20000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000002',
      'forged owner'
    )
  $$,
  'new row violates row-level security policy for table "resume_config"',
  'user A cannot insert a resume for user B'
);

SELECT extensions.throws_ok(
  $$
    INSERT INTO public.ats (resume_id, user_id)
    VALUES (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  'new row violates row-level security policy for table "ats"',
  'user A cannot attach a child row to user B resume'
);

RESET ROLE;

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.resume_shares', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.resume_share_releases', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.resume_comments', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.resume_comment_threads', 'SELECT'),
  'anonymous share access is available only through Edge Functions'
);

SELECT * FROM extensions.finish();

ROLLBACK;
