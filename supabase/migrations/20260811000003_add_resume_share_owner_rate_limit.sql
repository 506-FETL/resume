-- 20260811000003_add_resume_share_owner_rate_limit.sql
-- owner 写操作账号级限流。必须在部署依赖该 RPC 的 resume-share v6 前执行。

CREATE TABLE IF NOT EXISTS public.resume_share_owner_rate_limits (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users (id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz
);

ALTER TABLE public.resume_share_owner_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resume_share_owner_rate_limits FROM PUBLIC, anon, authenticated;

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
