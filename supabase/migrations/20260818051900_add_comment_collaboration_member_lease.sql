-- 为协作 session/member 增加双协议 fencing。v1 兼容旧前端，v2 使用
-- host/member lease，并通过事务内 session 行锁保证迟到请求不能覆盖 winner。

ALTER TABLE public.resume_comment_collaboration_sessions
  ADD COLUMN IF NOT EXISTS protocol_version smallint;

UPDATE public.resume_comment_collaboration_sessions
SET protocol_version = 1
WHERE protocol_version IS NULL;

ALTER TABLE public.resume_comment_collaboration_sessions
  ALTER COLUMN protocol_version SET DEFAULT 1,
  ALTER COLUMN protocol_version SET NOT NULL;

ALTER TABLE public.resume_comment_collaboration_sessions
  DROP CONSTRAINT IF EXISTS resume_comment_collaboration_sessions_protocol_check;
ALTER TABLE public.resume_comment_collaboration_sessions
  ADD CONSTRAINT resume_comment_collaboration_sessions_protocol_check
  CHECK (protocol_version IN (1, 2));

ALTER TABLE public.resume_comment_collaboration_members
  ADD COLUMN IF NOT EXISTS member_lease_id uuid,
  ADD COLUMN IF NOT EXISTS protocol_version smallint;

ALTER TABLE public.resume_comment_collaboration_members
  ALTER COLUMN member_lease_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN protocol_version SET DEFAULT 1;

UPDATE public.resume_comment_collaboration_members
SET member_lease_id = coalesce(member_lease_id, gen_random_uuid()),
    protocol_version = coalesce(protocol_version, 1)
WHERE member_lease_id IS NULL
   OR protocol_version IS NULL;

ALTER TABLE public.resume_comment_collaboration_members
  ALTER COLUMN member_lease_id SET NOT NULL,
  ALTER COLUMN protocol_version SET NOT NULL;

ALTER TABLE public.resume_comment_collaboration_members
  DROP CONSTRAINT IF EXISTS resume_comment_collaboration_members_protocol_check;
ALTER TABLE public.resume_comment_collaboration_members
  ADD CONSTRAINT resume_comment_collaboration_members_protocol_check
  CHECK (protocol_version IN (1, 2));

-- v2 的 token attempt 是权威 tombstone/TTL 账本。member 表只保留当前
-- projection；旧 token 是否已取消或过期不能因 projection 轮换而遗忘。
CREATE TABLE public.resume_comment_collaboration_member_leases (
  session_id text NOT NULL,
  user_id uuid NOT NULL,
  member_lease_id uuid NOT NULL,
  protocol_version smallint NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id, member_lease_id),
  CONSTRAINT resume_comment_collaboration_member_leases_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.resume_comment_collaboration_sessions (session_id)
    ON DELETE CASCADE,
  CONSTRAINT resume_comment_collaboration_member_leases_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_comment_collaboration_member_leases_protocol_check
    CHECK (protocol_version = 2)
);

ALTER TABLE public.resume_comment_collaboration_member_leases
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resume_comment_collaboration_member_leases
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.resume_comment_collaboration_member_leases TO service_role;

