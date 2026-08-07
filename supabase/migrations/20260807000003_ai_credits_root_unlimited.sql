-- 20260807000003_ai_credits_root_unlimited.sql
-- 角色分层：root（管理员）享有无限 AI 额度，不受每日额度限制。
-- 重建三个额度函数：
--   get_ai_quota()       返回新增 'unlimited' 字段；root => unlimited=true
--   check_ai_quota()     root => ok 恒 true
--   consume_ai_credits() root => 不扣减 used_today（仍写流水便于分析），永不阻断
-- 其余角色（max/pro/free）行为与原先一致，按 daily_limit 计量。
-- 全部 CREATE OR REPLACE，可安全重复执行。

-- ============ get_ai_quota()（前端读取，用 auth.uid()）============
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

  INSERT INTO public.user_quotas (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.user_quotas
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_row.last_reset_date < current_date THEN
    UPDATE public.user_quotas
      SET used_today = 0,
          last_reset_date = current_date,
          updated_at = now()
      WHERE user_id = v_user_id
      RETURNING * INTO v_row;
  END IF;

  -- root：无限额度
  IF v_row.plan = 'root' THEN
    RETURN jsonb_build_object(
      'plan', v_row.plan,
      'daily_limit', v_row.daily_limit,
      'used_today', v_row.used_today,
      'remaining', v_row.daily_limit,
      'last_reset_date', v_row.last_reset_date,
      'unlimited', true
    );
  END IF;

  RETURN jsonb_build_object(
    'plan', v_row.plan,
    'daily_limit', v_row.daily_limit,
    'used_today', v_row.used_today,
    'remaining', GREATEST(v_row.daily_limit - v_row.used_today, 0),
    'last_reset_date', v_row.last_reset_date,
    'unlimited', false
  );
END;
$$;

-- ============ check_ai_quota(p_user_id, p_weight)（service role 只读预检）============
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

  -- root：无限额度，恒放行
  IF FOUND AND v_row.plan = 'root' THEN
    RETURN jsonb_build_object('ok', true, 'remaining', v_row.daily_limit, 'daily_limit', v_row.daily_limit);
  END IF;

  IF NOT FOUND THEN
    v_daily_limit := 20;
    v_used := 0;
  ELSE
    v_daily_limit := v_row.daily_limit;
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

-- ============ consume_ai_credits(p_user_id, p_weight, p_action)（service role 原子扣减）============
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

  INSERT INTO public.user_quotas (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.user_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_row.last_reset_date < current_date THEN
    v_row.used_today := 0;
    v_row.last_reset_date := current_date;
    v_reset := true;
  END IF;

  -- root：不扣减 used_today、永不阻断；仍写流水便于分析
  IF v_row.plan = 'root' THEN
    IF v_reset THEN
      UPDATE public.user_quotas
        SET used_today = v_row.used_today,
            last_reset_date = v_row.last_reset_date,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;
    IF v_weight > 0 THEN
      INSERT INTO public.ai_usage_logs (user_id, action, cost)
      VALUES (p_user_id, COALESCE(p_action, 'chat'), v_weight);
    END IF;
    RETURN jsonb_build_object('ok', true, 'remaining', v_row.daily_limit, 'unlimited', true);
  END IF;

  -- weight <= 0：不扣减、不写流水
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

  -- 超额：不扣
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
