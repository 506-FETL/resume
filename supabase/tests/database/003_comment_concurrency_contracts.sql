BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(10);

SELECT extensions.ok(
  position(
    'pg_advisory_xact_lock' IN pg_catalog.pg_get_functiondef(
      'public.sync_resume_version_comment_document_v3(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)'::regprocedure
    )
  ) < position(
    'FROM public.resume_config AS configs' IN pg_catalog.pg_get_functiondef(
      'public.sync_resume_version_comment_document_v3(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)'::regprocedure
    )
  ),
  'document sync takes the request advisory lock before resource rows'
);

SELECT extensions.ok(
  position(
    'FROM public.resume_config AS configs' IN pg_catalog.pg_get_functiondef(
      'public.sync_resume_version_comment_document_v3(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)'::regprocedure
    )
  ) < position(
    'FROM public.resume_config_versions AS versions' IN pg_catalog.pg_get_functiondef(
      'public.sync_resume_version_comment_document_v3(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)'::regprocedure
    )
  )
  AND position(
    'FROM public.resume_config_versions AS versions' IN pg_catalog.pg_get_functiondef(
      'public.sync_resume_version_comment_document_v3(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)'::regprocedure
    )
  ) < position(
    'FROM public.resume_comment_scopes AS scopes' IN pg_catalog.pg_get_functiondef(
      'public.sync_resume_version_comment_document_v3(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)'::regprocedure
    )
  ),
  'document sync locks root then version then scope'
);

SELECT extensions.ok(
  position(
    'FROM public.resume_config' IN pg_catalog.pg_get_functiondef(
      'public.create_next_resume_version(uuid,text)'::regprocedure
    )
  ) < position(
    'FROM public.resume_config_versions' IN pg_catalog.pg_get_functiondef(
      'public.create_next_resume_version(uuid,text)'::regprocedure
    )
  )
  AND position(
    'FROM public.resume_config_versions' IN pg_catalog.pg_get_functiondef(
      'public.create_next_resume_version(uuid,text)'::regprocedure
    )
  ) < position(
    'FROM public.resume_comment_scopes' IN pg_catalog.pg_get_functiondef(
      'public.create_next_resume_version(uuid,text)'::regprocedure
    )
  ),
  'create-next-version uses the same root version scope order'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    WHERE functions.oid = 'public.sync_resume_version_comment_document_v3(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)'::regprocedure
      AND functions.proconfig @> ARRAY['lock_timeout=3s']::text[]
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS functions
    WHERE functions.oid = 'public.create_next_resume_version(uuid,text)'::regprocedure
      AND functions.proconfig @> ARRAY['lock_timeout=3s']::text[]
  ),
  'conflicting version operations have a bounded lock timeout'
);

SELECT extensions.ok(
  pg_catalog.pg_get_functiondef(
    'public.execute_resume_version_comment_write(text,uuid,text,uuid,text,uuid,jsonb)'::regprocedure
  ) LIKE '%pg_advisory_xact_lock%',
  'comment mutation locks its idempotency identity first'
);

SELECT extensions.ok(
  pg_catalog.pg_get_functiondef(
    'public.mark_resume_comment_thread_read_v1(uuid,uuid,text,uuid,text,uuid,bigint)'::regprocedure
  ) LIKE '%pg_advisory_xact_lock%',
  'thread read mutation locks its idempotency identity first'
);

SELECT extensions.ok(
  pg_catalog.pg_get_functiondef(
    'private.resolve_resume_comment_bootstrap_access_v1(text,uuid,uuid,uuid,bigint,uuid,uuid,text,text,text,uuid,text)'::regprocedure
  ) LIKE '%p_access_kind = ''collaborator''%',
  'collaborator bootstrap remains available behind the Edge boundary'
);

SELECT extensions.ok(
  to_regclass('public.resume_comment_collaboration_sessions') IS NOT NULL
  AND to_regclass('public.resume_comment_collaboration_members') IS NOT NULL,
  'realtime collaboration lease tables remain available'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'service_role',
    'public.sync_resume_version_comment_document_pre_lock_order_v1(uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'service_role',
    'public.execute_resume_version_comment_write_pre_request_lock_v1(text,uuid,text,uuid,text,uuid,jsonb)',
    'EXECUTE'
  ),
  'service role cannot bypass the canonical wrappers'
);

SELECT extensions.ok(
  to_regprocedure('public.check_ai_quota(uuid,integer)') IS NULL
  AND to_regprocedure('public.consume_ai_credits(uuid,integer,text)') IS NULL
  AND to_regprocedure('public.switch_resume_template(uuid,uuid,jsonb)') IS NULL
  AND to_regprocedure('public.cleanup_expired_sessions()') IS NULL,
  'obsolete privileged functions are absent'
);

SELECT * FROM extensions.finish();

ROLLBACK;
