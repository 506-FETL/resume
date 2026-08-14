-- 将评论 bootstrap 的最终授权与数据读取聚合到单个 service-role-only RPC。
-- public 包装器只负责协议边界；private 函数承载权威访问解析和集合聚合。

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

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
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_version public.resume_config_versions%ROWTYPE;
  v_scope public.resume_comment_scopes%ROWTYPE;
  v_share public.resume_shares%ROWTYPE;
  v_release public.resume_share_releases%ROWTYPE;
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
  v_member public.resume_comment_collaboration_members%ROWTYPE;
  v_identity public.resume_comment_anonymous_identities%ROWTYPE;
  v_target_version_id bigint;
  v_valid_anonymous_id uuid;
  v_actor_kind text;
  v_actor_id uuid;
  v_actor_key text;
  v_legacy_anonymous_id uuid;
BEGIN
  IF p_access_kind = 'owner' THEN
    IF p_scope_id IS NOT NULL THEN
      SELECT scopes.*
      INTO v_scope
      FROM public.resume_comment_scopes AS scopes
      WHERE scopes.id = p_scope_id
        AND scopes.kind = 'version'
        AND scopes.archived_at IS NULL;

      IF NOT FOUND OR v_scope.version_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
      END IF;
      v_target_version_id := v_scope.version_id;
    ELSIF p_version_id IS NOT NULL THEN
      v_target_version_id := p_version_id;
    ELSE
      SELECT configs.current_version_id
      INTO v_target_version_id
      FROM public.resume_config AS configs
      WHERE configs.resume_id = p_resume_id
        AND configs.user_id = p_user_id;

      IF NOT FOUND OR v_target_version_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
      END IF;
    END IF;

    SELECT versions.*
    INTO v_version
    FROM public.resume_config_versions AS versions
    WHERE versions.id = v_target_version_id
      AND versions.user_id = p_user_id;

    IF NOT FOUND
      OR (p_resume_id IS NOT NULL AND v_version.resume_id <> p_resume_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
    END IF;

    IF p_resume_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.resume_config AS configs
      WHERE configs.resume_id = p_resume_id
        AND configs.user_id = p_user_id
        AND configs.current_version_id = v_version.id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
    END IF;

    IF p_scope_id IS NULL THEN
      SELECT scopes.*
      INTO v_scope
      FROM public.resume_comment_scopes AS scopes
      WHERE scopes.kind = 'version'
        AND scopes.version_id = v_version.id
        AND scopes.archived_at IS NULL;
    END IF;

    IF v_scope.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'protocolVersion', 1,
        'status', 'scope_missing',
        'repair', pg_catalog.jsonb_build_object(
          'ownerUserId', v_version.user_id,
          'versionId', v_version.id,
          'resumeId', v_version.resume_id,
          'snapshot', v_version.snapshot,
          'projectionReferenceDate', v_version.projection_reference_date,
          'documentRevision', v_version.document_revision
        ),
        'access', pg_catalog.jsonb_build_object(
          'kind', 'owner',
          'sharePasswordHash', NULL
        )
      );
    END IF;

    IF v_scope.owner_user_id <> v_version.user_id
      OR v_scope.resume_id <> v_version.resume_id
      OR v_scope.version_id <> v_version.id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'kind', 'owner',
      'userId', p_user_id,
      'actorKind', 'user',
      'actorId', p_user_id,
      'actorKey', 'user:' || p_user_id::text,
      'legacyAnonymousId', NULL,
      'canWrite', true,
      'canManageAll', true,
      'scopeId', v_scope.id,
      'versionId', v_version.id,
      'ownerUserId', v_version.user_id,
      'shareId', NULL,
      'releaseId', NULL,
      'sharePasswordHash', NULL
    );
  END IF;

  IF p_access_kind = 'collaborator' THEN
    SELECT sessions.*
    INTO v_session
    FROM public.resume_comment_collaboration_sessions AS sessions
    WHERE sessions.session_id = p_session_id;

    SELECT members.*
    INTO v_member
    FROM public.resume_comment_collaboration_members AS members
    WHERE members.session_id = p_session_id
      AND members.user_id = p_user_id;

    SELECT scopes.*
    INTO v_scope
    FROM public.resume_comment_scopes AS scopes
    WHERE scopes.id = p_scope_id;

    SELECT versions.*
    INTO v_version
    FROM public.resume_config_versions AS versions
    WHERE versions.id = p_version_id;

    IF v_session.session_id IS NULL
      OR v_member.session_id IS NULL
      OR v_scope.id IS NULL
      OR v_version.id IS NULL
      OR v_session.revoked_at IS NOT NULL
      OR v_member.revoked_at IS NOT NULL
      OR v_session.expires_at <= v_now
      OR v_member.expires_at <= v_now
      OR v_session.session_id <> v_member.session_id
      OR v_session.resume_id <> p_resume_id
      OR v_session.scope_id <> p_scope_id
      OR v_session.owner_user_id <> v_scope.owner_user_id
      OR v_member.user_id <> p_user_id
      OR v_member.role <> p_collaborator_role
      OR v_scope.kind <> 'version'
      OR v_scope.archived_at IS NOT NULL
      OR v_scope.resume_id <> p_resume_id
      OR v_scope.version_id <> p_version_id
      OR v_version.resume_id <> p_resume_id
      OR v_version.user_id <> v_session.owner_user_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'kind', 'collaborator',
      'userId', p_user_id,
      'actorKind', 'user',
      'actorId', p_user_id,
      'actorKey', 'user:' || p_user_id::text,
      'legacyAnonymousId', NULL,
      'canWrite', v_member.role = 'editor',
      'canManageAll', false,
      'scopeId', v_scope.id,
      'versionId', v_version.id,
      'ownerUserId', v_version.user_id,
      'shareId', NULL,
      'releaseId', NULL,
      'sharePasswordHash', NULL
    );
  END IF;

  SELECT shares.*
  INTO v_share
  FROM public.resume_shares AS shares
  WHERE shares.id = p_share_id;

  IF NOT FOUND
    OR NOT v_share.is_active
    OR v_share.archived_at IS NOT NULL
    OR (v_share.expires_at IS NOT NULL AND v_share.expires_at <= v_now) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0404', MESSAGE = 'share_unavailable';
  END IF;

  IF v_share.current_release_id IS DISTINCT FROM p_release_id
    OR v_share.version_id IS DISTINCT FROM p_version_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'stale_release';
  END IF;

  SELECT releases.*
  INTO v_release
  FROM public.resume_share_releases AS releases
  WHERE releases.id = p_release_id
    AND releases.share_id = p_share_id;

  SELECT versions.*
  INTO v_version
  FROM public.resume_config_versions AS versions
  WHERE versions.id = p_version_id;

  IF v_release.id IS NULL
    OR v_version.id IS NULL
    OR v_share.resume_id <> v_version.resume_id
    OR v_share.user_id <> v_version.user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'stale_release';
  END IF;

  -- 已登录 share user 的 legacy anonymous credential 是兼容信息：无效时忽略。
  -- 未登录访客一旦提交 anonymous credential，则必须完整且权威匹配。
  IF p_anonymous_id IS NOT NULL AND p_anonymous_secret_hash IS NOT NULL THEN
    SELECT identities.*
    INTO v_identity
    FROM public.resume_comment_anonymous_identities AS identities
    WHERE identities.id = p_anonymous_id
      AND identities.version_id = p_version_id
      AND identities.secret_hash = p_anonymous_secret_hash
      AND identities.revoked_at IS NULL;

    IF FOUND THEN
      v_valid_anonymous_id := v_identity.id;
    ELSIF p_user_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;
  ELSIF p_user_id IS NULL
    AND (p_anonymous_id IS NOT NULL OR p_anonymous_secret_hash IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  SELECT scopes.*
  INTO v_scope
  FROM public.resume_comment_scopes AS scopes
  WHERE scopes.kind = 'version'
    AND scopes.version_id = v_version.id
    AND scopes.archived_at IS NULL;

  IF v_scope.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'protocolVersion', 1,
      'status', 'scope_missing',
      'repair', pg_catalog.jsonb_build_object(
        'ownerUserId', v_version.user_id,
        'versionId', v_version.id,
        'resumeId', v_version.resume_id,
        'snapshot', v_version.snapshot,
        'projectionReferenceDate', v_version.projection_reference_date,
        'documentRevision', v_version.document_revision
      ),
      'access', pg_catalog.jsonb_build_object(
        'kind', 'share',
        'sharePasswordHash', v_share.password_hash
      )
    );
  END IF;

  IF v_scope.id <> p_scope_id
    OR v_scope.owner_user_id <> v_version.user_id
    OR v_scope.resume_id <> v_version.resume_id
    OR v_scope.version_id <> v_version.id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'stale_release';
  END IF;

  IF p_user_id IS NOT NULL THEN
    v_actor_kind := 'user';
    v_actor_id := p_user_id;
    v_actor_key := 'user:' || p_user_id::text;
    v_legacy_anonymous_id := v_valid_anonymous_id;
  ELSIF v_valid_anonymous_id IS NOT NULL THEN
    v_actor_kind := 'anonymous';
    v_actor_id := v_valid_anonymous_id;
    v_actor_key := 'anonymous:' || v_valid_anonymous_id::text;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'kind', 'share',
    'userId', p_user_id,
    'actorKind', v_actor_kind,
    'actorId', v_actor_id,
    'actorKey', v_actor_key,
    'legacyAnonymousId', v_legacy_anonymous_id,
    'canWrite', v_share.allow_comments,
    'canManageAll', false,
    'scopeId', v_scope.id,
    'versionId', v_version.id,
    'ownerUserId', v_version.user_id,
    'shareId', v_share.id,
    'releaseId', v_release.id,
    'sharePasswordHash', v_share.password_hash
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.build_resume_comment_bootstrap_v1(
  p_access jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH
  access_values AS MATERIALIZED (
    SELECT
      (p_access ->> 'scopeId')::uuid AS scope_id,
      (p_access ->> 'versionId')::bigint AS version_id,
      p_access ->> 'actorKind' AS actor_kind,
      (p_access ->> 'actorId')::uuid AS actor_id
  ),
  scope_row AS MATERIALIZED (
    SELECT scopes.*
    FROM public.resume_comment_scopes AS scopes
    JOIN access_values AS access ON access.scope_id = scopes.id
    WHERE scopes.kind = 'version'
      AND scopes.archived_at IS NULL
      AND scopes.version_id = access.version_id
  ),
  scope_payload AS MATERIALIZED (
    SELECT pg_catalog.jsonb_build_object(
      'id', scopes.id,
      'kind', scopes.kind,
      'owner_user_id', scopes.owner_user_id,
      'resume_id', scopes.resume_id,
      'version_id', scopes.version_id,
      'history_version_id', scopes.history_version_id,
      'share_release_id', scopes.share_release_id,
      'anchor_document', pg_catalog.jsonb_build_object(
        'nodes', coalesce((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object('nodeKey', nodes.value ->> 'nodeKey')
            ORDER BY nodes.ordinality
          )
          FROM pg_catalog.jsonb_array_elements(scopes.anchor_document -> 'nodes')
            WITH ORDINALITY AS nodes(value, ordinality)
        ), '[]'::jsonb)
      ),
      'document_hash', scopes.document_hash,
      'document_revision', scopes.document_revision,
      'projection_reference_date', scopes.projection_reference_date,
      'next_event_seq', scopes.next_event_seq,
      'archived_at', scopes.archived_at
    ) AS value
    FROM scope_row AS scopes
  ),
  thread_rows AS MATERIALIZED (
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
    JOIN access_values AS access ON access.scope_id = threads.scope_id
    WHERE threads.deleted_at IS NULL
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
    JOIN thread_rows AS threads ON threads.id = comments.thread_id
  ),
  comment_groups AS MATERIALIZED (
    SELECT
      comments.thread_id,
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
        ) ORDER BY comments.created_at ASC, comments.id ASC
      ) AS value
    FROM comment_rows AS comments
    GROUP BY comments.thread_id
  ),
  thread_payload_rows AS MATERIALIZED (
    SELECT
      threads.id,
      threads.last_activity_at,
      pg_catalog.jsonb_build_object(
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
        'comments', coalesce(comments.value, '[]'::jsonb)
      ) AS value
    FROM thread_rows AS threads
    LEFT JOIN comment_groups AS comments ON comments.thread_id = threads.id
  ),
  threads_payload AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        threads.value
        ORDER BY threads.last_activity_at DESC, threads.id ASC
      ),
      '[]'::jsonb
    ) AS value
    FROM thread_payload_rows AS threads
  ),
  thread_counts AS (
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
    FROM thread_rows AS threads
  ),
  profile_user_ids AS MATERIALIZED (
    SELECT comments.author_user_id AS user_id
    FROM comment_rows AS comments
    WHERE comments.author_kind = 'user'
      AND comments.author_user_id IS NOT NULL
    UNION
    SELECT threads.resolved_by_id AS user_id
    FROM thread_rows AS threads
    WHERE threads.resolved_by_kind = 'user'
      AND threads.resolved_by_id IS NOT NULL
  ),
  profiles_payload AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', profiles.id,
          'full_name', profiles.full_name,
          'avatar_url', profiles.avatar_url
        ) ORDER BY profiles.id ASC
      ),
      '[]'::jsonb
    ) AS value
    FROM profile_user_ids AS authors
    JOIN public.profiles AS profiles ON profiles.id = authors.user_id
  ),
  read_cursor AS (
    SELECT CASE access.actor_kind
      WHEN 'user' THEN coalesce((
        SELECT states.last_read_event_seq
        FROM public.resume_comment_read_states AS states
        WHERE states.scope_id = access.scope_id
          AND states.principal_kind = 'user'
          AND states.principal_user_id = access.actor_id
      ), 0)
      WHEN 'anonymous' THEN coalesce((
        SELECT states.last_read_event_seq
        FROM public.resume_comment_read_states AS states
        WHERE states.scope_id = access.scope_id
          AND states.principal_kind = 'anonymous'
          AND states.principal_anonymous_id = access.actor_id
      ), 0)
      ELSE 0
    END AS value
    FROM access_values AS access
  ),
  valid_share_count AS (
    SELECT count(*) AS value
    FROM public.resume_shares AS shares
    JOIN public.resume_share_releases AS releases
      ON releases.id = shares.current_release_id
     AND releases.share_id = shares.id
    JOIN access_values AS access ON access.version_id = shares.version_id
    JOIN scope_row AS scopes ON scopes.resume_id = shares.resume_id
    WHERE shares.archived_at IS NULL
      AND shares.is_active
      AND (shares.expires_at IS NULL OR shares.expires_at > pg_catalog.now())
  ),
  version_payload AS MATERIALIZED (
    SELECT pg_catalog.jsonb_build_object(
      'id', versions.id,
      'version_no', versions.version_no,
      'version_name', versions.version_name,
      'milestone_name', versions.milestone_name,
      'status', versions.status,
      'content_hash', versions.content_hash,
      'document_revision', versions.document_revision,
      'projection_reference_date', versions.projection_reference_date,
      'shared_link_count', shares.value
    ) AS value
    FROM public.resume_config_versions AS versions
    JOIN access_values AS access ON access.version_id = versions.id
    JOIN scope_row AS scopes
      ON scopes.version_id = versions.id
     AND scopes.resume_id = versions.resume_id
     AND scopes.owner_user_id = versions.user_id
    CROSS JOIN valid_share_count AS shares
  )
  SELECT pg_catalog.jsonb_build_object(
    'protocolVersion', 1,
    'status', 'ok',
    'access', p_access,
    'bootstrap', pg_catalog.jsonb_build_object(
      'scope', scopes.value,
      'version', versions.value,
      'counts', counts.value,
      'threads', threads.value,
      'profiles', profiles.value,
      'lastReadEventSeq', cursor.value,
      'accessibleScopes', pg_catalog.jsonb_build_array(
        scopes.value || pg_catalog.jsonb_build_object(
          'last_read_event_seq', cursor.value
        )
      )
    ),
    'eventSeq', (scopes.value ->> 'next_event_seq')::bigint
  )
  FROM scope_payload AS scopes
  CROSS JOIN version_payload AS versions
  CROSS JOIN thread_counts AS counts
  CROSS JOIN threads_payload AS threads
  CROSS JOIN profiles_payload AS profiles
  CROSS JOIN read_cursor AS cursor;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_resume_comments_v1(
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
  p_anonymous_secret_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_result jsonb;
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
      OR p_anonymous_secret_hash IS NOT NULL THEN
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
      OR p_collaborator_role NOT IN ('editor', 'viewer')
      OR p_share_id IS NOT NULL
      OR p_release_id IS NOT NULL
      OR p_password_generation IS NOT NULL
      OR p_anonymous_id IS NOT NULL
      OR p_anonymous_secret_hash IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;
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

  v_result := private.build_resume_comment_bootstrap_v1(v_access);
  IF v_result IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;
  RETURN v_result;
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

-- 既有 scope 只有在 owner / resume / version 三重权威链完全一致时才可复用。
CREATE OR REPLACE FUNCTION public.ensure_resume_version_comment_scope(
  p_owner_user_id uuid,
  p_version_id bigint,
  p_anchor_document jsonb,
  p_document_hash text,
  p_projection_reference_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version public.resume_config_versions%ROWTYPE;
  v_scope public.resume_comment_scopes%ROWTYPE;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF NOT public.is_valid_resume_comment_anchor_document(
    p_anchor_document,
    p_document_hash
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid anchor document';
  END IF;

  SELECT versions.*
  INTO v_version
  FROM public.resume_config_versions AS versions
  WHERE versions.id = p_version_id
    AND versions.user_id = p_owner_user_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'version not found';
  END IF;

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
  ) VALUES (
    'version',
    v_version.user_id,
    v_version.resume_id,
    v_version.id,
    p_anchor_document,
    p_document_hash,
    v_version.document_revision,
    p_projection_reference_date,
    0
  ) ON CONFLICT DO NOTHING;

  SELECT scopes.*
  INTO v_scope
  FROM public.resume_comment_scopes AS scopes
  WHERE scopes.kind = 'version'
    AND scopes.version_id = p_version_id
    AND scopes.archived_at IS NULL;

  IF v_scope.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'version scope authority conflict';
  END IF;
  IF v_scope.owner_user_id <> p_owner_user_id
    OR v_scope.resume_id <> v_version.resume_id
    OR v_scope.version_id <> v_version.id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'version scope authority conflict';
  END IF;

  RETURN v_scope.id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_resume_comment_service_role()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_resume_comment_service_role()
  TO service_role;

REVOKE ALL ON FUNCTION private.resolve_resume_comment_bootstrap_access_v1(
  text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.build_resume_comment_bootstrap_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.bootstrap_resume_comments_v1(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_resume_comments_v1(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text
) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_resume_version_comment_scope(
  uuid, bigint, jsonb, text, date
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_resume_version_comment_scope(
  uuid, bigint, jsonb, text, date
) TO service_role;
