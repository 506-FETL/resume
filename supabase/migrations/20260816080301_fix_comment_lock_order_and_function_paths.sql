-- Retire obsolete high-privilege entrypoints. None of these functions has a
-- current repository caller or trigger dependency; failing without CASCADE is
-- intentional if production drift introduced a dependency.
DROP FUNCTION IF EXISTS public.check_ai_quota(uuid, integer);
DROP FUNCTION IF EXISTS public.consume_ai_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.decrement_template_likes(uuid);
DROP FUNCTION IF EXISTS public.get_resume_template(uuid);
DROP FUNCTION IF EXISTS public.has_liked_template(uuid, uuid);
DROP FUNCTION IF EXISTS public.increment_template_likes(uuid);
DROP FUNCTION IF EXISTS public.increment_template_usage(uuid);
DROP FUNCTION IF EXISTS public.switch_resume_template(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.sync_template_to_resume_config();
DROP FUNCTION IF EXISTS public.update_template_custom_config(uuid, jsonb);
DROP FUNCTION IF EXISTS public.handle_template_like();
DROP FUNCTION IF EXISTS public.assign_collaborator_color();
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
DROP FUNCTION IF EXISTS public.sync_change_count();

-- The only cross-account boundary is an immutable share release plus its
-- signed comment scope. Revoke every existing collaboration lease before the
-- Edge path is removed so a previously issued token cannot remain usable.
UPDATE public.resume_comment_collaboration_members
SET revoked_at = coalesce(revoked_at, pg_catalog.now())
WHERE revoked_at IS NULL;

UPDATE public.resume_comment_collaboration_sessions
SET revoked_at = coalesce(revoked_at, pg_catalog.now()),
    updated_at = pg_catalog.now()
WHERE revoked_at IS NULL;

ALTER FUNCTION private.resolve_resume_comment_bootstrap_access_v1(
  text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text
) RENAME TO resolve_resume_comment_bootstrap_access_with_collaborator_v1;

CREATE OR REPLACE FUNCTION private.resolve_resume_comment_bootstrap_access_v1(
  p_access_kind text,
  p_user_id uuid,
  p_scope_id uuid,
  p_resume_id uuid,
  p_version_id bigint,
  p_share_id uuid,
  p_release_id uuid,
  p_password_generation text,
  p_session_id text,
  p_collaborator_role text,
  p_anonymous_id uuid,
  p_anonymous_secret_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_access_kind = 'collaborator'
     OR p_session_id IS NOT NULL
     OR p_collaborator_role IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  RETURN private.resolve_resume_comment_bootstrap_access_with_collaborator_v1(
    p_access_kind,
    p_user_id,
    p_scope_id,
    p_resume_id,
    p_version_id,
    p_share_id,
    p_release_id,
    p_password_generation,
    NULL,
    NULL,
    p_anonymous_id,
    p_anonymous_secret_hash
  );
END;
$$;

-- Idempotency is the first logical lock for comment writes. The advisory lock
-- serializes duplicate actor/request pairs before any scope/thread row lock.
ALTER FUNCTION public.execute_resume_version_comment_write(
  text, uuid, text, uuid, text, uuid, jsonb
) RENAME TO execute_resume_version_comment_write_pre_request_lock_v1;

CREATE OR REPLACE FUNCTION public.execute_resume_version_comment_write(
  p_op text,
  p_scope_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_actor_key text,
  p_request_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF p_request_id IS NULL OR pg_catalog.length(p_actor_key) NOT BETWEEN 3 AND 256 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid request identity';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'resume-comment-request:' || p_actor_key || ':' || p_request_id::text,
      0
    )
  );

  RETURN public.execute_resume_version_comment_write_pre_request_lock_v1(
    p_op,
    p_scope_id,
    p_actor_kind,
    p_actor_id,
    p_actor_key,
    p_request_id,
    p_payload
  );
END;
$$;

ALTER FUNCTION public.mark_resume_comment_thread_read_v1(
  uuid, uuid, text, uuid, text, uuid, bigint
) RENAME TO mark_resume_comment_thread_read_pre_request_lock_v1;

CREATE OR REPLACE FUNCTION public.mark_resume_comment_thread_read_v1(
  p_scope_id uuid,
  p_thread_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_actor_key text,
  p_request_id uuid,
  p_event_seq bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF p_request_id IS NULL OR pg_catalog.length(p_actor_key) NOT BETWEEN 3 AND 256 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid request identity';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'resume-comment-request:' || p_actor_key || ':' || p_request_id::text,
      0
    )
  );

  RETURN public.mark_resume_comment_thread_read_pre_request_lock_v1(
    p_scope_id,
    p_thread_id,
    p_actor_kind,
    p_actor_id,
    p_actor_key,
    p_request_id,
    p_event_seq
  );
END;
$$;

-- Both create-next-version and document sync now acquire root -> version ->
-- scope. The legacy implementation can re-enter version/scope locks safely
-- because this wrapper already owns them in the canonical order.
ALTER FUNCTION public.sync_resume_version_comment_document_v3(
  uuid, bigint, uuid, jsonb, jsonb, text, integer, date, jsonb, text, uuid
) RENAME TO sync_resume_version_comment_document_pre_lock_order_v1;

