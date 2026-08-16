-- Keep the local ledger version aligned with the already-applied remote migration.
CREATE TABLE private.resume_comment_thread_read_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES public.resume_comment_scopes (id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.resume_comment_threads (id) ON DELETE CASCADE,
  principal_kind text NOT NULL,
  principal_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  principal_anonymous_id uuid REFERENCES public.resume_comment_anonymous_identities (id) ON DELETE CASCADE,
  last_read_event_seq bigint NOT NULL DEFAULT 0 CHECK (last_read_event_seq >= 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT resume_comment_thread_read_states_principal_check CHECK (
    (
      principal_kind = 'user'
      AND principal_user_id IS NOT NULL
      AND principal_anonymous_id IS NULL
    )
    OR (
      principal_kind = 'anonymous'
      AND principal_user_id IS NULL
      AND principal_anonymous_id IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX resume_comment_thread_read_states_user_unique
  ON private.resume_comment_thread_read_states (scope_id, thread_id, principal_user_id)
  WHERE principal_kind = 'user';

CREATE UNIQUE INDEX resume_comment_thread_read_states_anonymous_unique
  ON private.resume_comment_thread_read_states (scope_id, thread_id, principal_anonymous_id)
  WHERE principal_kind = 'anonymous';

CREATE INDEX resume_comment_thread_read_states_scope_thread_idx
  ON private.resume_comment_thread_read_states (scope_id, thread_id);

CREATE INDEX resume_comment_thread_read_states_thread_fk_idx
  ON private.resume_comment_thread_read_states (thread_id);

CREATE INDEX resume_comment_thread_read_states_user_fk_idx
  ON private.resume_comment_thread_read_states (principal_user_id, scope_id, thread_id)
  WHERE principal_user_id IS NOT NULL;

CREATE INDEX resume_comment_thread_read_states_anonymous_fk_idx
  ON private.resume_comment_thread_read_states (principal_anonymous_id, scope_id, thread_id)
  WHERE principal_anonymous_id IS NOT NULL;

ALTER TABLE private.resume_comment_thread_read_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.resume_comment_thread_read_states
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.upsert_resume_comment_thread_read_state_v1(
  p_scope_id uuid,
  p_thread_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_event_seq bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_actor_kind = 'user' THEN
    INSERT INTO private.resume_comment_thread_read_states (
      scope_id,
      thread_id,
      principal_kind,
      principal_user_id,
      last_read_event_seq
    ) VALUES (
      p_scope_id,
      p_thread_id,
      'user',
      p_actor_id,
      p_event_seq
    )
    ON CONFLICT (scope_id, thread_id, principal_user_id)
      WHERE principal_kind = 'user'
    DO UPDATE SET
      last_read_event_seq = GREATEST(
        private.resume_comment_thread_read_states.last_read_event_seq,
        EXCLUDED.last_read_event_seq
      ),
      updated_at = pg_catalog.now();
  ELSIF p_actor_kind = 'anonymous' THEN
    INSERT INTO private.resume_comment_thread_read_states (
      scope_id,
      thread_id,
      principal_kind,
      principal_anonymous_id,
      last_read_event_seq
    ) VALUES (
      p_scope_id,
      p_thread_id,
      'anonymous',
      p_actor_id,
      p_event_seq
    )
    ON CONFLICT (scope_id, thread_id, principal_anonymous_id)
      WHERE principal_kind = 'anonymous'
    DO UPDATE SET
      last_read_event_seq = GREATEST(
        private.resume_comment_thread_read_states.last_read_event_seq,
        EXCLUDED.last_read_event_seq
      ),
      updated_at = pg_catalog.now();
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'unauthorized';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.build_resume_comment_thread_read_states_v1(
  p_access jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH access_values AS MATERIALIZED (
    SELECT
      (p_access ->> 'scopeId')::uuid AS scope_id,
      p_access ->> 'actorKind' AS actor_kind,
      (p_access ->> 'actorId')::uuid AS actor_id
  ),
  global_cursor AS MATERIALIZED (
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
  active_threads AS MATERIALIZED (
    SELECT threads.id
    FROM public.resume_comment_threads AS threads
    JOIN access_values AS access ON access.scope_id = threads.scope_id
    WHERE threads.deleted_at IS NULL
  ),
  latest_events AS MATERIALIZED (
    SELECT
      threads.id AS thread_id,
      coalesce(max(events.event_seq) FILTER (
        WHERE events.type IN ('thread_created', 'comment_replied')
      ), 0) AS latest_comment_event_seq
    FROM active_threads AS threads
    LEFT JOIN public.resume_comment_events AS events
      ON events.thread_id = threads.id
    GROUP BY threads.id
  ),
  actor_states AS MATERIALIZED (
    SELECT
      states.thread_id,
      states.last_read_event_seq
    FROM private.resume_comment_thread_read_states AS states
    JOIN access_values AS access ON access.scope_id = states.scope_id
    WHERE (
      access.actor_kind = 'user'
      AND states.principal_kind = 'user'
      AND states.principal_user_id = access.actor_id
    ) OR (
      access.actor_kind = 'anonymous'
      AND states.principal_kind = 'anonymous'
      AND states.principal_anonymous_id = access.actor_id
    )
  )
  SELECT coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'threadId', latest.thread_id,
        'latestCommentEventSeq', latest.latest_comment_event_seq,
        'lastReadEventSeq', GREATEST(
          cursor.value,
          coalesce(states.last_read_event_seq, 0)
        ),
        'unread', latest.latest_comment_event_seq > GREATEST(
          cursor.value,
          coalesce(states.last_read_event_seq, 0)
        )
      )
      ORDER BY latest.thread_id
    ),
    '[]'::jsonb
  )
  FROM latest_events AS latest
  LEFT JOIN actor_states AS states ON states.thread_id = latest.thread_id
  CROSS JOIN global_cursor AS cursor;
$$;

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
AS $$
DECLARE
  v_scope public.resume_comment_scopes%ROWTYPE;
  v_latest_event_seq bigint;
  v_target_event_seq bigint;
  v_scope_read_event_seq bigint := 0;
  v_has_unread boolean;
  v_response jsonb;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF p_actor_kind NOT IN ('user', 'anonymous') OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'unauthorized';
  END IF;

  SELECT scopes.*
  INTO v_scope
  FROM public.resume_comment_scopes AS scopes
  WHERE scopes.id = p_scope_id
    AND scopes.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  SELECT coalesce(max(events.event_seq), 0)
  INTO v_latest_event_seq
  FROM public.resume_comment_threads AS threads
  LEFT JOIN public.resume_comment_events AS events
    ON events.thread_id = threads.id
   AND events.type IN ('thread_created', 'comment_replied')
  WHERE threads.id = p_thread_id
    AND threads.scope_id = p_scope_id
    AND threads.deleted_at IS NULL
  GROUP BY threads.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  INSERT INTO public.resume_comment_requests (actor_key, request_id)
  VALUES (p_actor_key, p_request_id)
  ON CONFLICT (actor_key, request_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT requests.response
    INTO v_response
    FROM public.resume_comment_requests AS requests
    WHERE requests.actor_key = p_actor_key
      AND requests.request_id = p_request_id
    FOR UPDATE;
    IF v_response IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'request_in_progress';
    END IF;
    RETURN v_response;
  END IF;

  v_target_event_seq := LEAST(
    GREATEST(coalesce(p_event_seq, 0), 0),
    v_latest_event_seq
  );
  PERFORM private.upsert_resume_comment_thread_read_state_v1(
    p_scope_id,
    p_thread_id,
    p_actor_kind,
    p_actor_id,
    v_target_event_seq
  );

  IF p_actor_kind = 'user' THEN
    SELECT coalesce(states.last_read_event_seq, 0)
    INTO v_scope_read_event_seq
    FROM public.resume_comment_read_states AS states
    WHERE states.scope_id = p_scope_id
      AND states.principal_kind = 'user'
      AND states.principal_user_id = p_actor_id;
  ELSE
    SELECT coalesce(states.last_read_event_seq, 0)
    INTO v_scope_read_event_seq
    FROM public.resume_comment_read_states AS states
    WHERE states.scope_id = p_scope_id
      AND states.principal_kind = 'anonymous'
      AND states.principal_anonymous_id = p_actor_id;
  END IF;
  v_scope_read_event_seq := coalesce(v_scope_read_event_seq, 0);

  SELECT EXISTS (
    SELECT 1
    FROM public.resume_comment_threads AS threads
    JOIN LATERAL (
      SELECT coalesce(max(events.event_seq), 0) AS latest_event_seq
      FROM public.resume_comment_events AS events
      WHERE events.thread_id = threads.id
        AND events.type IN ('thread_created', 'comment_replied')
    ) AS latest ON true
    LEFT JOIN private.resume_comment_thread_read_states AS states
      ON states.scope_id = p_scope_id
     AND states.thread_id = threads.id
     AND (
       (
         p_actor_kind = 'user'
         AND states.principal_kind = 'user'
         AND states.principal_user_id = p_actor_id
       )
       OR (
         p_actor_kind = 'anonymous'
         AND states.principal_kind = 'anonymous'
         AND states.principal_anonymous_id = p_actor_id
       )
     )
    WHERE threads.scope_id = p_scope_id
      AND threads.deleted_at IS NULL
      AND latest.latest_event_seq > GREATEST(
        v_scope_read_event_seq,
        coalesce(states.last_read_event_seq, 0)
      )
  ) INTO v_has_unread;

  IF NOT v_has_unread THEN
    v_scope_read_event_seq := v_scope.next_event_seq;
    IF p_actor_kind = 'user' THEN
      INSERT INTO public.resume_comment_read_states (
        scope_id, principal_kind, principal_user_id, last_read_event_seq
      ) VALUES (p_scope_id, 'user', p_actor_id, v_scope_read_event_seq)
      ON CONFLICT (scope_id, principal_user_id) WHERE principal_kind = 'user'
      DO UPDATE SET
        last_read_event_seq = GREATEST(
          public.resume_comment_read_states.last_read_event_seq,
          EXCLUDED.last_read_event_seq
        ),
        updated_at = pg_catalog.now();
    ELSE
      INSERT INTO public.resume_comment_read_states (
        scope_id, principal_kind, principal_anonymous_id, last_read_event_seq
      ) VALUES (p_scope_id, 'anonymous', p_actor_id, v_scope_read_event_seq)
      ON CONFLICT (scope_id, principal_anonymous_id) WHERE principal_kind = 'anonymous'
      DO UPDATE SET
        last_read_event_seq = GREATEST(
          public.resume_comment_read_states.last_read_event_seq,
          EXCLUDED.last_read_event_seq
        ),
        updated_at = pg_catalog.now();
    END IF;
  END IF;

  v_response := pg_catalog.jsonb_build_object(
    'eventSeq', v_target_event_seq,
    'scopeLastReadEventSeq', v_scope_read_event_seq,
    'threadId', p_thread_id
  );
  UPDATE public.resume_comment_requests
  SET response = v_response, completed_at = pg_catalog.now()
  WHERE actor_key = p_actor_key AND request_id = p_request_id;
  RETURN v_response;
END;
$$;

ALTER FUNCTION public.execute_resume_version_comment_write(
  text, uuid, text, uuid, text, uuid, jsonb
) RENAME TO execute_resume_version_comment_write_without_thread_reads_v1;

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
AS $$
DECLARE
  v_response jsonb;
  v_previous_read_event_seq bigint;
  v_had_read_state boolean := false;
  v_thread_id uuid;
  v_event_seq bigint;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  PERFORM 1
  FROM public.resume_comment_scopes AS scopes
  WHERE scopes.id = p_scope_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  IF p_op <> 'mark_read' THEN
    IF p_actor_kind = 'user' THEN
      SELECT states.last_read_event_seq
      INTO v_previous_read_event_seq
      FROM public.resume_comment_read_states AS states
      WHERE states.scope_id = p_scope_id
        AND states.principal_kind = 'user'
        AND states.principal_user_id = p_actor_id
      FOR UPDATE;
    ELSE
      SELECT states.last_read_event_seq
      INTO v_previous_read_event_seq
      FROM public.resume_comment_read_states AS states
      WHERE states.scope_id = p_scope_id
        AND states.principal_kind = 'anonymous'
        AND states.principal_anonymous_id = p_actor_id
      FOR UPDATE;
    END IF;
    v_had_read_state := FOUND;
  END IF;

  v_response := public.execute_resume_version_comment_write_without_thread_reads_v1(
    p_op,
    p_scope_id,
    p_actor_kind,
    p_actor_id,
    p_actor_key,
    p_request_id,
    p_payload
  );

  IF p_op <> 'mark_read' THEN
    IF v_had_read_state THEN
      UPDATE public.resume_comment_read_states
      SET last_read_event_seq = v_previous_read_event_seq,
          updated_at = pg_catalog.now()
      WHERE scope_id = p_scope_id
        AND (
          (
            p_actor_kind = 'user'
            AND principal_kind = 'user'
            AND principal_user_id = p_actor_id
          )
          OR (
            p_actor_kind = 'anonymous'
            AND principal_kind = 'anonymous'
            AND principal_anonymous_id = p_actor_id
          )
        );
    ELSE
      DELETE FROM public.resume_comment_read_states
      WHERE scope_id = p_scope_id
        AND (
          (
            p_actor_kind = 'user'
            AND principal_kind = 'user'
            AND principal_user_id = p_actor_id
          )
          OR (
            p_actor_kind = 'anonymous'
            AND principal_kind = 'anonymous'
            AND principal_anonymous_id = p_actor_id
          )
        );
    END IF;

    IF p_op IN ('create_thread', 'create_reply') THEN
      v_thread_id := nullif(v_response ->> 'threadId', '')::uuid;
      v_event_seq := coalesce((v_response ->> 'eventSeq')::bigint, 0);
      IF v_thread_id IS NOT NULL THEN
        PERFORM private.upsert_resume_comment_thread_read_state_v1(
          p_scope_id,
          v_thread_id,
          p_actor_kind,
          p_actor_id,
          v_event_seq
        );
      END IF;
    END IF;
  ELSE
    DELETE FROM private.resume_comment_thread_read_states AS states
    WHERE states.scope_id = p_scope_id
      AND states.last_read_event_seq <= coalesce((v_response ->> 'eventSeq')::bigint, 0)
      AND (
        (
          p_actor_kind = 'user'
          AND states.principal_kind = 'user'
          AND states.principal_user_id = p_actor_id
        )
        OR (
          p_actor_kind = 'anonymous'
          AND states.principal_kind = 'anonymous'
          AND states.principal_anonymous_id = p_actor_id
        )
      );
  END IF;
  RETURN v_response;
END;
$$;

ALTER FUNCTION public.sync_resume_version_comment_document_v3(
  uuid, bigint, uuid, jsonb, jsonb, text, integer, date, jsonb, text, uuid
) RENAME TO sync_resume_version_comment_document_without_read_cursor_v1;

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
AS $$
DECLARE
  v_response jsonb;
  v_previous_read_event_seq bigint;
  v_had_read_state boolean := false;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  PERFORM 1
  FROM public.resume_comment_scopes AS scopes
  WHERE scopes.id = p_scope_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  SELECT states.last_read_event_seq
  INTO v_previous_read_event_seq
  FROM public.resume_comment_read_states AS states
  WHERE states.scope_id = p_scope_id
    AND states.principal_kind = 'user'
    AND states.principal_user_id = p_owner_user_id
  FOR UPDATE;
  v_had_read_state := FOUND;

  v_response := public.sync_resume_version_comment_document_without_read_cursor_v1(
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

  IF v_had_read_state THEN
    UPDATE public.resume_comment_read_states
    SET last_read_event_seq = v_previous_read_event_seq,
        updated_at = pg_catalog.now()
    WHERE scope_id = p_scope_id
      AND principal_kind = 'user'
      AND principal_user_id = p_owner_user_id;
  ELSE
    DELETE FROM public.resume_comment_read_states
    WHERE scope_id = p_scope_id
      AND principal_kind = 'user'
      AND principal_user_id = p_owner_user_id;
  END IF;
  RETURN v_response;
END;
$$;

ALTER FUNCTION private.build_resume_comment_bootstrap_v1(jsonb)
  RENAME TO build_resume_comment_bootstrap_without_thread_reads_v1;

CREATE OR REPLACE FUNCTION private.build_resume_comment_bootstrap_v1(
  p_access jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_set(
    private.build_resume_comment_bootstrap_without_thread_reads_v1(p_access),
    '{bootstrap,threadReadStates}',
    private.build_resume_comment_thread_read_states_v1(p_access),
    true
  );
$$;

REVOKE ALL ON FUNCTION private.upsert_resume_comment_thread_read_state_v1(
  uuid, uuid, text, uuid, bigint
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.build_resume_comment_thread_read_states_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.build_resume_comment_bootstrap_without_thread_reads_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.build_resume_comment_bootstrap_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_resume_comment_thread_read_v1(
  uuid, uuid, text, uuid, text, uuid, bigint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_resume_comment_thread_read_v1(
  uuid, uuid, text, uuid, text, uuid, bigint
) TO service_role;

REVOKE ALL ON FUNCTION public.execute_resume_version_comment_write_without_thread_reads_v1(
  text, uuid, text, uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.execute_resume_version_comment_write(
  text, uuid, text, uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_resume_version_comment_write(
  text, uuid, text, uuid, text, uuid, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.sync_resume_version_comment_document_without_read_cursor_v1(
  uuid, bigint, uuid, jsonb, jsonb, text, integer, date, jsonb, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_resume_version_comment_document_v3(
  uuid, bigint, uuid, jsonb, jsonb, text, integer, date, jsonb, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_resume_version_comment_document_v3(
  uuid, bigint, uuid, jsonb, jsonb, text, integer, date, jsonb, text, uuid
) TO service_role;
