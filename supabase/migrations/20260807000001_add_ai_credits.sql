-- 20260807000001_add_ai_credits.sql
-- AI 每日额度（加权积分制）地基层。
--   public.user_quotas    每用户每日额度状态（免费 20 积分/日，惰性重置）
--   public.ai_usage_logs  每次成功扣减的流水
-- 三个 SECURITY DEFINER 函数：
--   get_ai_quota()                         无参，用 auth.uid()，供前端 supabase.rpc 读取
--   check_ai_quota(user_id, weight)        只读预检，供 edge function（service role）调用
--   consume_ai_credits(user_id, w, action) 原子扣减 + 写流水，供 edge function（service role）调用
-- 防并发：写路径先 INSERT ... ON CONFLICT DO NOTHING 保证行存在，再 SELECT ... FOR UPDATE 取行级锁，
--         在同一事务内完成「惰性重置 → 校验 → 扣减」，天然串行化同一用户的并发请求。

-- ============ 表：user_quotas ============
CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  daily_limit int NOT NULL DEFAULT 20,
  used_today int NOT NULL DEFAULT 0,
  last_reset_date date NOT NULL DEFAULT current_date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- 仅允许读取自己的额度行；不提供 insert/update/delete 策略，前端任何直接写入都会被 RLS 拒绝，
-- 写入只能经 SECURITY DEFINER 函数完成（函数以 owner 权限运行，绕过 RLS）。
DROP POLICY IF EXISTS "user_quotas_select_own" ON public.user_quotas;
CREATE POLICY "user_quotas_select_own" ON public.user_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- ============ 表：ai_usage_logs ============
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action text,
  cost int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
  ON public.ai_usage_logs USING btree (user_id, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 仅允许读取自己的流水；写入只经 consume_ai_credits（SECURITY DEFINER）。
DROP POLICY IF EXISTS "ai_usage_logs_select_own" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_select_own" ON public.ai_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============ 函数：get_ai_quota() （前端读取，用 auth.uid()）============
CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.user_quotas;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- 保证行存在（并发安全）
  INSERT INTO public.user_quotas (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 行锁，避免与并发扣减产生读改写竞争
  SELECT * INTO v_row FROM public.user_quotas
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- 惰性重置：跨自然日则归零并更新日期
  IF v_row.last_reset_date < current_date THEN
    UPDATE public.user_quotas
      SET used_today = 0,
          last_reset_date = current_date,
          updated_at = now()
      WHERE user_id = v_user_id
      RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'plan', v_row.plan,
    'daily_limit', v_row.daily_limit,
    'used_today', v_row.used_today,
    'remaining', GREATEST(v_row.daily_limit - v_row.used_today, 0),
    'last_reset_date', v_row.last_reset_date
  );
END;
$$;

-- ============ 函数：check_ai_quota(p_user_id, p_weight) （service role 只读预检）============
CREATE OR REPLACE FUNCTION public.check_ai_quota(p_user_id uuid, p_weight int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_quotas;
  v_weight int := GREATEST(COALESCE(p_weight, 1), 0);
  v_daily_limit int;
  v_used int;
  v_remaining int;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;

  SELECT * INTO v_row FROM public.user_quotas WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- 尚无额度行：按默认预算判断
    v_daily_limit := 20;
    v_used := 0;
  ELSE
    v_daily_limit := v_row.daily_limit;
    -- 惰性重置判断（只读，不落库）
    IF v_row.last_reset_date < current_date THEN
      v_used := 0;
    ELSE
      v_used := v_row.used_today;
    END IF;
  END IF;

  v_remaining := GREATEST(v_daily_limit - v_used, 0);

  RETURN jsonb_build_object(
    'ok', v_remaining >= v_weight,
    'remaining', v_remaining,
    'daily_limit', v_daily_limit
  );
END;
$$;

-- ============ 函数：consume_ai_credits(p_user_id, p_weight, p_action) （service role 原子扣减）============
CREATE OR REPLACE FUNCTION public.consume_ai_credits(p_user_id uuid, p_weight int, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_quotas;
  v_weight int := COALESCE(p_weight, 1);
  v_reset boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;

  -- 保证行存在
  INSERT INTO public.user_quotas (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 行锁：串行化同一用户的并发扣减，杜绝超发
  SELECT * INTO v_row FROM public.user_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 惰性重置（先在内存态归零，最后统一落库）
  IF v_row.last_reset_date < current_date THEN
    v_row.used_today := 0;
    v_row.last_reset_date := current_date;
    v_reset := true;
  END IF;

  -- weight <= 0：不扣减、不写流水（heavy 续轮透传 weight=0 的场景）；如发生跨日重置仍需落库
  IF v_weight <= 0 THEN
    IF v_reset THEN
      UPDATE public.user_quotas
        SET used_today = v_row.used_today,
            last_reset_date = v_row.last_reset_date,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'remaining', GREATEST(v_row.daily_limit - v_row.used_today, 0));
  END IF;

  -- 超额：不扣（仅在发生重置时落库以修正日期）
  IF v_row.used_today + v_weight > v_row.daily_limit THEN
    IF v_reset THEN
      UPDATE public.user_quotas
        SET used_today = v_row.used_today,
            last_reset_date = v_row.last_reset_date,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;
    RETURN jsonb_build_object('ok', false, 'remaining', GREATEST(v_row.daily_limit - v_row.used_today, 0));
  END IF;

  -- 原子扣减
  UPDATE public.user_quotas
    SET used_today = v_row.used_today + v_weight,
        last_reset_date = v_row.last_reset_date,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_row;

  INSERT INTO public.ai_usage_logs (user_id, action, cost)
  VALUES (p_user_id, COALESCE(p_action, 'chat'), v_weight);

  RETURN jsonb_build_object('ok', true, 'remaining', GREATEST(v_row.daily_limit - v_row.used_today, 0));
END;
$$;

-- ============ 授权：收回默认 PUBLIC 执行权，按角色最小授权 ============
-- 带 p_user_id 的两个函数只允许 service role 调用（绕过 RLS，且可传任意 user_id，必须严格限制）
REVOKE ALL ON FUNCTION public.check_ai_quota(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_quota(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, int, text) TO service_role;

-- 无参 get_ai_quota 用 auth.uid()，只影响调用者自己，授权给登录用户
REVOKE ALL ON FUNCTION public.get_ai_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_quota() TO authenticated;
