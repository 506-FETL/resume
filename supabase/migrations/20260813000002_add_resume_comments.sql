-- 20260813000002_add_resume_comments.sql
-- 简历全文评论的领域真源、并发边界和受控事务入口。

CREATE OR REPLACE FUNCTION public.is_valid_resume_comment_anchor_document(
  p_document jsonb,
  p_document_hash text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce((
    p_document IS NOT NULL
    AND jsonb_typeof(p_document) = 'object'
    AND jsonb_typeof(p_document -> 'nodes') = 'array'
    AND p_document_hash ~ '^[0-9a-f]{64}$'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_document -> 'nodes') AS node(value)
      WHERE jsonb_typeof(node.value) <> 'object'
        OR jsonb_typeof(node.value -> 'nodeKey') <> 'string'
        OR btrim(node.value ->> 'nodeKey') = ''
        OR jsonb_typeof(node.value -> 'text') <> 'string'
        OR jsonb_typeof(node.value -> 'blocks') <> 'array'
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(node.value -> 'blocks') = 'array'
                THEN node.value -> 'blocks'
              ELSE '[]'::jsonb
            END
          ) AS block(value)
          WHERE jsonb_typeof(block.value) <> 'object'
            OR jsonb_typeof(block.value -> 'ordinal') <> 'number'
            OR jsonb_typeof(block.value -> 'startGraphemeOffset') <> 'number'
            OR jsonb_typeof(block.value -> 'endGraphemeOffset') <> 'number'
            OR (block.value ->> 'ordinal')::integer < 0
            OR (block.value ->> 'startGraphemeOffset')::integer < 0
            OR (block.value ->> 'endGraphemeOffset')::integer
              < (block.value ->> 'startGraphemeOffset')::integer
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM (
        SELECT node.value ->> 'nodeKey' AS node_key, count(*) AS node_count
        FROM jsonb_array_elements(p_document -> 'nodes') AS node(value)
        GROUP BY node.value ->> 'nodeKey'
      ) AS duplicates
      WHERE duplicates.node_count > 1
    )
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.resume_comment_anchor_document_has_node(
  p_document jsonb,
  p_node_key text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p_document -> 'nodes') = 'array'
          THEN p_document -> 'nodes'
        ELSE '[]'::jsonb
      END
    ) AS node(value)
    WHERE node.value ->> 'nodeKey' = p_node_key
  );
$$;

