-- 将评论权限解析和写入后的权威回读收敛到数据库 RPC，避免 Edge Function
-- 为每次评论变更串行执行多轮 PostgREST 请求。

CREATE OR REPLACE FUNCTION private.assert_resume_comment_collaboration_lease_v1(
  p_session_id text,
  p_resume_id uuid,
  p_scope_id uuid,
  p_user_id uuid,
  p_role text,
  p_protocol_version smallint,
  p_member_lease_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
  v_member public.resume_comment_collaboration_members%ROWTYPE;
BEGIN
  IF p_protocol_version IS NULL
     OR p_protocol_version NOT IN (1, 2)
     OR (p_protocol_version = 2 AND p_member_lease_id IS NULL)
     OR (p_protocol_version = 1 AND p_member_lease_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  SELECT sessions.*
  INTO v_session
  FROM public.resume_comment_collaboration_sessions AS sessions
  WHERE sessions.session_id = p_session_id
    AND sessions.resume_id = p_resume_id
    AND sessions.scope_id = p_scope_id
    AND sessions.protocol_version = p_protocol_version
  FOR UPDATE;

  SELECT members.*
  INTO v_member
  FROM public.resume_comment_collaboration_members AS members
  WHERE members.session_id = p_session_id
    AND members.user_id = p_user_id
    AND members.protocol_version = p_protocol_version
  FOR UPDATE;

  IF v_session.session_id IS NULL
     OR v_member.session_id IS NULL
     OR v_session.revoked_at IS NOT NULL
     OR v_member.revoked_at IS NOT NULL
     OR v_session.expires_at <= pg_catalog.now()
     OR v_member.expires_at <= pg_catalog.now()
     OR v_member.role IS DISTINCT FROM p_role
     OR (
       p_protocol_version = 2
       AND v_member.member_lease_id IS DISTINCT FROM p_member_lease_id
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_resume_comments_with_collaboration_lease_v2(
  p_protocol_version integer,
  p_access_kind text,
  p_user_id uuid DEFAULT NULL,
  p_scope_id uuid DEFAULT NULL,
  p_resume_id uuid DEFAULT NULL,
  p_version_id bigint DEFAULT NULL,
  p_share_id uuid DEFAULT NULL,
  p_release_id uuid DEFAULT NULL,
  p_password_generation text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_collaborator_role text DEFAULT NULL,
  p_anonymous_id uuid DEFAULT NULL,
  p_anonymous_secret_hash text DEFAULT NULL,
  p_collaboration_protocol_version smallint DEFAULT NULL,
  p_member_lease_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF p_access_kind = 'collaborator' THEN
    PERFORM private.assert_resume_comment_collaboration_lease_v1(
      p_session_id,
      p_resume_id,
      p_scope_id,
      p_user_id,
      p_collaborator_role,
      p_collaboration_protocol_version,
      p_member_lease_id
    );
  ELSIF p_collaboration_protocol_version IS NOT NULL
        OR p_member_lease_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  RETURN public.bootstrap_resume_comments_v1(
    p_protocol_version,
    p_access_kind,
    p_user_id,
    p_scope_id,
    p_resume_id,
    p_version_id,
    p_share_id,
    p_release_id,
    p_password_generation,
    p_session_id,
    p_collaborator_role,
    p_anonymous_id,
    p_anonymous_secret_hash
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_resume_comment_access_v1(
  p_protocol_version integer,
  p_access_kind text,
  p_user_id uuid DEFAULT NULL,
  p_scope_id uuid DEFAULT NULL,
  p_resume_id uuid DEFAULT NULL,
  p_version_id bigint DEFAULT NULL,
  p_share_id uuid DEFAULT NULL,
  p_release_id uuid DEFAULT NULL,
  p_password_generation text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_collaborator_role text DEFAULT NULL,
  p_anonymous_id uuid DEFAULT NULL,
  p_anonymous_secret_hash text DEFAULT NULL,
  p_collaboration_protocol_version smallint DEFAULT NULL,
  p_member_lease_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_scope public.resume_comment_scopes%ROWTYPE;
  v_owner_locator_count integer;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF p_protocol_version IS DISTINCT FROM 1
    OR p_access_kind IS NULL
    OR p_access_kind NOT IN ('owner', 'collaborator', 'share') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  IF p_access_kind = 'owner' THEN
    v_owner_locator_count :=
      CASE WHEN p_scope_id IS NULL THEN 0 ELSE 1 END
      + CASE WHEN p_resume_id IS NULL THEN 0 ELSE 1 END
      + CASE WHEN p_version_id IS NULL THEN 0 ELSE 1 END;
    IF p_user_id IS NULL
      OR v_owner_locator_count <> 1
      OR (p_version_id IS NOT NULL AND p_version_id <= 0)
      OR p_share_id IS NOT NULL
      OR p_release_id IS NOT NULL
      OR p_password_generation IS NOT NULL
      OR p_session_id IS NOT NULL
      OR p_collaborator_role IS NOT NULL
      OR p_anonymous_id IS NOT NULL
      OR p_anonymous_secret_hash IS NOT NULL
      OR p_collaboration_protocol_version IS NOT NULL
      OR p_member_lease_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;
  ELSIF p_access_kind = 'collaborator' THEN
    IF p_user_id IS NULL
      OR p_scope_id IS NULL
      OR p_resume_id IS NULL
      OR p_version_id IS NULL
      OR p_version_id <= 0
      OR p_session_id IS NULL
      OR p_session_id !~ '^[0-9A-Za-z_-]{16,64}$'
      OR p_collaborator_role IS NULL
      OR p_collaborator_role NOT IN ('editor', 'viewer')
      OR p_share_id IS NOT NULL
      OR p_release_id IS NOT NULL
      OR p_password_generation IS NOT NULL
      OR p_anonymous_id IS NOT NULL
      OR p_anonymous_secret_hash IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;
    PERFORM private.assert_resume_comment_collaboration_lease_v1(
      p_session_id,
      p_resume_id,
      p_scope_id,
      p_user_id,
      p_collaborator_role,
      p_collaboration_protocol_version,
      p_member_lease_id
    );
  ELSE
    IF p_scope_id IS NULL
      OR p_version_id IS NULL
      OR p_version_id <= 0
      OR p_share_id IS NULL
      OR p_release_id IS NULL
      OR p_password_generation IS NULL
      OR pg_catalog.btrim(p_password_generation) = ''
      OR p_resume_id IS NOT NULL
      OR p_session_id IS NOT NULL
      OR p_collaborator_role IS NOT NULL
      OR p_collaboration_protocol_version IS NOT NULL
      OR p_member_lease_id IS NOT NULL
      OR (
        p_user_id IS NULL
        AND (p_anonymous_id IS NULL) <> (p_anonymous_secret_hash IS NULL)
      )
      OR (
        p_user_id IS NULL
        AND p_anonymous_secret_hash IS NOT NULL
        AND pg_catalog.char_length(p_anonymous_secret_hash) NOT BETWEEN 32 AND 256
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;
  END IF;

  v_access := private.resolve_resume_comment_bootstrap_access_v1(
    p_access_kind,
    p_user_id,
    p_scope_id,
    p_resume_id,
    p_version_id,
    p_share_id,
    p_release_id,
    p_password_generation,
    p_session_id,
    p_collaborator_role,
    p_anonymous_id,
    p_anonymous_secret_hash
  );

  IF v_access ->> 'status' = 'scope_missing' THEN
    RETURN v_access;
  END IF;

  SELECT scopes.*
  INTO v_scope
  FROM public.resume_comment_scopes AS scopes
  WHERE scopes.id = (v_access ->> 'scopeId')::uuid
    AND scopes.kind = 'version'
    AND scopes.version_id = (v_access ->> 'versionId')::bigint
    AND scopes.archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'protocolVersion', 1,
    'status', 'ok',
    'access', v_access,
    'scope', pg_catalog.to_jsonb(v_scope)
  );
EXCEPTION
  WHEN SQLSTATE '42501' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  WHEN SQLSTATE 'P0002' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  WHEN SQLSTATE 'P0404' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0404', MESSAGE = 'share_unavailable';
  WHEN SQLSTATE 'P0403' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0403', MESSAGE = 'comments_disabled';
  WHEN SQLSTATE 'P0409' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'stale_release';
  WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE = 'XX000', MESSAGE = 'unexpected';
END;
$$;

CREATE OR REPLACE FUNCTION private.build_resume_comment_mutation_result_v1(
  p_scope_id uuid,
  p_op text,
  p_response jsonb,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH
  identifiers AS MATERIALIZED (
    SELECT
      nullif(p_response ->> 'threadId', '')::uuid AS thread_id,
      nullif(p_response ->> 'commentId', '')::uuid AS comment_id,
      coalesce((p_response ->> 'eventSeq')::bigint, 0) AS event_seq
  ),
  target_thread AS MATERIALIZED (
    SELECT
      threads.id,
      threads.scope_id,
      threads.anchor,
      threads.anchor_status,
      threads.original_page_index,
      threads.revision,
      threads.resolved_at,
      threads.resolved_by_kind,
      threads.resolved_by_id,
      threads.last_activity_at,
      threads.created_at,
      threads.updated_at
    FROM public.resume_comment_threads AS threads
    JOIN identifiers AS ids ON ids.thread_id = threads.id
    WHERE threads.scope_id = p_scope_id
      AND threads.deleted_at IS NULL
  ),
  comment_rows AS MATERIALIZED (
    SELECT
      comments.id,
      comments.thread_id,
      comments.parent_id,
      comments.author_kind,
      comments.author_user_id,
      comments.author_anonymous_id,
      comments.body,
      comments.edited_at,
      comments.deleted_at,
      comments.created_at,
      comments.updated_at
    FROM public.resume_comments AS comments
    JOIN target_thread AS threads ON threads.id = comments.thread_id
  ),
  comments_payload AS MATERIALIZED (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', comments.id,
          'thread_id', comments.thread_id,
          'parent_id', comments.parent_id,
          'author_kind', comments.author_kind,
          'author_user_id', comments.author_user_id,
          'author_anonymous_id', comments.author_anonymous_id,
          'body', comments.body,
          'edited_at', comments.edited_at,
          'deleted_at', comments.deleted_at,
          'created_at', comments.created_at,
          'updated_at', comments.updated_at
        ) ORDER BY comments.created_at, comments.id
      ),
      '[]'::jsonb
    ) AS value
    FROM comment_rows AS comments
  ),
  thread_payload AS MATERIALIZED (
    SELECT pg_catalog.jsonb_build_object(
      'id', threads.id,
      'scope_id', threads.scope_id,
      'anchor', threads.anchor,
      'anchor_status', threads.anchor_status,
      'original_page_index', threads.original_page_index,
      'revision', threads.revision,
      'resolved_at', threads.resolved_at,
      'resolved_by_kind', threads.resolved_by_kind,
      'resolved_by_id', threads.resolved_by_id,
      'last_activity_at', threads.last_activity_at,
      'created_at', threads.created_at,
      'updated_at', threads.updated_at,
      'comments', comments.value
    ) AS value
    FROM target_thread AS threads
    CROSS JOIN comments_payload AS comments
  ),
  selected_comment AS MATERIALIZED (
    SELECT pg_catalog.jsonb_build_object(
      'id', comments.id,
      'thread_id', comments.thread_id,
      'parent_id', comments.parent_id,
      'author_kind', comments.author_kind,
      'author_user_id', comments.author_user_id,
      'author_anonymous_id', comments.author_anonymous_id,
      'body', comments.body,
      'edited_at', comments.edited_at,
      'deleted_at', comments.deleted_at,
      'created_at', comments.created_at,
      'updated_at', comments.updated_at
    ) AS value
    FROM comment_rows AS comments
    JOIN identifiers AS ids ON ids.comment_id = comments.id
  ),
  live_threads AS MATERIALIZED (
    SELECT threads.anchor_status, threads.resolved_at
    FROM public.resume_comment_threads AS threads
    WHERE threads.scope_id = p_scope_id
      AND threads.deleted_at IS NULL
  ),
  counts_payload AS MATERIALIZED (
    SELECT pg_catalog.jsonb_build_object(
      'unresolved', count(*) FILTER (
        WHERE threads.anchor_status <> 'detached'
          AND threads.resolved_at IS NULL
      ),
      'resolved', count(*) FILTER (
        WHERE threads.anchor_status <> 'detached'
          AND threads.resolved_at IS NOT NULL
      ),
      'detached', count(*) FILTER (
        WHERE threads.anchor_status = 'detached'
      )
    ) AS value
    FROM live_threads AS threads
  ),
  profile_user_ids AS MATERIALIZED (
    SELECT comments.author_user_id AS user_id
    FROM comment_rows AS comments
    WHERE comments.author_kind = 'user'
      AND comments.author_user_id IS NOT NULL
    UNION
    SELECT threads.resolved_by_id AS user_id
    FROM target_thread AS threads
    WHERE threads.resolved_by_kind = 'user'
      AND threads.resolved_by_id IS NOT NULL
  ),
  profiles_payload AS MATERIALIZED (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', profiles.id,
          'full_name', profiles.full_name,
          'avatar_url', profiles.avatar_url
        ) ORDER BY profiles.id
      ),
      '[]'::jsonb
    ) AS value
    FROM profile_user_ids AS authors
    JOIN public.profiles AS profiles ON profiles.id = authors.user_id
  ),
  event_payload AS MATERIALIZED (
    SELECT pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'event_seq', events.event_seq,
      'thread_id', events.thread_id,
      'type', events.type,
      'created_at', events.created_at,
      'is_own', true,
      'clientRequestId', CASE
        WHEN events.type IN ('thread_created', 'comment_replied')
          THEN events.sanitized_payload ->> 'clientRequestId'
        ELSE NULL
      END
    )) AS value
    FROM public.resume_comment_events AS events
    JOIN identifiers AS ids ON ids.event_seq = events.event_seq
    WHERE events.scope_id = p_scope_id
  )
  SELECT pg_catalog.jsonb_build_object(
    'thread', (SELECT threads.value FROM thread_payload AS threads),
    'comment', (SELECT comments.value FROM selected_comment AS comments),
    'removedCommentId', CASE
      WHEN p_op = 'delete_comment' THEN p_response ->> 'commentId'
      ELSE NULL
    END,
    'profiles', profiles.value,
    'counts', counts.value,
    'event', coalesce(
      (SELECT events.value FROM event_payload AS events),
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'event_seq', ids.event_seq,
        'thread_id', ids.thread_id,
        'type', CASE p_op
          WHEN 'create_thread' THEN 'thread_created'
          WHEN 'create_reply' THEN 'comment_replied'
          WHEN 'edit_comment' THEN 'comment_edited'
          WHEN 'delete_comment' THEN 'comment_deleted'
          WHEN 'delete_thread' THEN 'thread_deleted'
          WHEN 'resolve_thread' THEN 'thread_resolved'
          WHEN 'reopen_thread' THEN 'thread_reopened'
          WHEN 'relink_anchor' THEN 'anchor_relinked'
        END,
        'created_at', pg_catalog.now(),
        'is_own', true,
        'clientRequestId', CASE
          WHEN p_op IN ('create_thread', 'create_reply') THEN p_request_id::text
          ELSE NULL
        END
      ))
    )
  )
  FROM identifiers AS ids
  CROSS JOIN counts_payload AS counts
  CROSS JOIN profiles_payload AS profiles;
