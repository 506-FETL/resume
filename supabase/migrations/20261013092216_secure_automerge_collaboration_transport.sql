-- Realtime caches join RLS. Never broadcast document data to a shared room:
-- every send rechecks sender AND recipient leases, then writes private inboxes.
CREATE TABLE private.automerge_peers (
  session_id text NOT NULL REFERENCES public.resume_comment_collaboration_sessions(session_id) ON DELETE CASCADE,
  peer_id text NOT NULL CHECK (length(peer_id) BETWEEN 1 AND 200),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL,
  inbox_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}',
  ready boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (session_id, peer_id)
);
ALTER TABLE private.automerge_peers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.automerge_peers FROM PUBLIC, anon, authenticated;

-- Retire inboxes permanently on revoke/lease replacement, including v1, whose
-- member projection may reuse its ID on a later join. Other tabs on an active
-- lease are kept intact; closing one peer only deletes its own random inbox.
CREATE FUNCTION private.retire_automerge_inboxes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'resume_comment_collaboration_members' THEN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM private.automerge_peers WHERE session_id = OLD.session_id AND user_id = OLD.user_id;
    ELSIF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NOT NULL
      OR OLD.expires_at <= clock_timestamp() OR OLD.member_lease_id <> NEW.member_lease_id
      OR OLD.protocol_version <> NEW.protocol_version THEN
      DELETE FROM private.automerge_peers WHERE session_id = OLD.session_id AND user_id = OLD.user_id;
    END IF;
  ELSIF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NOT NULL
    OR OLD.expires_at <= clock_timestamp() OR OLD.host_lease_id <> NEW.host_lease_id
    OR OLD.protocol_version <> NEW.protocol_version THEN
    DELETE FROM private.automerge_peers WHERE session_id = OLD.session_id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.retire_automerge_inboxes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER retire_automerge_member_inboxes AFTER UPDATE OR DELETE
  ON public.resume_comment_collaboration_members FOR EACH ROW EXECUTE FUNCTION private.retire_automerge_inboxes();
CREATE TRIGGER retire_automerge_session_inboxes AFTER UPDATE
  ON public.resume_comment_collaboration_sessions FOR EACH ROW EXECUTE FUNCTION private.retire_automerge_inboxes();