CREATE OR REPLACE FUNCTION public.is_valid_resume_comment_anchor(
  p_anchor jsonb,
  p_document jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce((
    p_anchor IS NOT NULL
    AND jsonb_typeof(p_anchor) = 'object'
    AND jsonb_typeof(p_anchor -> 'nodeKey') = 'string'
    AND btrim(p_anchor ->> 'nodeKey') <> ''
    AND jsonb_typeof(p_anchor -> 'exactQuote') = 'string'
    AND btrim(p_anchor ->> 'exactQuote') <> ''
    AND jsonb_typeof(p_anchor -> 'startGraphemeOffset') = 'number'
    AND jsonb_typeof(p_anchor -> 'endGraphemeOffset') = 'number'
    AND jsonb_typeof(p_anchor -> 'blockOrdinal') = 'number'
    AND (p_anchor ->> 'startGraphemeOffset')::integer >= 0
    AND (p_anchor ->> 'endGraphemeOffset')::integer
      > (p_anchor ->> 'startGraphemeOffset')::integer
    AND (p_anchor ->> 'blockOrdinal')::integer >= 0
    AND coalesce(p_anchor ->> 'createdAtContentHash', '') ~ '^[0-9a-f]{64}$'
    AND public.resume_comment_anchor_document_has_node(
      p_document,
      p_anchor ->> 'nodeKey'
    )
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_document -> 'nodes') AS node(value)
      WHERE node.value ->> 'nodeKey' = p_anchor ->> 'nodeKey'
        AND (p_anchor ->> 'endGraphemeOffset')::integer
          <= char_length(node.value ->> 'text')
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(node.value -> 'blocks') AS block(value)
          WHERE (block.value ->> 'ordinal')::integer
              = (p_anchor ->> 'blockOrdinal')::integer
            AND (p_anchor ->> 'startGraphemeOffset')::integer
              >= (block.value ->> 'startGraphemeOffset')::integer
            AND (p_anchor ->> 'endGraphemeOffset')::integer
              <= (block.value ->> 'endGraphemeOffset')::integer
        )
    )
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.is_valid_resume_comment_anchor_document_check(
  p_document jsonb,
  p_document_hash text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN public.is_valid_resume_comment_anchor_document(p_document, p_document_hash);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_resume_comment_anchor_check(
  p_anchor jsonb,
  p_document jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN public.is_valid_resume_comment_anchor(p_anchor, p_document);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE TABLE IF NOT EXISTS public.resume_comment_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  owner_user_id uuid NOT NULL,
  resume_id uuid NOT NULL,
  history_version_id bigint,
  share_release_id uuid,
  anchor_document jsonb NOT NULL,
  document_hash text NOT NULL,
  document_revision integer NOT NULL DEFAULT 1,
  projection_reference_date date NOT NULL,
  next_event_seq bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_comment_scopes_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_scopes_resume_id_fkey
    FOREIGN KEY (resume_id) REFERENCES public.resume_config (resume_id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_scopes_history_version_id_fkey
    FOREIGN KEY (history_version_id) REFERENCES public.resume_config_versions (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_scopes_share_release_id_fkey
    FOREIGN KEY (share_release_id) REFERENCES public.resume_share_releases (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_scopes_kind_check
    CHECK (kind IN ('working', 'history', 'share_release')),
  CONSTRAINT resume_comment_scopes_kind_reference_check
    CHECK (
      (kind = 'working' AND history_version_id IS NULL AND share_release_id IS NULL)
      OR (kind = 'history' AND history_version_id IS NOT NULL AND share_release_id IS NULL)
      OR (kind = 'share_release' AND history_version_id IS NULL AND share_release_id IS NOT NULL)
    ),
  CONSTRAINT resume_comment_scopes_document_revision_check
    CHECK (document_revision > 0),
  CONSTRAINT resume_comment_scopes_next_event_seq_check
    CHECK (next_event_seq >= 0),
  CONSTRAINT resume_comment_scopes_anchor_document_check
    CHECK (public.is_valid_resume_comment_anchor_document_check(anchor_document, document_hash))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_scopes_working_unique
  ON public.resume_comment_scopes (resume_id)
  WHERE kind = 'working';
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_scopes_history_unique
  ON public.resume_comment_scopes (history_version_id)
  WHERE kind = 'history';
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_scopes_share_release_unique
  ON public.resume_comment_scopes (share_release_id)
  WHERE kind = 'share_release';
CREATE INDEX IF NOT EXISTS idx_resume_comment_scopes_owner_resume
  ON public.resume_comment_scopes (owner_user_id, resume_id);

-- 实时协作网络仍负责文档同步；这两张表只保存评论权限所需的、可由
-- 服务端复核的会话与成员事实。浏览器不能直接写入，也不能自行声明角色。
CREATE TABLE IF NOT EXISTS public.resume_comment_collaboration_sessions (
  session_id text PRIMARY KEY,
  resume_id uuid NOT NULL,
  scope_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  host_lease_id uuid NOT NULL DEFAULT gen_random_uuid(),
  default_role text NOT NULL DEFAULT 'editor',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_comment_collaboration_sessions_resume_id_fkey
    FOREIGN KEY (resume_id) REFERENCES public.resume_config (resume_id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_collaboration_sessions_scope_id_fkey
    FOREIGN KEY (scope_id) REFERENCES public.resume_comment_scopes (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_collaboration_sessions_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_collaboration_sessions_id_check
    CHECK (session_id ~ '^[0-9A-Za-z_-]{16,64}$'),
  CONSTRAINT resume_comment_collaboration_sessions_role_check
    CHECK (default_role IN ('editor', 'viewer')),
  CONSTRAINT resume_comment_collaboration_sessions_expiry_check
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_resume_comment_collaboration_sessions_resume
  ON public.resume_comment_collaboration_sessions (resume_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS public.resume_comment_collaboration_members (
  session_id text NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id),
  CONSTRAINT resume_comment_collaboration_members_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.resume_comment_collaboration_sessions (session_id)
    ON DELETE CASCADE,
  CONSTRAINT resume_comment_collaboration_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_collaboration_members_role_check
    CHECK (role IN ('editor', 'viewer')),
  CONSTRAINT resume_comment_collaboration_members_expiry_check
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_resume_comment_collaboration_members_user
  ON public.resume_comment_collaboration_members (user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS public.resume_comment_anonymous_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL,
  secret_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT resume_comment_anonymous_identities_share_id_fkey
    FOREIGN KEY (share_id) REFERENCES public.resume_shares (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_anonymous_identities_secret_hash_check
    CHECK (char_length(secret_hash) BETWEEN 32 AND 256)
);

CREATE INDEX IF NOT EXISTS idx_resume_comment_anonymous_identities_share
  ON public.resume_comment_anonymous_identities (share_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.resume_comment_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL,
  anchor jsonb NOT NULL,
  anchor_status text NOT NULL DEFAULT 'anchored',
  original_page_index integer,
  revision integer NOT NULL DEFAULT 1,
  resolved_at timestamptz,
  resolved_by_kind text,
  resolved_by_id uuid,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_comment_threads_scope_id_fkey
    FOREIGN KEY (scope_id) REFERENCES public.resume_comment_scopes (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_threads_anchor_status_check
    CHECK (anchor_status IN ('anchored', 'detached')),
  CONSTRAINT resume_comment_threads_original_page_index_check
    CHECK (original_page_index IS NULL OR original_page_index >= 0),
  CONSTRAINT resume_comment_threads_revision_check
    CHECK (revision > 0),
  CONSTRAINT resume_comment_threads_resolved_actor_check
    CHECK (
      (resolved_at IS NULL AND resolved_by_kind IS NULL AND resolved_by_id IS NULL)
      OR (
        resolved_at IS NOT NULL
        AND resolved_by_kind IN ('user', 'anonymous')
        AND resolved_by_id IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_resume_comment_threads_scope_activity
  ON public.resume_comment_threads (scope_id, last_activity_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.resume_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  parent_id uuid,
  author_kind text NOT NULL,
  author_user_id uuid,
  author_anonymous_id uuid,
  body text NOT NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_comments_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.resume_comment_threads (id) ON DELETE CASCADE,
  CONSTRAINT resume_comments_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.resume_comments (id) ON DELETE CASCADE,
  CONSTRAINT resume_comments_author_user_id_fkey
    FOREIGN KEY (author_user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_comments_author_anonymous_id_fkey
    FOREIGN KEY (author_anonymous_id)
    REFERENCES public.resume_comment_anonymous_identities (id)
    ON DELETE CASCADE,
  CONSTRAINT resume_comments_author_check
    CHECK (
      (author_kind = 'user' AND author_user_id IS NOT NULL AND author_anonymous_id IS NULL)
      OR (
        author_kind = 'anonymous'
        AND author_user_id IS NULL
        AND author_anonymous_id IS NOT NULL
      )
    ),
  CONSTRAINT resume_comments_body_check
    CHECK (
      deleted_at IS NOT NULL
      OR (
        char_length(btrim(body)) BETWEEN 1 AND 8000
        AND translate(body, E'\t\n\r', '') !~ '[[:cntrl:]]'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comments_one_root_per_thread
  ON public.resume_comments (thread_id)
  WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_resume_comments_thread_created
  ON public.resume_comments (thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.resume_comment_read_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL,
  principal_kind text NOT NULL,
  principal_user_id uuid,
  principal_anonymous_id uuid,
  last_read_event_seq bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_comment_read_states_scope_id_fkey
    FOREIGN KEY (scope_id) REFERENCES public.resume_comment_scopes (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_read_states_user_id_fkey
    FOREIGN KEY (principal_user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_read_states_anonymous_id_fkey
    FOREIGN KEY (principal_anonymous_id)
    REFERENCES public.resume_comment_anonymous_identities (id)
    ON DELETE CASCADE,
  CONSTRAINT resume_comment_read_states_principal_check
    CHECK (
      (principal_kind = 'user' AND principal_user_id IS NOT NULL AND principal_anonymous_id IS NULL)
      OR (
        principal_kind = 'anonymous'
        AND principal_user_id IS NULL
        AND principal_anonymous_id IS NOT NULL
      )
    ),
  CONSTRAINT resume_comment_read_states_event_seq_check
    CHECK (last_read_event_seq >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_read_states_user_unique
  ON public.resume_comment_read_states (scope_id, principal_user_id)
  WHERE principal_kind = 'user';
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_read_states_anonymous_unique
  ON public.resume_comment_read_states (scope_id, principal_anonymous_id)
  WHERE principal_kind = 'anonymous';

CREATE TABLE IF NOT EXISTS public.resume_comment_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  scope_id uuid NOT NULL,
  thread_id uuid,
  event_seq bigint NOT NULL,
  type text NOT NULL,
  actor_kind text NOT NULL,
  actor_id uuid NOT NULL,
  sanitized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_comment_events_scope_id_fkey
    FOREIGN KEY (scope_id) REFERENCES public.resume_comment_scopes (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_events_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.resume_comment_threads (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_events_event_seq_check
    CHECK (event_seq > 0),
  CONSTRAINT resume_comment_events_type_check
    CHECK (type IN (
      'thread_created',
      'comment_replied',
      'comment_edited',
      'comment_deleted',
      'thread_deleted',
      'thread_resolved',
      'thread_reopened',
      'anchor_moved',
      'anchor_detached',
      'anchor_relinked',
      'document_synced',
      'settings_changed'
    )),
  CONSTRAINT resume_comment_events_actor_kind_check
    CHECK (actor_kind IN ('user', 'anonymous', 'system')),
  CONSTRAINT resume_comment_events_payload_check
    CHECK (
      jsonb_typeof(sanitized_payload) = 'object'
      AND NOT (sanitized_payload ?| ARRAY[
        'body',
        'secret',
        'secretHash',
        'networkKey',
        'actorKey'
      ])
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_events_scope_seq
  ON public.resume_comment_events (scope_id, event_seq);
CREATE INDEX IF NOT EXISTS idx_resume_comment_events_scope_created
  ON public.resume_comment_events (scope_id, created_at);

CREATE TABLE IF NOT EXISTS public.resume_comment_requests (
  actor_key text NOT NULL,
  request_id uuid NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (actor_key, request_id),
  CONSTRAINT resume_comment_requests_actor_key_check
    CHECK (char_length(actor_key) BETWEEN 3 AND 256),
  CONSTRAINT resume_comment_requests_response_check
    CHECK (response IS NULL OR jsonb_typeof(response) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_resume_comment_requests_created_at
  ON public.resume_comment_requests (created_at);

CREATE TABLE IF NOT EXISTS public.resume_comment_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  window_seconds integer NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_comment_rate_limits_bucket_key_check
    CHECK (char_length(bucket_key) BETWEEN 3 AND 512),
  CONSTRAINT resume_comment_rate_limits_window_seconds_check
    CHECK (window_seconds BETWEEN 1 AND 86400),
  CONSTRAINT resume_comment_rate_limits_attempt_count_check
    CHECK (attempt_count >= 0)
);

CREATE OR REPLACE FUNCTION public.set_resume_comment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_resume_comment_scopes_updated_at
  ON public.resume_comment_scopes;
CREATE TRIGGER set_resume_comment_scopes_updated_at
  BEFORE UPDATE ON public.resume_comment_scopes
  FOR EACH ROW EXECUTE FUNCTION public.set_resume_comment_updated_at();

DROP TRIGGER IF EXISTS set_resume_comment_collaboration_sessions_updated_at
  ON public.resume_comment_collaboration_sessions;
CREATE TRIGGER set_resume_comment_collaboration_sessions_updated_at
  BEFORE UPDATE ON public.resume_comment_collaboration_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_resume_comment_updated_at();

DROP TRIGGER IF EXISTS set_resume_comment_threads_updated_at
  ON public.resume_comment_threads;
CREATE TRIGGER set_resume_comment_threads_updated_at
  BEFORE UPDATE ON public.resume_comment_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_resume_comment_updated_at();

DROP TRIGGER IF EXISTS set_resume_comments_updated_at
  ON public.resume_comments;
CREATE TRIGGER set_resume_comments_updated_at
  BEFORE UPDATE ON public.resume_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_resume_comment_updated_at();

CREATE OR REPLACE FUNCTION public.validate_resume_comment_thread_anchor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_document jsonb;
  v_document_hash text;
BEGIN
  SELECT anchor_document, document_hash
  INTO v_document, v_document_hash
  FROM public.resume_comment_scopes
  WHERE id = NEW.scope_id;

  IF v_document IS NULL
    OR NOT public.is_valid_resume_comment_anchor_check(NEW.anchor, v_document)
    OR NEW.anchor ->> 'createdAtContentHash' <> v_document_hash THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid resume comment anchor';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_resume_comment_thread_anchor
  ON public.resume_comment_threads;
CREATE TRIGGER validate_resume_comment_thread_anchor
  BEFORE INSERT OR UPDATE OF scope_id, anchor
  ON public.resume_comment_threads
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_thread_anchor();

CREATE OR REPLACE FUNCTION public.validate_resume_comment_resolved_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_scope_kind text;
  v_scope_share_id uuid;
  v_identity_share_id uuid;
BEGIN
  IF NEW.resolved_at IS NULL OR NEW.resolved_by_kind <> 'anonymous' THEN
    RETURN NEW;
  END IF;

  SELECT scopes.kind, releases.share_id
  INTO v_scope_kind, v_scope_share_id
  FROM public.resume_comment_scopes AS scopes
  LEFT JOIN public.resume_share_releases AS releases
    ON releases.id = scopes.share_release_id
  WHERE scopes.id = NEW.scope_id;

  SELECT share_id
  INTO v_identity_share_id
  FROM public.resume_comment_anonymous_identities
  WHERE id = NEW.resolved_by_id
    AND revoked_at IS NULL;

  IF v_scope_kind <> 'share_release'
    OR v_scope_share_id IS NULL
    OR v_identity_share_id IS DISTINCT FROM v_scope_share_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'anonymous resolver does not belong to the thread share';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_resume_comment_resolved_actor
  ON public.resume_comment_threads;
CREATE CONSTRAINT TRIGGER validate_resume_comment_resolved_actor
  AFTER INSERT OR UPDATE OF scope_id, resolved_at, resolved_by_kind, resolved_by_id
  ON public.resume_comment_threads
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_resolved_actor();

CREATE OR REPLACE FUNCTION public.validate_resume_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_parent_thread_id uuid;
  v_parent_parent_id uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT thread_id, parent_id
  INTO v_parent_thread_id, v_parent_parent_id
  FROM public.resume_comments
  WHERE id = NEW.parent_id;

  IF NOT FOUND
    OR v_parent_thread_id <> NEW.thread_id
    OR v_parent_parent_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'reply must target the root comment in the same thread';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_resume_comment_parent
  ON public.resume_comments;
CREATE CONSTRAINT TRIGGER validate_resume_comment_parent
  AFTER INSERT OR UPDATE OF thread_id, parent_id
  ON public.resume_comments
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_parent();

CREATE OR REPLACE FUNCTION public.validate_resume_comment_author_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_scope_kind text;
  v_scope_share_id uuid;
  v_identity_share_id uuid;
BEGIN
  IF NEW.author_kind = 'user' THEN
    RETURN NEW;
  END IF;

  SELECT scopes.kind, releases.share_id
  INTO v_scope_kind, v_scope_share_id
  FROM public.resume_comment_threads AS threads
  JOIN public.resume_comment_scopes AS scopes ON scopes.id = threads.scope_id
  LEFT JOIN public.resume_share_releases AS releases
    ON releases.id = scopes.share_release_id
  WHERE threads.id = NEW.thread_id;

  SELECT share_id
  INTO v_identity_share_id
  FROM public.resume_comment_anonymous_identities
  WHERE id = NEW.author_anonymous_id
    AND revoked_at IS NULL;

  IF v_scope_kind <> 'share_release'
    OR v_scope_share_id IS NULL
    OR v_identity_share_id IS DISTINCT FROM v_scope_share_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'anonymous actor does not belong to the thread share';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_resume_comment_author_scope
  ON public.resume_comments;
CREATE CONSTRAINT TRIGGER validate_resume_comment_author_scope
  AFTER INSERT OR UPDATE OF thread_id, author_kind, author_anonymous_id
  ON public.resume_comments
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_author_scope();

CREATE OR REPLACE FUNCTION public.validate_resume_comment_event_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.resume_comment_threads
    WHERE id = NEW.thread_id
      AND scope_id = NEW.scope_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'event thread does not belong to event scope';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_resume_comment_event_scope
  ON public.resume_comment_events;
CREATE CONSTRAINT TRIGGER validate_resume_comment_event_scope
  AFTER INSERT OR UPDATE OF scope_id, thread_id
  ON public.resume_comment_events
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_event_scope();

CREATE OR REPLACE FUNCTION public.assert_resume_comment_anchor(
  p_scope_id uuid,
  p_anchor jsonb,
  p_expected_document_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scope public.resume_comment_scopes%ROWTYPE;
BEGIN
  SELECT *
  INTO v_scope
  FROM public.resume_comment_scopes
  WHERE id = p_scope_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'comment scope not found';
  END IF;

  IF v_scope.document_hash <> p_expected_document_hash THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'stale_document';
  END IF;

  IF NOT public.is_valid_resume_comment_anchor_check(p_anchor, v_scope.anchor_document)
    OR p_anchor ->> 'createdAtContentHash' <> p_expected_document_hash THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_selection';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_resume_comment_event_seq(
  p_scope_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_seq bigint;
BEGIN
  UPDATE public.resume_comment_scopes
  SET next_event_seq = next_event_seq + 1
  WHERE id = p_scope_id
  RETURNING next_event_seq INTO v_event_seq;

  IF v_event_seq IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'comment scope not found';
  END IF;

  RETURN v_event_seq;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_resume_comment_request(
  p_actor_key text,
  p_request_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF char_length(p_actor_key) NOT BETWEEN 3 AND 256 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid actor key';
  END IF;

  INSERT INTO public.resume_comment_requests (actor_key, request_id)
  VALUES (p_actor_key, p_request_id)
  ON CONFLICT (actor_key, request_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_resume_comment_rate_limit_bucket(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_row public.resume_comment_rate_limits%ROWTYPE;
  v_retry_after integer;
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 OR p_block_seconds <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid rate limit configuration';
  END IF;

  INSERT INTO public.resume_comment_rate_limits (
    bucket_key,
    window_started_at,
    window_seconds,
    attempt_count
  )
  VALUES (p_bucket_key, v_now, p_window_seconds, 0)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.resume_comment_rate_limits
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN GREATEST(1, ceil(extract(epoch FROM v_row.blocked_until - v_now))::integer);
  END IF;

  IF v_row.window_seconds <> p_window_seconds
    OR v_row.window_started_at + make_interval(secs => v_row.window_seconds) <= v_now THEN
    UPDATE public.resume_comment_rate_limits
    SET window_started_at = v_now,
        window_seconds = p_window_seconds,
        attempt_count = 1,
        blocked_until = NULL,
        updated_at = v_now
    WHERE bucket_key = p_bucket_key;
    RETURN 0;
  END IF;

  IF v_row.attempt_count + 1 > p_limit THEN
    UPDATE public.resume_comment_rate_limits
    SET attempt_count = attempt_count + 1,
        blocked_until = v_now + make_interval(secs => p_block_seconds),
        updated_at = v_now
    WHERE bucket_key = p_bucket_key
    RETURNING GREATEST(
      1,
      ceil(extract(epoch FROM blocked_until - v_now))::integer
    ) INTO v_retry_after;
    RETURN v_retry_after;
  END IF;

  UPDATE public.resume_comment_rate_limits
  SET attempt_count = attempt_count + 1,
      blocked_until = NULL,
      updated_at = v_now
  WHERE bucket_key = p_bucket_key;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_resume_comment_rate_limit(
  p_actor_key text,
  p_network_key text,
  p_share_id uuid,
  p_thread_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_limit integer := CASE
    WHEN p_actor_key LIKE 'anonymous:%' THEN 10
    ELSE 30
  END;
  v_retry_after integer := 0;
BEGIN
  v_retry_after := GREATEST(
    v_retry_after,
    public.consume_resume_comment_rate_limit_bucket(
      'actor:' || md5(p_actor_key),
      v_actor_limit,
      60,
      60
    )
  );

  IF p_share_id IS NOT NULL AND coalesce(p_network_key, '') <> '' THEN
    v_retry_after := GREATEST(
      v_retry_after,
      public.consume_resume_comment_rate_limit_bucket(
        'network-share:' || p_network_key || ':' || p_share_id::text,
        30,
        60,
        60
      )
    );
  END IF;

  IF p_thread_id IS NOT NULL THEN
    v_retry_after := GREATEST(
      v_retry_after,
      public.consume_resume_comment_rate_limit_bucket(
        'actor-thread:' || md5(p_actor_key) || ':' || p_thread_id::text,
        5,
        10,
        60
      )
    );
  END IF;

  RETURN v_retry_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_resume_comment_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin');
$$;

CREATE OR REPLACE FUNCTION public.assert_resume_comment_service_role()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_resume_comment_service_role() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service role required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_resume_working_comment_scope(
  p_owner_user_id uuid,
  p_resume_id uuid,
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
  v_scope_id uuid;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF NOT EXISTS (
    SELECT 1
    FROM public.resume_config
    WHERE resume_id = p_resume_id
      AND user_id = p_owner_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume not found';
  END IF;

  IF NOT public.is_valid_resume_comment_anchor_document(p_anchor_document, p_document_hash) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid anchor document';
  END IF;

  INSERT INTO public.resume_comment_scopes (
    kind,
    owner_user_id,
    resume_id,
    anchor_document,
    document_hash,
    projection_reference_date
  )
  VALUES (
    'working',
    p_owner_user_id,
    p_resume_id,
    p_anchor_document,
    p_document_hash,
    p_projection_reference_date
  )
  ON CONFLICT (resume_id) WHERE kind = 'working' DO NOTHING
  RETURNING id INTO v_scope_id;

  IF v_scope_id IS NULL THEN
    SELECT id
    INTO v_scope_id
    FROM public.resume_comment_scopes
    WHERE kind = 'working'
      AND resume_id = p_resume_id
      AND owner_user_id = p_owner_user_id;
  END IF;

  IF v_scope_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'working scope belongs to another owner';
  END IF;

  RETURN v_scope_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_resume_history_comment_scope(
  p_owner_user_id uuid,
  p_history_version_id bigint,
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
  v_resume_id uuid;
  v_scope_id uuid;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  SELECT resume_id
  INTO v_resume_id
  FROM public.resume_config_versions
  WHERE id = p_history_version_id
    AND user_id = p_owner_user_id;

  IF v_resume_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'history version not found';
  END IF;

  IF NOT public.is_valid_resume_comment_anchor_document(p_anchor_document, p_document_hash) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid anchor document';
  END IF;

  INSERT INTO public.resume_comment_scopes (
    kind,
    owner_user_id,
    resume_id,
    history_version_id,
    anchor_document,
    document_hash,
    projection_reference_date
  )
  VALUES (
    'history',
    p_owner_user_id,
    v_resume_id,
    p_history_version_id,
    p_anchor_document,
    p_document_hash,
    p_projection_reference_date
  )
  ON CONFLICT (history_version_id) WHERE kind = 'history' DO NOTHING
  RETURNING id INTO v_scope_id;

  IF v_scope_id IS NULL THEN
    SELECT id
    INTO v_scope_id
    FROM public.resume_comment_scopes
    WHERE kind = 'history'
      AND history_version_id = p_history_version_id
      AND owner_user_id = p_owner_user_id;
  END IF;

  IF v_scope_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'history scope belongs to another owner';
  END IF;

  RETURN v_scope_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_resume_share_release_comment_scope(
  p_share_release_id uuid,
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
  v_release public.resume_share_releases%ROWTYPE;
  v_share public.resume_shares%ROWTYPE;
  v_scope_id uuid;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  SELECT *
  INTO v_release
  FROM public.resume_share_releases
  WHERE id = p_share_release_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'share release not found';
  END IF;

  SELECT *
  INTO v_share
  FROM public.resume_shares
  WHERE id = v_release.share_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'share not found';
  END IF;

  IF NOT public.is_valid_resume_comment_anchor_document(p_anchor_document, p_document_hash) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid anchor document';
  END IF;

  INSERT INTO public.resume_comment_scopes (
    kind,
    owner_user_id,
    resume_id,
    share_release_id,
    anchor_document,
    document_hash,
    projection_reference_date
  )
  VALUES (
    'share_release',
    v_share.user_id,
    v_share.resume_id,
    p_share_release_id,
    p_anchor_document,
    p_document_hash,
    p_projection_reference_date
  )
  ON CONFLICT (share_release_id) WHERE kind = 'share_release' DO NOTHING
  RETURNING id INTO v_scope_id;

  IF v_scope_id IS NULL THEN
    SELECT id
    INTO v_scope_id
    FROM public.resume_comment_scopes
    WHERE kind = 'share_release'
      AND share_release_id = p_share_release_id;
  END IF;

  RETURN v_scope_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_resume_working_comment_document(
  p_scope_id uuid,
  p_anchor_document jsonb,
  p_document_hash text,
  p_expected_document_revision integer,
  p_projection_reference_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_revision integer;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF NOT public.is_valid_resume_comment_anchor_document(p_anchor_document, p_document_hash) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid anchor document';
  END IF;

  UPDATE public.resume_comment_scopes
  SET anchor_document = p_anchor_document,
      document_hash = p_document_hash,
      document_revision = document_revision + 1,
      projection_reference_date = p_projection_reference_date
  WHERE id = p_scope_id
    AND kind = 'working'
    AND document_revision = p_expected_document_revision
  RETURNING document_revision INTO v_revision;

  IF v_revision IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.resume_comment_scopes
      WHERE id = p_scope_id
        AND kind = 'working'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'stale_document';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'working scope not found';
  END IF;

  RETURN v_revision;
END;
$$;

-- 第一个迁移中的发布函数尚未创建评论空间。删除旧签名，换成必须同时
-- 提供权威锚点文档的原子版本，杜绝“release 已切换但 scope 缺失”。
DROP FUNCTION IF EXISTS public.publish_resume_share_release(
  uuid,
  jsonb,
  jsonb,
  text,
  text,
  bigint,
  integer,
  text,
  timestamptz
);

CREATE OR REPLACE FUNCTION public.publish_resume_share_release(
  p_share_id uuid,
  p_snapshot jsonb,
  p_template_manifest jsonb,
  p_display_name text,
  p_source_kind text,
  p_source_version_id bigint,
  p_source_version_no integer,
  p_source_version_label text,
  p_source_version_created_at timestamptz,
  p_anchor_document jsonb,
  p_document_hash text,
  p_projection_reference_date date
)
RETURNS TABLE (
  release_id uuid,
  release_no integer,
  scope_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_share public.resume_shares%ROWTYPE;
  v_release_id uuid;
  v_release_no integer;
  v_scope_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT *
  INTO v_share
  FROM public.resume_shares
  WHERE id = p_share_id
  FOR UPDATE;

  IF NOT FOUND OR v_share.user_id <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume share not found';
  END IF;

  IF v_share.archived_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'archived resume share cannot be published';
  END IF;

  IF p_snapshot IS NULL
    OR jsonb_typeof(p_snapshot) <> 'object'
    OR p_template_manifest IS NULL
    OR jsonb_typeof(p_template_manifest) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'snapshot and template manifest must be objects';
  END IF;

  IF NOT public.is_valid_resume_comment_anchor_document(p_anchor_document, p_document_hash) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid anchor document';
  END IF;

  IF p_source_kind = 'current' THEN
    IF p_source_version_id IS NOT NULL
      OR p_source_version_no IS NOT NULL
      OR p_source_version_label IS NOT NULL
      OR p_source_version_created_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'current source cannot include history metadata';
    END IF;
  ELSIF p_source_kind = 'history' THEN
    IF p_source_version_id IS NULL
      OR p_source_version_no IS NULL
      OR p_source_version_label IS NULL
      OR p_source_version_created_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'history source metadata is incomplete';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid source kind';
  END IF;

  SELECT COALESCE(MAX(releases.release_no), 0) + 1
  INTO v_release_no
  FROM public.resume_share_releases AS releases
  WHERE releases.share_id = p_share_id;

  INSERT INTO public.resume_share_releases (
    share_id,
    release_no,
    snapshot,
    template_manifest,
    display_name,
    source_kind,
    source_version_id,
    source_version_no,
    source_version_label,
    source_version_created_at,
    created_by
  )
  VALUES (
    p_share_id,
    v_release_no,
    p_snapshot,
    p_template_manifest,
    p_display_name,
    p_source_kind,
    p_source_version_id,
    p_source_version_no,
    p_source_version_label,
    p_source_version_created_at,
    auth.uid()
  )
  RETURNING id INTO v_release_id;

  INSERT INTO public.resume_comment_scopes (
    kind,
    owner_user_id,
    resume_id,
    share_release_id,
    anchor_document,
    document_hash,
    projection_reference_date
  )
  VALUES (
    'share_release',
    v_share.user_id,
    v_share.resume_id,
    v_release_id,
    p_anchor_document,
    p_document_hash,
    p_projection_reference_date
  )
  RETURNING id INTO v_scope_id;

  UPDATE public.resume_shares
  SET current_release_id = v_release_id,
      snapshot = p_snapshot,
      template_manifest = p_template_manifest,
      display_name = p_display_name,
      source_kind = p_source_kind,
      source_version_id = p_source_version_id,
      source_version_no = p_source_version_no,
      source_version_label = p_source_version_label,
      source_version_created_at = p_source_version_created_at,
      updated_at = now()
  WHERE id = p_share_id;

  RETURN QUERY SELECT v_release_id, v_release_no, v_scope_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_resume_share(
  p_share_id uuid,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  IF v_actor_user_id IS NULL THEN
    PERFORM public.assert_resume_comment_service_role();
    v_actor_user_id := p_owner_user_id;
  END IF;

  UPDATE public.resume_shares
  SET archived_at = coalesce(archived_at, now()),
      is_active = false,
      updated_at = now()
  WHERE id = p_share_id
    AND user_id = v_actor_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume share not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_resume_share_permanently(
  p_share_id uuid,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  IF v_actor_user_id IS NULL THEN
    PERFORM public.assert_resume_comment_service_role();
    v_actor_user_id := p_owner_user_id;
  END IF;

  DELETE FROM public.resume_shares
  WHERE id = p_share_id
    AND user_id = v_actor_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume share not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_resume_history_version_with_comments(
  p_history_version_id bigint,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  IF v_actor_user_id IS NULL THEN
    PERFORM public.assert_resume_comment_service_role();
    v_actor_user_id := p_owner_user_id;
  END IF;

  DELETE FROM public.resume_config_versions
  WHERE id = p_history_version_id
    AND user_id = v_actor_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'history version not found';
  END IF;
END;
$$;

-- 评论正文与身份数据不向浏览器直连开放。Edge Function 使用 service_role
-- 访问真源；Realtime 只消费后续服务端发布的脱敏失效通知。
ALTER TABLE public.resume_comment_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_collaboration_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_anonymous_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_read_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resume_comment_scopes
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_collaboration_sessions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_collaboration_members
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_threads
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comments
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_anonymous_identities
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_read_states
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_events
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_requests
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_rate_limits
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_scopes
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_collaboration_sessions
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_collaboration_members
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_threads
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comments
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_anonymous_identities
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_read_states
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_events
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_requests
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_comment_rate_limits
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.resume_comment_events_id_seq
  TO service_role;

REVOKE ALL ON FUNCTION public.assert_resume_comment_anchor(uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_resume_comment_event_seq(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_resume_comment_request(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_resume_comment_rate_limit_bucket(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_resume_comment_rate_limit(text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_resume_working_comment_scope(uuid, uuid, jsonb, text, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_resume_history_comment_scope(uuid, bigint, jsonb, text, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_resume_share_release_comment_scope(uuid, jsonb, text, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_resume_working_comment_document(uuid, jsonb, text, integer, date)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assert_resume_comment_anchor(uuid, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.next_resume_comment_event_seq(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_resume_comment_request(text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_resume_comment_rate_limit_bucket(text, integer, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.check_resume_comment_rate_limit(text, text, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_resume_working_comment_scope(uuid, uuid, jsonb, text, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_resume_history_comment_scope(uuid, bigint, jsonb, text, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_resume_share_release_comment_scope(uuid, jsonb, text, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_resume_working_comment_document(uuid, jsonb, text, integer, date)
  TO service_role;

REVOKE ALL ON FUNCTION public.publish_resume_share_release(
  uuid,
  jsonb,
  jsonb,
  text,
  text,
  bigint,
  integer,
  text,
  timestamptz,
  jsonb,
  text,
  date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_resume_share_release(
  uuid,
  jsonb,
  jsonb,
  text,
  text,
  bigint,
  integer,
  text,
  timestamptz,
  jsonb,
  text,
  date
) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_resume_share(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_resume_share_permanently(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_resume_history_version_with_comments(bigint, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_resume_share(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_resume_share_permanently(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_resume_history_version_with_comments(bigint, uuid)
  TO authenticated, service_role;