$$;

CREATE OR REPLACE FUNCTION public.execute_resume_comment_mutation_v1(
  p_op text,
  p_scope_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_actor_key text,
  p_request_id uuid,
  p_payload jsonb,
  p_network_key text,
  p_share_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
DECLARE
  v_stage_started_at timestamptz := pg_catalog.clock_timestamp();
  v_replay_ms numeric;
  v_rate_limit_ms numeric := 0;
  v_write_ms numeric := 0;
  v_hydrate_ms numeric := 0;
  v_response jsonb;
  v_hydrated jsonb;
  v_retry_after integer;
  v_replayed boolean := false;
  v_thread_id uuid;
  v_event_seq bigint;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF p_op NOT IN (
    'create_thread',
    'create_reply',
    'edit_comment',
    'delete_comment',
    'delete_thread',
    'resolve_thread',
    'reopen_thread',
    'relink_anchor'
  )
    OR p_actor_kind NOT IN ('user', 'anonymous')
    OR p_actor_id IS NULL
    OR p_request_id IS NULL
    OR pg_catalog.length(p_actor_key) NOT BETWEEN 3 AND 256
    OR p_payload IS NULL
    OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid comment mutation';
  END IF;

  SELECT requests.response
  INTO v_response
  FROM public.resume_comment_requests AS requests
  WHERE requests.actor_key = p_actor_key
    AND requests.request_id = p_request_id
    AND requests.completed_at IS NOT NULL
    AND requests.response IS NOT NULL;
  v_replayed := FOUND;
  v_replay_ms := 1000 * extract(
    epoch FROM pg_catalog.clock_timestamp() - v_stage_started_at
  );

  IF NOT v_replayed THEN
    v_stage_started_at := pg_catalog.clock_timestamp();
    v_thread_id := nullif(p_payload ->> 'threadId', '')::uuid;
    v_retry_after := public.check_resume_comment_rate_limit(
      p_actor_key,
      p_network_key,
      p_share_id,
      v_thread_id
    );
    v_rate_limit_ms := 1000 * extract(
      epoch FROM pg_catalog.clock_timestamp() - v_stage_started_at
    );
    IF v_retry_after > 0 THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'rate_limited',
        'retryAfterSeconds', v_retry_after,
        'timings', pg_catalog.jsonb_build_object(
          'replay', v_replay_ms,
          'rate_limit', v_rate_limit_ms,
          'write_rpc', 0,
          'hydrate', 0
        )
      );
    END IF;

    v_stage_started_at := pg_catalog.clock_timestamp();
    v_response := public.execute_resume_version_comment_write(
      p_op,
      p_scope_id,
      p_actor_kind,
      p_actor_id,
      p_actor_key,
      p_request_id,
      p_payload
    );
    v_write_ms := 1000 * extract(
      epoch FROM pg_catalog.clock_timestamp() - v_stage_started_at
    );
  END IF;

  IF p_op IN ('create_thread', 'create_reply') THEN
    v_event_seq := coalesce((v_response ->> 'eventSeq')::bigint, 0);
    UPDATE public.resume_comment_events AS events
    SET sanitized_payload = events.sanitized_payload || pg_catalog.jsonb_build_object(
      'clientRequestId', p_request_id
    )
    WHERE events.scope_id = p_scope_id
      AND events.event_seq = v_event_seq
      AND events.type IN ('thread_created', 'comment_replied');
  END IF;

  v_stage_started_at := pg_catalog.clock_timestamp();
  v_hydrated := private.build_resume_comment_mutation_result_v1(
    p_scope_id,
    p_op,
    v_response,
    p_request_id
  );
  v_hydrate_ms := 1000 * extract(
    epoch FROM pg_catalog.clock_timestamp() - v_stage_started_at
  );

  RETURN pg_catalog.jsonb_build_object(
    'status', 'ok',
    'replayed', v_replayed,
    'data', v_response || v_hydrated,
    'timings', pg_catalog.jsonb_build_object(
      'replay', v_replay_ms,
      'rate_limit', v_rate_limit_ms,
      'write_rpc', v_write_ms,
      'hydrate', v_hydrate_ms
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.assert_resume_comment_collaboration_lease_v1(
  text, uuid, uuid, uuid, text, smallint, uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.build_resume_comment_mutation_result_v1(
  uuid, text, jsonb, uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolve_resume_comment_access_v1(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text, smallint, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_resume_comment_access_v1(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text, smallint, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.execute_resume_comment_mutation_v1(
  text, uuid, text, uuid, text, uuid, jsonb, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_resume_comment_mutation_v1(
  text, uuid, text, uuid, text, uuid, jsonb, text, uuid
) TO service_role;