-- Internal helper, never callable by clients. A peer is tied to a specific lease,
-- including the v1 projection ID, so rejoining cannot revive an old inbox.
CREATE FUNCTION private.automerge_lease_valid(p_session_id text, p_user_id uuid, p_lease_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resume_comment_collaboration_sessions s
    WHERE s.session_id = p_session_id AND s.revoked_at IS NULL
      AND s.expires_at > clock_timestamp()
      AND (
        (s.owner_user_id = p_user_id AND s.host_lease_id = p_lease_id)
        OR EXISTS (
          SELECT 1 FROM public.resume_comment_collaboration_members m
          WHERE m.session_id = s.session_id AND m.user_id = p_user_id
            AND m.member_lease_id = p_lease_id AND m.protocol_version = s.protocol_version
            AND m.revoked_at IS NULL AND m.expires_at > clock_timestamp()
            AND (m.protocol_version = 1 OR EXISTS (
              SELECT 1 FROM public.resume_comment_collaboration_member_leases l
              WHERE l.session_id = m.session_id AND l.user_id = m.user_id
                AND l.member_lease_id = m.member_lease_id AND l.revoked_at IS NULL
                AND l.expires_at > clock_timestamp()
            ))
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION private.automerge_lease_valid(text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.can_receive_automerge(p_topic text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM private.automerge_peers p
    WHERE 'automerge:inbox:' || p.inbox_id::text = p_topic
      AND p.user_id = auth.uid() AND p.expires_at > clock_timestamp()
      AND private.automerge_lease_valid(p.session_id, p.user_id, p.lease_id)
  );
$$;
REVOKE ALL ON FUNCTION private.can_receive_automerge(text) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_receive_automerge(text) TO authenticated;

CREATE POLICY automerge_inbox_read ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND topic = realtime.topic()
    AND private.can_receive_automerge(realtime.topic()));
-- Restrictive policies preserve unrelated topics while preventing a future broad
-- permissive policy from accidentally opening document transport.
CREATE POLICY automerge_read_guard ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((realtime.topic() NOT LIKE 'automerge:%' AND topic NOT LIKE 'automerge:%')
    OR (extension = 'broadcast' AND topic = realtime.topic()
      AND private.can_receive_automerge(realtime.topic())));
CREATE POLICY automerge_write_guard ON realtime.messages AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (realtime.topic() NOT LIKE 'automerge:%' AND topic NOT LIKE 'automerge:%');
CREATE POLICY automerge_anon_guard ON realtime.messages AS RESTRICTIVE FOR SELECT TO anon
  USING (realtime.topic() NOT LIKE 'automerge:%' AND topic NOT LIKE 'automerge:%');

CREATE FUNCTION public.open_automerge_peer(
  p_session_id text, p_resume_id uuid, p_peer_id text,
  p_protocol_version smallint, p_lease_id uuid, p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '3s' AS $$
DECLARE
  s public.resume_comment_collaboration_sessions%ROWTYPE;
  p private.automerge_peers%ROWTYPE;
  v_lease uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.resume_comment_collaboration_sessions
    WHERE session_id = p_session_id AND resume_id = p_resume_id FOR UPDATE;
  IF NOT FOUND OR p_protocol_version IS DISTINCT FROM s.protocol_version
    OR s.revoked_at IS NOT NULL OR s.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF s.owner_user_id = auth.uid() THEN
    v_lease := s.host_lease_id;
    IF p_lease_id IS DISTINCT FROM v_lease THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  ELSE
    SELECT member_lease_id INTO v_lease FROM public.resume_comment_collaboration_members
      WHERE session_id = p_session_id AND user_id = auth.uid() FOR UPDATE;
    IF (s.protocol_version = 2 AND p_lease_id IS DISTINCT FROM v_lease)
      OR (s.protocol_version = 1 AND p_lease_id IS NOT NULL) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NOT private.automerge_lease_valid(p_session_id, auth.uid(), v_lease) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_peer_id IS NULL OR length(p_peer_id) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR octet_length(p_metadata::text) > 4096 THEN
    RAISE EXCEPTION 'invalid_peer' USING ERRCODE = '22023';
  END IF;
  DELETE FROM private.automerge_peers WHERE session_id = p_session_id AND expires_at <= clock_timestamp();
  -- An existing peer identity cannot be adopted by a different account or lease.
  SELECT * INTO p FROM private.automerge_peers WHERE session_id = p_session_id AND peer_id = p_peer_id;
  IF FOUND AND (p.user_id <> auth.uid() OR p.lease_id <> v_lease) THEN
    RAISE EXCEPTION 'peer_identity_conflict' USING ERRCODE = '42501';
  END IF;
  INSERT INTO private.automerge_peers(session_id, peer_id, user_id, lease_id, metadata, expires_at)
  VALUES (p_session_id, p_peer_id, auth.uid(), v_lease,
    p_metadata || jsonb_build_object('userId', auth.uid(), 'peerId', p_peer_id,
      'role', CASE WHEN s.owner_user_id = auth.uid() THEN 'host' ELSE 'guest' END), clock_timestamp() + interval '45 seconds')
  ON CONFLICT (session_id, peer_id) DO UPDATE SET
    inbox_id = gen_random_uuid(), ready = false, metadata = EXCLUDED.metadata, expires_at = EXCLUDED.expires_at
  RETURNING * INTO p;
  RETURN jsonb_build_object('inboxId', p.inbox_id, 'topic', 'automerge:inbox:' || p.inbox_id::text);
END;
$$;

CREATE FUNCTION private.assert_automerge_peer(p_inbox_id uuid)
RETURNS private.automerge_peers LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '3s' AS $$
DECLARE p private.automerge_peers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM private.automerge_peers WHERE inbox_id = p_inbox_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  -- Same lock order as the existing claim/renew/revoke functions. Also locks member
  -- rows to serialize against legacy service-role updates.
  PERFORM 1 FROM public.resume_comment_collaboration_sessions WHERE session_id = p.session_id FOR UPDATE;
  PERFORM 1 FROM public.resume_comment_collaboration_members WHERE session_id = p.session_id ORDER BY user_id FOR UPDATE;
  SELECT * INTO p FROM private.automerge_peers WHERE inbox_id = p_inbox_id AND user_id = auth.uid();
  IF NOT FOUND OR p.expires_at <= clock_timestamp()
    OR NOT private.automerge_lease_valid(p.session_id, p.user_id, p.lease_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  RETURN p;
END;
$$;
REVOKE ALL ON FUNCTION private.assert_automerge_peer(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.refresh_automerge_peer(p_inbox_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p private.automerge_peers%ROWTYPE; v_peers jsonb;
BEGIN
  p := private.assert_automerge_peer(p_inbox_id);
  UPDATE private.automerge_peers SET ready = true, expires_at = clock_timestamp() + interval '45 seconds'
    WHERE inbox_id = p_inbox_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('peerId', peer_id, 'metadata', metadata)), '[]'::jsonb)
    INTO v_peers FROM private.automerge_peers r
    WHERE r.session_id = p.session_id AND r.inbox_id <> p.inbox_id AND r.ready
      AND r.expires_at > clock_timestamp() AND private.automerge_lease_valid(r.session_id, r.user_id, r.lease_id);
  RETURN v_peers;
END;
$$;

CREATE FUNCTION public.send_automerge_message(p_inbox_id uuid, p_event text, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p private.automerge_peers%ROWTYPE; r private.automerge_peers%ROWTYPE; v_payload jsonb;
BEGIN
  p := private.assert_automerge_peer(p_inbox_id);
  IF NOT p.ready OR p_event NOT IN ('automerge-sync', 'automerge-control') OR p_event IS NULL
    -- Leave envelope/metadata headroom under the Realtime Free 256 KB limit.
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text) > 240000 THEN
    RAISE EXCEPTION 'invalid_message' USING ERRCODE = '22023';
  END IF;
  IF p_event = 'automerge-sync' AND (
    jsonb_typeof(p_payload->'targetId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_payload->'message') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_payload->'documentId') IS DISTINCT FROM 'string'
  ) THEN RAISE EXCEPTION 'invalid_message' USING ERRCODE = '22023'; END IF;
  -- Control of the session belongs to the owner, never trust a claimed sender.
  IF p_event = 'automerge-control' AND NOT EXISTS (
    SELECT 1 FROM public.resume_comment_collaboration_sessions s
    WHERE s.session_id = p.session_id AND s.owner_user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  v_payload := p_payload || jsonb_build_object('senderId', p.peer_id, 'userId', p.user_id,
    'sessionId', p.session_id, 'metadata', p.metadata);
  FOR r IN SELECT * FROM private.automerge_peers
    WHERE session_id = p.session_id AND inbox_id <> p.inbox_id AND ready
      AND (p_event = 'automerge-control' OR peer_id = p_payload->>'targetId')
      AND expires_at > clock_timestamp()
  LOOP
    IF private.automerge_lease_valid(r.session_id, r.user_id, r.lease_id) THEN
      PERFORM realtime.send(v_payload, p_event, 'automerge:inbox:' || r.inbox_id::text, true);
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.close_automerge_peer(p_inbox_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM private.automerge_peers WHERE inbox_id = p_inbox_id AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.open_automerge_peer(text, uuid, text, smallint, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_automerge_peer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_automerge_message(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_automerge_peer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_automerge_peer(text, uuid, text, smallint, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_automerge_peer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_automerge_message(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_automerge_peer(uuid) TO authenticated;
