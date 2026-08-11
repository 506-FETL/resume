-- 20260811000002_add_resume_shares.sql
-- 简历只读分享链接。快照固化存 snapshot（形态 = PersistedResumeSnapshot），
-- 与 resume_config 解耦。owner-only RLS 用于管理；匿名读取与密码写入走
-- resume-share Edge Function（service_role），匿名端永不直接 SELECT 本表。

CREATE TABLE IF NOT EXISTS public.resume_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  token text NOT NULL,
  label text,
  snapshot jsonb NOT NULL,
  template_manifest jsonb NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  password_hash text,
  has_password boolean GENERATED ALWAYS AS (password_hash IS NOT NULL) STORED,
  expires_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_shares_token_key UNIQUE (token),
  CONSTRAINT resume_shares_token_format_check
    CHECK (token ~ '^[0-9a-f]{64}$'),
  CONSTRAINT resume_shares_label_length_check
    CHECK (label IS NULL OR char_length(label) <= 120),
  CONSTRAINT resume_shares_resume_id_fkey
    FOREIGN KEY (resume_id) REFERENCES public.resume_config (resume_id) ON DELETE CASCADE,
  CONSTRAINT resume_shares_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_shares_snapshot_is_object_check
    CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT resume_shares_template_manifest_is_object_check
    CHECK (jsonb_typeof(template_manifest) = 'object')
);

-- 兼容曾执行过旧版迁移的环境：CREATE TABLE IF NOT EXISTS 不会自动补新增列。
ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS template_manifest jsonb;
ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS has_password boolean
    GENERATED ALWAYS AS (password_hash IS NOT NULL) STORED;

-- 旧版分享记录没有模板快照，无法保证匿名页还原原样。先阻止带脏数据升级，
-- 避免用空对象伪造 manifest；没有历史记录时此检查直接通过。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.resume_shares
    WHERE template_manifest IS NULL
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'resume_shares contains legacy rows without template_manifest',
      HINT = 'Delete obsolete share rows or backfill a valid template_manifest before rerunning this migration.';
  END IF;
END;
$$;

ALTER TABLE public.resume_shares
  ALTER COLUMN template_manifest SET NOT NULL;

