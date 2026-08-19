-- Root cause of the comment/save latency + millions of Postgres errors:
--
-- PostgREST (v13) runs every RPC inside hasql-transaction's *retryable* transaction.
-- On SQLSTATE 40001 (serialization_failure) it rolls back and RE-RUNS the whole
-- transaction. That retry only makes sense for genuinely transient conflicts.
--
-- The comment write and document-sync RPCs, however, raise *deterministic* business
-- conflicts with 40001:
--   * execute_resume_version_comment_write  -> 'stale_revision'  (thread.revision mismatch)
--   * sync_resume_version_comment_document_v3 -> 'stale_document' (document_revision mismatch)
-- These conditions never clear on retry (the revision/hash is still stale), so PostgREST
-- retries in a tight loop, emitting the same 40001 over and over. This is what produced
-- the ~3M identical `40001 stale_revision/stale_document` Postgres errors at a single
-- instant and made solve / reopen / relink / save hang for seconds.
--
-- Fix: at the canonical outermost wrappers, translate these deterministic 40001 conflicts
-- into non-retryable P0409. Genuine transient serialization failures (real row contention,
-- 'request_in_progress') keep their 40001 code and remain retryable. Client-facing behavior
-- is unchanged: the Edge maps `stale_document` / `stale_revision` by message text, so the
-- same error code and HTTP 409 are returned — only the pathological retry loop is removed.
--
-- The wrappers below are byte-for-byte the current canonical bodies (advisory request lock,
-- root -> version -> scope lock order, 3s lock_timeout) with the inner call wrapped in a
-- serialization_failure handler. CREATE OR REPLACE preserves ownership and the existing
-- service_role-only grants.

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

  BEGIN
    RETURN public.execute_resume_version_comment_write_pre_request_lock_v1(
      p_op,
      p_scope_id,
      p_actor_kind,
      p_actor_id,
      p_actor_key,
      p_request_id,
      p_payload
    );
  EXCEPTION
    WHEN serialization_failure THEN
      -- Deterministic revision conflicts must not trigger PostgREST's transaction retry.
      IF SQLERRM IN ('stale_revision', 'stale_document') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = SQLERRM;
      END IF;
      -- Genuine transient serialization failures (incl. 'request_in_progress') stay retryable.
      RAISE;
  END;
END;
$$;

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

  SELECT configs.resume_id
  INTO v_resume_id
  FROM public.resume_config AS configs
  WHERE configs.user_id = p_owner_user_id
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

  BEGIN
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
  EXCEPTION
    WHEN serialization_failure THEN
      -- Deterministic document-revision conflicts must not trigger PostgREST's retry loop.
      IF SQLERRM IN ('stale_revision', 'stale_document') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = SQLERRM;
      END IF;
      -- Genuine transient serialization failures (incl. 'request_in_progress') stay retryable.
      RAISE;
  END;
END;
$$;