CREATE OR REPLACE FUNCTION public.claim_resume_comment_collaboration_session_v2(
  p_session_id text,
  p_resume_id uuid,
  p_scope_id uuid,
  p_owner_user_id uuid,
  p_default_role text,
  p_expires_at timestamptz,
  p_protocol_version smallint,
  p_allow_new_legacy_session boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF p_protocol_version IS NULL
     OR p_protocol_version NOT IN (1, 2)
     OR p_default_role IS NULL
     OR p_default_role NOT IN ('editor', 'viewer')
     OR p_expires_at IS NULL
     OR p_allow_new_legacy_session IS NULL
     OR p_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_collaboration_claim';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('resume-comment-session:' || p_session_id, 0)
  );

  SELECT sessions.*
  INTO v_session
  FROM public.resume_comment_collaboration_sessions AS sessions
  WHERE sessions.session_id = p_session_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_session.protocol_version <> p_protocol_version
       OR v_session.owner_user_id <> p_owner_user_id
       OR v_session.resume_id <> p_resume_id THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0409',
        MESSAGE = 'collaboration_session_conflict';
    END IF;

    IF v_session.revoked_at IS NOT NULL
       OR v_session.expires_at <= pg_catalog.now() THEN
      RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'session_id_retired';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'sessionId', v_session.session_id,
      'resumeId', v_session.resume_id,
      'scopeId', v_session.scope_id,
      'ownerUserId', v_session.owner_user_id,
      'hostLeaseId', v_session.host_lease_id,
      'defaultRole', v_session.default_role,
      'expiresAt', v_session.expires_at,
      'protocolVersion', v_session.protocol_version
    );
  END IF;

  IF p_protocol_version = 1 AND NOT p_allow_new_legacy_session THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'upgrade_required';
  END IF;

  INSERT INTO public.resume_comment_collaboration_sessions (
    session_id,
    resume_id,
    scope_id,
    owner_user_id,
    host_lease_id,
    default_role,
    expires_at,
    revoked_at,
    protocol_version
  )
  VALUES (
    p_session_id,
    p_resume_id,
    p_scope_id,
    p_owner_user_id,
    gen_random_uuid(),
    p_default_role,
    p_expires_at,
    NULL,
    p_protocol_version
  )
  RETURNING * INTO v_session;

  RETURN pg_catalog.jsonb_build_object(
    'sessionId', v_session.session_id,
    'resumeId', v_session.resume_id,
    'scopeId', v_session.scope_id,
    'ownerUserId', v_session.owner_user_id,
    'hostLeaseId', v_session.host_lease_id,
    'defaultRole', v_session.default_role,
    'expiresAt', v_session.expires_at,
    'protocolVersion', v_session.protocol_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_resume_comment_collaboration_member_v2(
  p_session_id text,
  p_resume_id uuid,
  p_user_id uuid,
  p_member_lease_id uuid,
  p_protocol_version smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
  v_attempt public.resume_comment_collaboration_member_leases%ROWTYPE;
  v_member public.resume_comment_collaboration_members%ROWTYPE;
  v_member_expires_at timestamptz;
  v_attempt_count integer;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF p_protocol_version IS NULL
     OR p_protocol_version NOT IN (1, 2)
     OR (p_protocol_version = 2 AND p_member_lease_id IS NULL)
     OR (p_protocol_version = 1 AND p_member_lease_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_member_claim';
  END IF;

  SELECT sessions.*
  INTO v_session
  FROM public.resume_comment_collaboration_sessions AS sessions
  WHERE sessions.session_id = p_session_id
    AND sessions.resume_id = p_resume_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_session.protocol_version <> p_protocol_version
     OR v_session.revoked_at IS NOT NULL
     OR v_session.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  IF v_session.owner_user_id = p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'owner_must_host';
  END IF;

  v_member_expires_at := least(
    v_session.expires_at,
    pg_catalog.now() + interval '120 seconds'
  );

  IF p_protocol_version = 2 THEN
    SELECT attempts.*
    INTO v_attempt
    FROM public.resume_comment_collaboration_member_leases AS attempts
    WHERE attempts.session_id = p_session_id
      AND attempts.user_id = p_user_id
      AND attempts.member_lease_id = p_member_lease_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_attempt.revoked_at IS NOT NULL
         OR v_attempt.expires_at <= pg_catalog.now() THEN
        RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'member_lease_retired';
      END IF;
    ELSE
      SELECT pg_catalog.count(*)::integer
      INTO v_attempt_count
      FROM public.resume_comment_collaboration_member_leases AS attempts
      WHERE attempts.session_id = p_session_id
        AND attempts.user_id = p_user_id;

      IF v_attempt_count >= 32 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'attempt_limit';
      END IF;

      INSERT INTO public.resume_comment_collaboration_member_leases (
        session_id,
        user_id,
        member_lease_id,
        protocol_version,
        expires_at,
        revoked_at
      )
      VALUES (
        p_session_id,
        p_user_id,
        p_member_lease_id,
        2,
        v_member_expires_at,
        NULL
      )
      RETURNING * INTO v_attempt;
    END IF;
  END IF;

  SELECT members.*
  INTO v_member
  FROM public.resume_comment_collaboration_members AS members
  WHERE members.session_id = p_session_id
    AND members.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.resume_comment_collaboration_members (
      session_id,
      user_id,
      member_lease_id,
      protocol_version,
      role,
      expires_at,
      revoked_at,
      last_seen_at
    )
    VALUES (
      p_session_id,
      p_user_id,
      coalesce(p_member_lease_id, gen_random_uuid()),
      p_protocol_version,
      v_session.default_role,
      CASE
        WHEN p_protocol_version = 2 THEN v_member_expires_at
        ELSE v_session.expires_at
      END,
      NULL,
      pg_catalog.now()
    )
    RETURNING * INTO v_member;

    IF p_protocol_version = 2 THEN
      UPDATE public.resume_comment_collaboration_member_leases AS attempts
      SET expires_at = v_member_expires_at,
          updated_at = pg_catalog.now()
      WHERE attempts.session_id = p_session_id
        AND attempts.user_id = p_user_id
        AND attempts.member_lease_id = p_member_lease_id
        AND attempts.protocol_version = 2
        AND attempts.revoked_at IS NULL;
    END IF;
  ELSIF v_member.protocol_version <> p_protocol_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'member_protocol_conflict';
  ELSIF p_protocol_version = 1 THEN
    UPDATE public.resume_comment_collaboration_members AS members
    SET role = v_session.default_role,
        expires_at = v_session.expires_at,
        revoked_at = NULL,
        last_seen_at = pg_catalog.now()
    WHERE members.session_id = p_session_id
      AND members.user_id = p_user_id
      AND members.protocol_version = 1
    RETURNING members.* INTO v_member;
  ELSIF v_member.member_lease_id = p_member_lease_id THEN
    IF v_member.revoked_at IS NOT NULL
       OR v_member.expires_at <= pg_catalog.now() THEN
      RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'member_lease_retired';
    END IF;

    UPDATE public.resume_comment_collaboration_member_leases AS attempts
    SET expires_at = v_member_expires_at,
        updated_at = pg_catalog.now()
    WHERE attempts.session_id = p_session_id
      AND attempts.user_id = p_user_id
      AND attempts.member_lease_id = p_member_lease_id
      AND attempts.protocol_version = 2
      AND attempts.revoked_at IS NULL;

    UPDATE public.resume_comment_collaboration_members AS members
    SET role = v_session.default_role,
        expires_at = v_member_expires_at,
        last_seen_at = pg_catalog.now()
    WHERE members.session_id = p_session_id
      AND members.user_id = p_user_id
      AND members.protocol_version = 2
      AND members.member_lease_id = p_member_lease_id
    RETURNING members.* INTO v_member;
  ELSIF v_member.revoked_at IS NULL
        AND v_member.expires_at > pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'member_lease_conflict';
  ELSE
    UPDATE public.resume_comment_collaboration_member_leases AS attempts
    SET revoked_at = coalesce(attempts.revoked_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE attempts.session_id = p_session_id
      AND attempts.user_id = p_user_id
      AND attempts.member_lease_id = v_member.member_lease_id
      AND attempts.protocol_version = 2;

    UPDATE public.resume_comment_collaboration_member_leases AS attempts
    SET expires_at = v_member_expires_at,
        updated_at = pg_catalog.now()
    WHERE attempts.session_id = p_session_id
      AND attempts.user_id = p_user_id
      AND attempts.member_lease_id = p_member_lease_id
      AND attempts.protocol_version = 2
      AND attempts.revoked_at IS NULL;

    UPDATE public.resume_comment_collaboration_members AS members
    SET member_lease_id = p_member_lease_id,
        role = v_session.default_role,
        expires_at = v_member_expires_at,
        revoked_at = NULL,
        last_seen_at = pg_catalog.now()
    WHERE members.session_id = p_session_id
      AND members.user_id = p_user_id
      AND members.protocol_version = 2
    RETURNING members.* INTO v_member;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'sessionId', v_member.session_id,
    'userId', v_member.user_id,
    'memberLeaseId', v_member.member_lease_id,
    'protocolVersion', v_member.protocol_version,
    'role', v_member.role,
    'expiresAt', v_member.expires_at,
    'revokedAt', v_member.revoked_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_resume_comment_collaboration_member_v2(
  p_session_id text,
  p_resume_id uuid,
  p_user_id uuid,
  p_member_lease_id uuid,
  p_protocol_version smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
  v_attempt public.resume_comment_collaboration_member_leases%ROWTYPE;
  v_member public.resume_comment_collaboration_members%ROWTYPE;
  v_member_expires_at timestamptz;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF p_protocol_version <> 2 OR p_member_lease_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_member_claim';
  END IF;

  SELECT sessions.*
  INTO v_session
  FROM public.resume_comment_collaboration_sessions AS sessions
  WHERE sessions.session_id = p_session_id
    AND sessions.resume_id = p_resume_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_session.protocol_version <> 2
     OR v_session.revoked_at IS NOT NULL
     OR v_session.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  SELECT attempts.*
  INTO v_attempt
  FROM public.resume_comment_collaboration_member_leases AS attempts
  WHERE attempts.session_id = p_session_id
    AND attempts.user_id = p_user_id
    AND attempts.member_lease_id = p_member_lease_id
    AND attempts.protocol_version = 2
  FOR UPDATE;

  IF NOT FOUND
     OR v_attempt.revoked_at IS NOT NULL
     OR v_attempt.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  SELECT members.*
  INTO v_member
  FROM public.resume_comment_collaboration_members AS members
  WHERE members.session_id = p_session_id
    AND members.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_member.protocol_version <> 2
     OR v_member.member_lease_id <> p_member_lease_id
     OR v_member.revoked_at IS NOT NULL
     OR v_member.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;

  v_member_expires_at := least(
    v_session.expires_at,
    pg_catalog.now() + interval '120 seconds'
  );

  UPDATE public.resume_comment_collaboration_member_leases AS attempts
  SET expires_at = v_member_expires_at,
      updated_at = pg_catalog.now()
  WHERE attempts.session_id = p_session_id
    AND attempts.user_id = p_user_id
    AND attempts.member_lease_id = p_member_lease_id
    AND attempts.protocol_version = 2
    AND attempts.revoked_at IS NULL
  RETURNING attempts.* INTO v_attempt;

  UPDATE public.resume_comment_collaboration_members AS members
  SET expires_at = v_member_expires_at,
      last_seen_at = pg_catalog.now()
  WHERE members.session_id = p_session_id
    AND members.user_id = p_user_id
    AND members.protocol_version = 2
    AND members.member_lease_id = p_member_lease_id
    AND members.revoked_at IS NULL
  RETURNING members.* INTO v_member;

  RETURN pg_catalog.jsonb_build_object(
    'sessionId', v_member.session_id,
    'userId', v_member.user_id,
    'memberLeaseId', v_member.member_lease_id,
    'protocolVersion', v_member.protocol_version,
    'role', v_member.role,
    'expiresAt', v_member.expires_at,
    'revokedAt', v_member.revoked_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_resume_comment_collaboration_member_v2(
  p_session_id text,
  p_resume_id uuid,
  p_user_id uuid,
  p_member_lease_id uuid,
  p_protocol_version smallint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
  v_attempt public.resume_comment_collaboration_member_leases%ROWTYPE;
  v_member public.resume_comment_collaboration_members%ROWTYPE;
  v_revoked_at timestamptz := pg_catalog.now();
  v_attempt_count integer;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF p_protocol_version IS NULL
     OR p_protocol_version NOT IN (1, 2)
     OR (p_protocol_version = 2 AND p_member_lease_id IS NULL)
     OR (p_protocol_version = 1 AND p_member_lease_id IS NOT NULL) THEN
    RETURN false;
  END IF;

  SELECT sessions.*
  INTO v_session
  FROM public.resume_comment_collaboration_sessions AS sessions
  WHERE sessions.session_id = p_session_id
    AND sessions.resume_id = p_resume_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.protocol_version <> p_protocol_version THEN
    RETURN false;
  END IF;

  IF p_protocol_version = 2 THEN
    SELECT attempts.*
    INTO v_attempt
    FROM public.resume_comment_collaboration_member_leases AS attempts
    WHERE attempts.session_id = p_session_id
      AND attempts.user_id = p_user_id
      AND attempts.member_lease_id = p_member_lease_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.resume_comment_collaboration_member_leases AS attempts
      SET expires_at = least(attempts.expires_at, v_revoked_at),
          revoked_at = coalesce(attempts.revoked_at, v_revoked_at),
          updated_at = v_revoked_at
      WHERE attempts.session_id = p_session_id
        AND attempts.user_id = p_user_id
        AND attempts.member_lease_id = p_member_lease_id;
    ELSE
      SELECT pg_catalog.count(*)::integer
      INTO v_attempt_count
      FROM public.resume_comment_collaboration_member_leases AS attempts
      WHERE attempts.session_id = p_session_id
        AND attempts.user_id = p_user_id;

      IF v_attempt_count >= 32 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'attempt_limit';
      END IF;

      INSERT INTO public.resume_comment_collaboration_member_leases (
        session_id,
        user_id,
        member_lease_id,
        protocol_version,
        expires_at,
        revoked_at,
        updated_at
      )
      VALUES (
        p_session_id,
        p_user_id,
        p_member_lease_id,
        2,
        v_revoked_at,
        v_revoked_at,
        v_revoked_at
      );
    END IF;
  END IF;

  SELECT members.*
  INTO v_member
  FROM public.resume_comment_collaboration_members AS members
  WHERE members.session_id = p_session_id
    AND members.user_id = p_user_id
  FOR UPDATE;

  IF p_protocol_version = 2 THEN
    IF FOUND
       AND v_member.protocol_version = 2
       AND v_member.member_lease_id = p_member_lease_id
       AND v_member.revoked_at IS NULL THEN
      UPDATE public.resume_comment_collaboration_members AS members
      SET revoked_at = v_revoked_at
      WHERE members.session_id = p_session_id
        AND members.user_id = p_user_id
        AND members.protocol_version = 2
        AND members.member_lease_id = p_member_lease_id;
    END IF;

    RETURN true;
  END IF;

  IF NOT FOUND OR v_member.protocol_version <> 1 THEN
    RETURN false;
  END IF;

  IF v_member.revoked_at IS NULL THEN
    UPDATE public.resume_comment_collaboration_members AS members
    SET revoked_at = pg_catalog.now()
    WHERE members.session_id = p_session_id
      AND members.user_id = p_user_id
      AND members.protocol_version = 1;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_resume_comment_collaboration_session_v2(
  p_session_id text,
  p_resume_id uuid,
  p_owner_user_id uuid,
  p_host_lease_id uuid,
  p_protocol_version smallint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
  v_revoked_at timestamptz := pg_catalog.now();
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  SELECT sessions.*
  INTO v_session
  FROM public.resume_comment_collaboration_sessions AS sessions
  WHERE sessions.session_id = p_session_id
    AND sessions.resume_id = p_resume_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_session.protocol_version <> p_protocol_version
     OR v_session.owner_user_id <> p_owner_user_id
     OR v_session.host_lease_id <> p_host_lease_id THEN
    RETURN false;
  END IF;

  IF v_session.revoked_at IS NULL THEN
    UPDATE public.resume_comment_collaboration_sessions AS sessions
    SET revoked_at = v_revoked_at,
        updated_at = v_revoked_at
    WHERE sessions.session_id = p_session_id
      AND sessions.protocol_version = p_protocol_version
      AND sessions.host_lease_id = p_host_lease_id;

    UPDATE public.resume_comment_collaboration_members AS members
    SET revoked_at = v_revoked_at
    WHERE members.session_id = p_session_id
      AND members.protocol_version = p_protocol_version
      AND members.revoked_at IS NULL;

    IF p_protocol_version = 2 THEN
      UPDATE public.resume_comment_collaboration_member_leases AS attempts
      SET revoked_at = coalesce(attempts.revoked_at, v_revoked_at),
          expires_at = least(attempts.expires_at, v_revoked_at),
          updated_at = v_revoked_at
      WHERE attempts.session_id = p_session_id
        AND attempts.protocol_version = 2;
    END IF;
  END IF;

  RETURN true;
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
DECLARE
  v_session public.resume_comment_collaboration_sessions%ROWTYPE;
  v_member public.resume_comment_collaboration_members%ROWTYPE;
BEGIN
  PERFORM public.assert_resume_comment_service_role();

  IF p_access_kind = 'collaborator' THEN
    IF p_collaboration_protocol_version IS NULL
       OR p_collaboration_protocol_version NOT IN (1, 2)
       OR (p_collaboration_protocol_version = 2 AND p_member_lease_id IS NULL)
       OR (p_collaboration_protocol_version = 1 AND p_member_lease_id IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;

    SELECT sessions.*
    INTO v_session
    FROM public.resume_comment_collaboration_sessions AS sessions
    WHERE sessions.session_id = p_session_id
      AND sessions.resume_id = p_resume_id
      AND sessions.scope_id = p_scope_id
      AND sessions.protocol_version = p_collaboration_protocol_version
    FOR UPDATE;

    SELECT members.*
    INTO v_member
    FROM public.resume_comment_collaboration_members AS members
    WHERE members.session_id = p_session_id
      AND members.user_id = p_user_id
      AND members.protocol_version = p_collaboration_protocol_version
    FOR UPDATE;

    IF v_session.session_id IS NULL
       OR v_member.session_id IS NULL
       OR v_session.revoked_at IS NOT NULL
       OR v_member.revoked_at IS NOT NULL
       OR v_session.expires_at <= pg_catalog.now()
       OR v_member.expires_at <= pg_catalog.now()
       OR v_member.role <> p_collaborator_role
       OR (
         p_collaboration_protocol_version = 2
         AND v_member.member_lease_id <> p_member_lease_id
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
    END IF;
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

REVOKE ALL ON FUNCTION public.claim_resume_comment_collaboration_session_v2(
  text, uuid, uuid, uuid, text, timestamptz, smallint, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_resume_comment_collaboration_session_v2(
  text, uuid, uuid, uuid, text, timestamptz, smallint, boolean
) TO service_role;

REVOKE ALL ON FUNCTION public.claim_resume_comment_collaboration_member_v2(
  text, uuid, uuid, uuid, smallint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_resume_comment_collaboration_member_v2(
  text, uuid, uuid, uuid, smallint
) TO service_role;

REVOKE ALL ON FUNCTION public.renew_resume_comment_collaboration_member_v2(
  text, uuid, uuid, uuid, smallint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_resume_comment_collaboration_member_v2(
  text, uuid, uuid, uuid, smallint
) TO service_role;

REVOKE ALL ON FUNCTION public.release_resume_comment_collaboration_member_v2(
  text, uuid, uuid, uuid, smallint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_resume_comment_collaboration_member_v2(
  text, uuid, uuid, uuid, smallint
) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_resume_comment_collaboration_session_v2(
  text, uuid, uuid, uuid, smallint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_resume_comment_collaboration_session_v2(
  text, uuid, uuid, uuid, smallint
) TO service_role;

REVOKE ALL ON FUNCTION public.bootstrap_resume_comments_with_collaboration_lease_v2(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text, smallint, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_resume_comments_with_collaboration_lease_v2(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text, smallint, uuid
) TO service_role;