CREATE OR REPLACE FUNCTION public.sync_resume_version_comment_document_v3(
  p_scope_id uuid,
  p_version_id bigint,
  p_owner_user_id uuid,
  p_snapshot jsonb,
  p_anchor_document jsonb,
  p_document_hash text,
  p_expected_document_revision integer,
  p_projection_reference_date date,
  p_relocations jsonb,
  p_actor_key text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
DECLARE
  v_resume_id uuid;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF p_request_id IS NULL OR pg_catalog.length(p_actor_key) NOT BETWEEN 3 AND 256 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid request identity';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'resume-comment-request:' || p_actor_key || ':' || p_request_id::text,
      0
    )
  );

  SELECT versions.resume_id
  INTO v_resume_id
  FROM public.resume_config_versions AS versions
  WHERE versions.id = p_version_id
    AND versions.user_id = p_owner_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  PERFORM 1
  FROM public.resume_config AS configs
  WHERE configs.resume_id = v_resume_id
    AND configs.user_id = p_owner_user_id
    AND configs.current_version_id = p_version_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  PERFORM 1
  FROM public.resume_config_versions AS versions
  WHERE versions.id = p_version_id
    AND versions.resume_id = v_resume_id
    AND versions.user_id = p_owner_user_id
    AND versions.status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  PERFORM 1
  FROM public.resume_comment_scopes AS scopes
  WHERE scopes.id = p_scope_id
    AND scopes.kind = 'version'
    AND scopes.resume_id = v_resume_id
    AND scopes.version_id = p_version_id
    AND scopes.owner_user_id = p_owner_user_id
    AND scopes.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  RETURN public.sync_resume_version_comment_document_pre_lock_order_v1(
    p_scope_id,
    p_version_id,
    p_owner_user_id,
    p_snapshot,
    p_anchor_document,
    p_document_hash,
    p_expected_document_revision,
    p_projection_reference_date,
    p_relocations,
    p_actor_key,
    p_request_id
  );
END;
$$;

ALTER FUNCTION public.create_next_resume_version(uuid, text)
  SET lock_timeout = '3s';

-- Function-path and ACL policy is deny-by-default. Internal/trigger helpers are
-- callable only by their owner; browser and service RPCs are granted below.
DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT
      namespaces.nspname AS schema_name,
      functions.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(functions.oid) AS arguments
    FROM pg_catalog.pg_proc AS functions
    JOIN pg_catalog.pg_namespace AS namespaces
      ON namespaces.oid = functions.pronamespace
    JOIN pg_catalog.pg_language AS languages
      ON languages.oid = functions.prolang
    WHERE namespaces.nspname IN ('public', 'private')
      AND languages.lanname IN ('sql', 'plpgsql')
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = ''''',
      v_function.schema_name,
      v_function.function_name,
      v_function.arguments
    );
    EXECUTE pg_catalog.format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
      v_function.schema_name,
      v_function.function_name,
      v_function.arguments
    );
  END LOOP;
END;
$$;

-- Browser-facing owner APIs.
GRANT EXECUTE ON FUNCTION public.ai_message_visible_text(jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_ai_conversations(text, integer, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_quota()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_next_resume_version(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_resume_share_release(
  uuid, bigint, jsonb, jsonb, text, text, bigint, integer, text,
  timestamptz, jsonb, text, date, bigint
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_resume_share(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_resume_share_permanently(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_resume_history_version_with_comments(bigint, uuid)
  TO authenticated, service_role;

-- Temporary read-only GitHub cache API; task 9 replaces this signature.
GRANT EXECUTE ON FUNCTION public.get_github_stars(text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_github_stars(text, text, integer)
  TO service_role;

-- Edge/service-only APIs.
GRANT EXECUTE ON FUNCTION public.append_resume_comment_event(uuid, uuid, text, text, uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_resume_comment_anchor(uuid, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_resume_comment_service_role()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.bootstrap_resume_comments_v1(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_resume_comment_rate_limit(text, text, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_resume_comment_request(text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_resume_share_password_attempts(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_resume_comment_rate_limit_bucket(text, integer, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_resume_share_owner_write(uuid, integer, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_resume_share_password_attempt(uuid, text, integer, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_resume_comment_anonymous_identity_v2(uuid, bigint, uuid, text, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_resume_version_comment_scope(uuid, bigint, jsonb, text, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_resume_version_comment_scope(uuid, bigint, jsonb, text, date, bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_resume_version_comment_write(text, uuid, text, uuid, text, uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_resume_comment_thread_read_v1(uuid, uuid, text, uuid, text, uuid, bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.next_resume_comment_event_seq(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_resume_share_view(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_resume_version_comment_document_v3(
  uuid, bigint, uuid, jsonb, jsonb, text, integer, date, jsonb, text, uuid
) TO service_role;

GRANT EXECUTE ON FUNCTION public.reserve_ai_credits(uuid, uuid, integer, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_ai_request_delivery_started(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_ai_credit_request(uuid, uuid, text, integer, integer, integer, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_credit_request(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_ai_credit_requests(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_backend_operation(uuid, text, text, text, text, text, integer, integer)
  TO service_role;
