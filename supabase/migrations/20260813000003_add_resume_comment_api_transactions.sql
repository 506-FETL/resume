CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_anonymous_secret_unique
  ON public.resume_comment_anonymous_identities (share_id, secret_hash);

CREATE OR REPLACE FUNCTION public.append_resume_comment_event(
  p_scope_id uuid,
  p_thread_id uuid,
  p_type text,
  p_actor_kind text,
  p_actor_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_seq bigint;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  v_event_seq := public.next_resume_comment_event_seq(p_scope_id);
  INSERT INTO public.resume_comment_events (
    scope_id,
    thread_id,
    event_seq,
    type,
    actor_kind,
    actor_id,
    sanitized_payload
  )
  VALUES (
    p_scope_id,
    p_thread_id,
    v_event_seq,
    p_type,
    p_actor_kind,
    p_actor_id,
    coalesce(p_payload, '{}'::jsonb)
  );
  RETURN v_event_seq;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_resume_comment_anonymous_identity(
  p_share_id uuid,
  p_scope_id uuid,
  p_secret_hash text,
  p_actor_key text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity_id uuid;
  v_response jsonb;
  v_event_seq bigint;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  INSERT INTO public.resume_comment_requests (actor_key, request_id)
  VALUES (p_actor_key, p_request_id)
  ON CONFLICT (actor_key, request_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT response INTO v_response
    FROM public.resume_comment_requests
    WHERE actor_key = p_actor_key AND request_id = p_request_id
    FOR UPDATE;
    IF v_response IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'request_in_progress';
    END IF;
    RETURN v_response;
  END IF;

  SELECT scopes.next_event_seq
  INTO v_event_seq
  FROM public.resume_comment_scopes AS scopes
  JOIN public.resume_share_releases AS releases
    ON releases.id = scopes.share_release_id
  JOIN public.resume_shares AS shares
    ON shares.id = releases.share_id
  WHERE scopes.id = p_scope_id
    AND scopes.kind = 'share_release'
    AND shares.id = p_share_id
    AND shares.current_release_id = releases.id
    AND shares.archived_at IS NULL
    AND shares.is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'share_unavailable';
  END IF;

  INSERT INTO public.resume_comment_anonymous_identities (share_id, secret_hash)
  VALUES (p_share_id, p_secret_hash)
  ON CONFLICT (share_id, secret_hash) DO UPDATE
  SET last_seen_at = now()
  RETURNING id INTO v_identity_id;

  v_response := jsonb_build_object(
    'anonymousId', v_identity_id,
    'eventSeq', v_event_seq
  );
  UPDATE public.resume_comment_requests
  SET response = v_response, completed_at = now()
  WHERE actor_key = p_actor_key AND request_id = p_request_id;
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_resume_comment_write(
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
  v_scope public.resume_comment_scopes%ROWTYPE;
  v_thread public.resume_comment_threads%ROWTYPE;
  v_comment public.resume_comments%ROWTYPE;
  v_thread_id uuid;
  v_comment_id uuid;
  v_parent_id uuid;
  v_expected_revision integer;
  v_event_seq bigint;
  v_response jsonb;
  v_manage_all boolean := coalesce((p_payload ->> 'manageAll')::boolean, false);
  v_legacy_anonymous_id uuid := nullif(p_payload ->> 'legacyAnonymousId', '')::uuid;
  v_is_root_author boolean := false;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF p_actor_kind NOT IN ('user', 'anonymous') OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'unauthorized';
  END IF;
  IF p_op NOT IN (
    'create_thread',
    'create_reply',
    'edit_comment',
    'delete_comment',
    'delete_thread',
    'resolve_thread',
    'reopen_thread',
    'relink_anchor',
    'mark_read'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'not_found';
  END IF;

  SELECT * INTO v_scope
  FROM public.resume_comment_scopes
  WHERE id = p_scope_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  INSERT INTO public.resume_comment_requests (actor_key, request_id)
  VALUES (p_actor_key, p_request_id)
  ON CONFLICT (actor_key, request_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT response INTO v_response
    FROM public.resume_comment_requests
    WHERE actor_key = p_actor_key AND request_id = p_request_id
    FOR UPDATE;
    IF v_response IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'request_in_progress';
    END IF;
    RETURN v_response;
  END IF;

  IF p_op = 'mark_read' THEN
    v_event_seq := LEAST(
      GREATEST(coalesce((p_payload ->> 'eventSeq')::bigint, 0), 0),
      v_scope.next_event_seq
    );
    IF p_actor_kind = 'user' THEN
      INSERT INTO public.resume_comment_read_states (
        scope_id, principal_kind, principal_user_id, last_read_event_seq
      ) VALUES (p_scope_id, 'user', p_actor_id, v_event_seq)
      ON CONFLICT (scope_id, principal_user_id) WHERE principal_kind = 'user'
      DO UPDATE SET
        last_read_event_seq = GREATEST(
          public.resume_comment_read_states.last_read_event_seq,
          EXCLUDED.last_read_event_seq
        ),
        updated_at = now();
    ELSE
      INSERT INTO public.resume_comment_read_states (
        scope_id, principal_kind, principal_anonymous_id, last_read_event_seq
      ) VALUES (p_scope_id, 'anonymous', p_actor_id, v_event_seq)
      ON CONFLICT (scope_id, principal_anonymous_id) WHERE principal_kind = 'anonymous'
      DO UPDATE SET
        last_read_event_seq = GREATEST(
          public.resume_comment_read_states.last_read_event_seq,
          EXCLUDED.last_read_event_seq
        ),
        updated_at = now();
    END IF;
    v_response := jsonb_build_object('eventSeq', v_event_seq);
  ELSIF p_op = 'create_thread' THEN
    PERFORM public.assert_resume_comment_anchor(
      p_scope_id,
      p_payload -> 'anchor',
      p_payload ->> 'documentHash'
    );
    INSERT INTO public.resume_comment_threads (
      scope_id, anchor, original_page_index
    ) VALUES (
      p_scope_id,
      p_payload -> 'anchor',
      nullif(p_payload ->> 'originalPageIndex', '')::integer
    ) RETURNING * INTO v_thread;
    INSERT INTO public.resume_comments (
      thread_id,
      author_kind,
      author_user_id,
      author_anonymous_id,
      body
    ) VALUES (
      v_thread.id,
      p_actor_kind,
      CASE WHEN p_actor_kind = 'user' THEN p_actor_id END,
      CASE WHEN p_actor_kind = 'anonymous' THEN p_actor_id END,
      p_payload ->> 'body'
    ) RETURNING id INTO v_comment_id;
    v_event_seq := public.append_resume_comment_event(
      p_scope_id,
      v_thread.id,
      'thread_created',
      p_actor_kind,
      p_actor_id,
      jsonb_build_object('commentId', v_comment_id)
    );
    v_response := jsonb_build_object(
      'threadId', v_thread.id,
      'commentId', v_comment_id,
      'revision', v_thread.revision,
      'eventSeq', v_event_seq
    );
  ELSE
    v_thread_id := nullif(p_payload ->> 'threadId', '')::uuid;
    v_expected_revision := coalesce((p_payload ->> 'expectedRevision')::integer, 0);
    SELECT * INTO v_thread
    FROM public.resume_comment_threads
    WHERE id = v_thread_id
      AND scope_id = p_scope_id
      AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
    END IF;
    IF v_thread.revision <> v_expected_revision THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'stale_revision';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.resume_comments
      WHERE thread_id = v_thread.id
        AND parent_id IS NULL
        AND (
          (author_kind = p_actor_kind AND (
            (p_actor_kind = 'user' AND author_user_id = p_actor_id)
            OR (p_actor_kind = 'anonymous' AND author_anonymous_id = p_actor_id)
          ))
          OR (v_legacy_anonymous_id IS NOT NULL AND author_anonymous_id = v_legacy_anonymous_id)
        )
    ) INTO v_is_root_author;

    IF p_op = 'create_reply' THEN
      SELECT id INTO v_parent_id
      FROM public.resume_comments
      WHERE thread_id = v_thread.id AND parent_id IS NULL;
      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
      END IF;
      INSERT INTO public.resume_comments (
        thread_id,
        parent_id,
        author_kind,
        author_user_id,
        author_anonymous_id,
        body
      ) VALUES (
        v_thread.id,
        v_parent_id,
        p_actor_kind,
        CASE WHEN p_actor_kind = 'user' THEN p_actor_id END,
        CASE WHEN p_actor_kind = 'anonymous' THEN p_actor_id END,
        p_payload ->> 'body'
      ) RETURNING id INTO v_comment_id;
      UPDATE public.resume_comment_threads
      SET revision = revision + 1, last_activity_at = now()
      WHERE id = v_thread.id
      RETURNING * INTO v_thread;
      v_event_seq := public.append_resume_comment_event(
        p_scope_id, v_thread.id, 'comment_replied', p_actor_kind, p_actor_id,
        jsonb_build_object('commentId', v_comment_id)
      );
      v_response := jsonb_build_object(
        'threadId', v_thread.id,
        'commentId', v_comment_id,
        'revision', v_thread.revision,
        'eventSeq', v_event_seq
      );
    ELSIF p_op IN ('edit_comment', 'delete_comment') THEN
      v_comment_id := nullif(p_payload ->> 'commentId', '')::uuid;
      SELECT * INTO v_comment
      FROM public.resume_comments
      WHERE id = v_comment_id
        AND thread_id = v_thread.id
        AND deleted_at IS NULL
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
      END IF;
      IF NOT v_manage_all
        AND NOT (
          (v_comment.author_kind = p_actor_kind AND (
            (p_actor_kind = 'user' AND v_comment.author_user_id = p_actor_id)
            OR (p_actor_kind = 'anonymous' AND v_comment.author_anonymous_id = p_actor_id)
          ))
          OR (
            v_legacy_anonymous_id IS NOT NULL
            AND v_comment.author_anonymous_id = v_legacy_anonymous_id
          )
        ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
      END IF;
      IF p_op = 'edit_comment' THEN
        UPDATE public.resume_comments
        SET body = p_payload ->> 'body', edited_at = now()
        WHERE id = v_comment.id;
      ELSE
        UPDATE public.resume_comments
        SET body = '', deleted_at = now()
        WHERE id = v_comment.id;
      END IF;
      UPDATE public.resume_comment_threads
      SET revision = revision + 1, last_activity_at = now()
      WHERE id = v_thread.id
      RETURNING * INTO v_thread;
      v_event_seq := public.append_resume_comment_event(
        p_scope_id,
        v_thread.id,
        CASE WHEN p_op = 'edit_comment' THEN 'comment_edited' ELSE 'comment_deleted' END,
        p_actor_kind,
        p_actor_id,
        jsonb_build_object('commentId', v_comment.id)
      );
      v_response := jsonb_build_object(
        'threadId', v_thread.id,
        'commentId', v_comment.id,
        'revision', v_thread.revision,
        'eventSeq', v_event_seq
      );
    ELSIF p_op = 'delete_thread' THEN
      IF NOT v_manage_all THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
      END IF;
      UPDATE public.resume_comment_threads
      SET deleted_at = now(), revision = revision + 1, last_activity_at = now()
      WHERE id = v_thread.id
      RETURNING * INTO v_thread;
      v_event_seq := public.append_resume_comment_event(
        p_scope_id, v_thread.id, 'thread_deleted', p_actor_kind, p_actor_id
      );
      v_response := jsonb_build_object(
        'threadId', v_thread.id,
        'revision', v_thread.revision,
        'eventSeq', v_event_seq
      );
    ELSIF p_op IN ('resolve_thread', 'reopen_thread') THEN
      IF NOT v_manage_all AND NOT v_is_root_author THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
      END IF;
      UPDATE public.resume_comment_threads
      SET resolved_at = CASE WHEN p_op = 'resolve_thread' THEN now() ELSE NULL END,
          resolved_by_kind = CASE WHEN p_op = 'resolve_thread' THEN p_actor_kind ELSE NULL END,
          resolved_by_id = CASE WHEN p_op = 'resolve_thread' THEN p_actor_id ELSE NULL END,
          revision = revision + 1,
          last_activity_at = now()
      WHERE id = v_thread.id
      RETURNING * INTO v_thread;
      v_event_seq := public.append_resume_comment_event(
        p_scope_id,
        v_thread.id,
        CASE WHEN p_op = 'resolve_thread' THEN 'thread_resolved' ELSE 'thread_reopened' END,
        p_actor_kind,
        p_actor_id
      );
      v_response := jsonb_build_object(
        'threadId', v_thread.id,
        'revision', v_thread.revision,
        'eventSeq', v_event_seq
      );
    ELSIF p_op = 'relink_anchor' THEN
      IF NOT v_manage_all AND NOT v_is_root_author THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
      END IF;
      PERFORM public.assert_resume_comment_anchor(
        p_scope_id,
        p_payload -> 'anchor',
        p_payload ->> 'documentHash'
      );
      UPDATE public.resume_comment_threads
      SET anchor = p_payload -> 'anchor',
          anchor_status = 'anchored',
          original_page_index = nullif(p_payload ->> 'originalPageIndex', '')::integer,
          revision = revision + 1,
          last_activity_at = now()
      WHERE id = v_thread.id
      RETURNING * INTO v_thread;
      v_event_seq := public.append_resume_comment_event(
        p_scope_id, v_thread.id, 'anchor_relinked', p_actor_kind, p_actor_id
      );
      v_response := jsonb_build_object(
        'threadId', v_thread.id,
        'revision', v_thread.revision,
        'eventSeq', v_event_seq
      );
    END IF;
  END IF;

  IF v_response IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'not_found';
  END IF;
  UPDATE public.resume_comment_requests
  SET response = v_response, completed_at = now()
  WHERE actor_key = p_actor_key AND request_id = p_request_id;
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_resume_working_comment_document_v2(
  p_scope_id uuid,
  p_owner_user_id uuid,
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
  v_scope public.resume_comment_scopes%ROWTYPE;
  v_item jsonb;
  v_thread public.resume_comment_threads%ROWTYPE;
  v_event_seq bigint;
  v_response jsonb;
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  IF NOT public.is_valid_resume_comment_anchor_document(
    p_anchor_document,
    p_document_hash
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid anchor document';
  END IF;
  IF jsonb_typeof(p_relocations) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid relocations';
  END IF;

  SELECT * INTO v_scope
  FROM public.resume_comment_scopes
  WHERE id = p_scope_id
    AND kind = 'working'
    AND owner_user_id = p_owner_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'not_found';
  END IF;

  INSERT INTO public.resume_comment_requests (actor_key, request_id)
  VALUES (p_actor_key, p_request_id)
  ON CONFLICT (actor_key, request_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT response INTO v_response
    FROM public.resume_comment_requests
    WHERE actor_key = p_actor_key AND request_id = p_request_id
    FOR UPDATE;
    IF v_response IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'request_in_progress';
    END IF;
    RETURN v_response;
  END IF;

  IF v_scope.document_revision <> p_expected_document_revision THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'stale_document';
  END IF;
  UPDATE public.resume_comment_scopes
  SET anchor_document = p_anchor_document,
      document_hash = p_document_hash,
      document_revision = document_revision + 1,
      projection_reference_date = p_projection_reference_date
  WHERE id = p_scope_id
  RETURNING * INTO v_scope;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_relocations)
  LOOP
    SELECT * INTO v_thread
    FROM public.resume_comment_threads
    WHERE id = (v_item ->> 'threadId')::uuid
      AND scope_id = p_scope_id
      AND deleted_at IS NULL
      AND resolved_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_item ->> 'status' = 'anchored' THEN
      IF NOT public.is_valid_resume_comment_anchor_check(
        v_item -> 'anchor',
        p_anchor_document
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_selection';
      END IF;
      UPDATE public.resume_comment_threads
      SET anchor = v_item -> 'anchor',
          anchor_status = 'anchored',
          revision = revision + 1,
          updated_at = now()
      WHERE id = v_thread.id;
      v_event_seq := public.append_resume_comment_event(
        p_scope_id,
        v_thread.id,
        'anchor_moved',
        'system',
        p_owner_user_id,
        jsonb_build_object(
          'contextChanged', coalesce((v_item ->> 'contextChanged')::boolean, false)
        )
      );
    ELSIF v_item ->> 'status' = 'detached' THEN
      UPDATE public.resume_comment_threads
      SET anchor_status = 'detached',
          revision = revision + 1,
          updated_at = now()
      WHERE id = v_thread.id;
      v_event_seq := public.append_resume_comment_event(
        p_scope_id,
        v_thread.id,
        'anchor_detached',
        'system',
        p_owner_user_id,
        jsonb_build_object('reason', v_item ->> 'reason')
      );
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid relocations';
    END IF;
  END LOOP;

  v_event_seq := public.append_resume_comment_event(
    p_scope_id,
    NULL,
    'document_synced',
    'user',
    p_owner_user_id,
    jsonb_build_object('documentRevision', v_scope.document_revision)
  );
  v_response := jsonb_build_object(
    'documentRevision', v_scope.document_revision,
    'documentHash', p_document_hash,
    'eventSeq', v_event_seq
  );
  UPDATE public.resume_comment_requests
  SET response = v_response, completed_at = now()
  WHERE actor_key = p_actor_key AND request_id = p_request_id;
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.append_resume_comment_event(uuid, uuid, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_resume_comment_anonymous_identity(uuid, uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_resume_comment_write(text, uuid, text, uuid, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_resume_working_comment_document_v2(uuid, uuid, jsonb, text, integer, date, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.append_resume_comment_event(uuid, uuid, text, text, uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_resume_comment_anonymous_identity(uuid, uuid, text, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_resume_comment_write(text, uuid, text, uuid, text, uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_resume_working_comment_document_v2(uuid, uuid, jsonb, text, integer, date, jsonb, text, uuid)
  TO service_role;