-- CREATE TABLE 被旧表跳过时，补齐后续新增的约束。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_token_format_check'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_token_format_check
      CHECK (token ~ '^[0-9a-f]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_label_length_check'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_label_length_check
      CHECK (label IS NULL OR char_length(label) <= 120);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_snapshot_is_object_check'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_snapshot_is_object_check
      CHECK (jsonb_typeof(snapshot) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_template_manifest_is_object_check'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_template_manifest_is_object_check
      CHECK (jsonb_typeof(template_manifest) = 'object');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_resume_shares_user_resume
  ON public.resume_shares USING btree (user_id, resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_shares_resume_active
  ON public.resume_shares USING btree (resume_id) WHERE is_active = true;

ALTER TABLE public.resume_shares ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.resume_share_rate_limits (
  share_id uuid NOT NULL
    REFERENCES public.resume_shares (id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  PRIMARY KEY (share_id, key_hash)
);

ALTER TABLE public.resume_share_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resume_share_rate_limits FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.resume_share_owner_rate_limits (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users (id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz
);

ALTER TABLE public.resume_share_owner_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resume_share_owner_rate_limits FROM PUBLIC, anon, authenticated;

-- authenticated 仅能读取管理界面需要的字段，password_hash 永不下发到浏览器。
REVOKE SELECT ON TABLE public.resume_shares FROM anon, authenticated;
GRANT SELECT (
  id,
  resume_id,
  user_id,
  token,
  label,
  display_name,
  is_active,
  has_password,
  expires_at,
  view_count,
  last_viewed_at,
  created_at,
  updated_at
) ON TABLE public.resume_shares TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.resume_shares FROM anon, authenticated;
GRANT INSERT (
  resume_id,
  user_id,
  token,
  label,
  snapshot,
  template_manifest,
  display_name,
  is_active,
  expires_at
) ON TABLE public.resume_shares TO authenticated;
GRANT UPDATE (
  label,
  snapshot,
  template_manifest,
  display_name,
  is_active,
  expires_at
) ON TABLE public.resume_shares TO authenticated;
GRANT DELETE ON TABLE public.resume_shares TO authenticated;

-- 仅 owner 可管理自己的分享记录（匿名端无任何直连策略，走 Edge Function）
DROP POLICY IF EXISTS "resume_shares_select_own" ON public.resume_shares;
CREATE POLICY "resume_shares_select_own" ON public.resume_shares
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "resume_shares_insert_own" ON public.resume_shares;
CREATE POLICY "resume_shares_insert_own" ON public.resume_shares
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.resume_config
      WHERE resume_config.resume_id = resume_shares.resume_id
        AND resume_config.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "resume_shares_update_own" ON public.resume_shares;
CREATE POLICY "resume_shares_update_own" ON public.resume_shares
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.resume_config
      WHERE resume_config.resume_id = resume_shares.resume_id
        AND resume_config.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "resume_shares_delete_own" ON public.resume_shares;
CREATE POLICY "resume_shares_delete_own" ON public.resume_shares
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_resume_shares_updated_at ON public.resume_shares;
CREATE TRIGGER update_resume_shares_updated_at BEFORE UPDATE
  ON public.resume_shares FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Edge Function 使用 service_role 调用，保证并发访问时 view_count 原子自增。
CREATE OR REPLACE FUNCTION public.record_resume_share_view(p_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.resume_shares
  SET
    view_count = view_count + 1,
    last_viewed_at = now()
  WHERE id = p_share_id;
$$;

REVOKE ALL ON FUNCTION public.record_resume_share_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_resume_share_view(uuid) TO service_role;

-- 密码尝试限流：同一分享链接下按 client key 及全局 key 分别计数。
CREATE OR REPLACE FUNCTION public.consume_resume_share_password_attempt(
  p_share_id uuid,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.resume_share_rate_limits%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 OR p_block_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.resume_share_rate_limits (share_id, key_hash)
  VALUES (p_share_id, p_key_hash)
  ON CONFLICT (share_id, key_hash) DO UPDATE
    SET key_hash = EXCLUDED.key_hash;

  SELECT *
  INTO v_row
  FROM public.resume_share_rate_limits
  WHERE share_id = p_share_id
    AND key_hash = p_key_hash
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN false;
  END IF;

  IF v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    UPDATE public.resume_share_rate_limits
    SET
      window_started_at = v_now,
      attempt_count = 1,
      blocked_until = NULL
    WHERE share_id = p_share_id
      AND key_hash = p_key_hash;
    RETURN true;
  END IF;

  IF v_row.attempt_count >= p_limit THEN
    UPDATE public.resume_share_rate_limits
    SET blocked_until = v_now + make_interval(secs => p_block_seconds)
    WHERE share_id = p_share_id
      AND key_hash = p_key_hash;
    RETURN false;
  END IF;

  UPDATE public.resume_share_rate_limits
  SET attempt_count = attempt_count + 1
  WHERE share_id = p_share_id
    AND key_hash = p_key_hash;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_resume_share_password_attempts(
  p_share_id uuid,
  p_key_hash text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.resume_share_rate_limits
  WHERE share_id = p_share_id
    AND key_hash = p_key_hash;
$$;

REVOKE ALL ON FUNCTION public.consume_resume_share_password_attempt(
  uuid,
  text,
  integer,
  integer,
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_resume_share_password_attempt(
  uuid,
  text,
  integer,
  integer,
  integer
) TO service_role;
REVOKE ALL ON FUNCTION public.clear_resume_share_password_attempts(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_resume_share_password_attempts(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.consume_resume_share_owner_write(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.resume_share_owner_rate_limits%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 OR p_block_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.resume_share_owner_rate_limits (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET user_id = EXCLUDED.user_id;

  SELECT *
  INTO v_row
  FROM public.resume_share_owner_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN false;
  END IF;

  IF v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    UPDATE public.resume_share_owner_rate_limits
    SET
      window_started_at = v_now,
      attempt_count = 1,
      blocked_until = NULL
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  IF v_row.attempt_count >= p_limit THEN
    UPDATE public.resume_share_owner_rate_limits
    SET blocked_until = v_now + make_interval(secs => p_block_seconds)
    WHERE user_id = p_user_id;
    RETURN false;
  END IF;

  UPDATE public.resume_share_owner_rate_limits
  SET attempt_count = attempt_count + 1
  WHERE user_id = p_user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_resume_share_owner_write(
  uuid,
  integer,
  integer,
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_resume_share_owner_write(
  uuid,
  integer,
  integer,
  integer
) TO service_role;
