-- 20260814000001 已在部分环境应用。此前协作权限表曾被追加到已发布迁移，
-- 且新建简历还没有统一建立活动版本。本迁移以幂等方式前向收敛两类环境。

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

DROP TRIGGER IF EXISTS set_resume_comment_collaboration_sessions_updated_at
  ON public.resume_comment_collaboration_sessions;
CREATE TRIGGER set_resume_comment_collaboration_sessions_updated_at
  BEFORE UPDATE ON public.resume_comment_collaboration_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_resume_comment_updated_at();

ALTER TABLE public.resume_comment_collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_comment_collaboration_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resume_comment_collaboration_sessions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_comment_collaboration_members
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.resume_comment_collaboration_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.resume_comment_collaboration_members TO service_role;

-- 所有新建/上传简历入口最终都会插入 resume_config。用数据库触发器统一建立
-- 活动版本，避免某个客户端入口遗漏 current_version_id。AFTER INSERT 时父行已存在，
-- 可以安全满足 resume_config_versions.resume_id 的外键。
CREATE OR REPLACE FUNCTION public.initialize_resume_active_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version_id bigint;
BEGIN
  IF NEW.current_version_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.resume_config_versions (
    user_id,
    resume_id,
    version_name,
    source_type,
    snapshot,
    base_updated_at,
    status,
    document_revision,
    projection_reference_date
  ) VALUES (
    NEW.user_id,
    NEW.resume_id,
    '当前工作版本',
    'autosave',
    to_jsonb(NEW)
      - 'id'
      - 'created_at'
      - 'user_id'
      - 'updated_at'
      - 'resume_id'
      - 'display_name'
      - 'description'
      - 'automerge_enabled'
      - 'document_version'
      - 'current_version_id',
    NEW.updated_at,
    'active',
    1,
    current_date
  ) RETURNING id INTO v_version_id;

  UPDATE public.resume_config
  SET current_version_id = v_version_id
  WHERE id = NEW.id
    AND current_version_id IS NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_resume_active_version()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS initialize_resume_active_version
  ON public.resume_config;
CREATE TRIGGER initialize_resume_active_version
  AFTER INSERT ON public.resume_config
  FOR EACH ROW EXECUTE FUNCTION public.initialize_resume_active_version();
