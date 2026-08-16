CREATE TABLE public.ai_quota_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  quota_date date NOT NULL,
  consumed_credits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, quota_date),
  CONSTRAINT ai_quota_daily_usage_consumed_check
    CHECK (consumed_credits >= 0)
);

CREATE TABLE public.ai_credit_requests (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  quota_date date NOT NULL,
  action text NOT NULL,
  reserved_cost integer NOT NULL,
  quota_debited integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'pending',
  delivery_state text NOT NULL DEFAULT 'none',
  upstream_request_id text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  finish_reason text,
  failure_code text,
  reserved_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  upstream_accepted_at timestamptz,
  delivery_started_at timestamptz,
  finalized_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (pg_catalog.now() + interval '15 minutes'),
  CONSTRAINT ai_credit_requests_action_check
    CHECK (action ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT ai_credit_requests_reserved_cost_check
    CHECK (reserved_cost IN (1, 3)),
  CONSTRAINT ai_credit_requests_quota_debited_check
    CHECK (quota_debited >= 0 AND quota_debited <= reserved_cost),
  CONSTRAINT ai_credit_requests_state_check
    CHECK (state IN ('pending', 'settled', 'released', 'rejected')),
  CONSTRAINT ai_credit_requests_delivery_state_check
    CHECK (delivery_state IN ('none', 'upstream_accepted', 'started', 'completed', 'partial')),
  CONSTRAINT ai_credit_requests_upstream_id_check
    CHECK (upstream_request_id IS NULL OR pg_catalog.length(upstream_request_id) <= 200),
  CONSTRAINT ai_credit_requests_usage_check
    CHECK (
      (prompt_tokens IS NULL OR prompt_tokens >= 0)
      AND (completion_tokens IS NULL OR completion_tokens >= 0)
      AND (total_tokens IS NULL OR total_tokens >= 0)
    ),
  CONSTRAINT ai_credit_requests_finish_reason_check
    CHECK (finish_reason IS NULL OR pg_catalog.length(finish_reason) <= 64),
  CONSTRAINT ai_credit_requests_failure_code_check
    CHECK (failure_code IS NULL OR failure_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT ai_credit_requests_expiry_check
    CHECK (expires_at > reserved_at),
  CONSTRAINT ai_credit_requests_finalized_check
    CHECK (
      (state = 'pending' AND finalized_at IS NULL)
      OR (state <> 'pending' AND finalized_at IS NOT NULL)
    )
);

CREATE INDEX ai_credit_requests_pending_expiry_idx
  ON public.ai_credit_requests (expires_at, request_id)
  WHERE state = 'pending';

CREATE INDEX ai_credit_requests_user_date_idx
  ON public.ai_credit_requests (user_id, quota_date, reserved_at DESC);

ALTER TABLE public.ai_quota_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_quota_daily_usage
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_credit_requests
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_quota_daily_usage
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_credit_requests
  TO service_role;

-- Preserve only the current UTC day's effective legacy usage.
INSERT INTO public.ai_quota_daily_usage (
  user_id,
  quota_date,
  consumed_credits,
  updated_at
)
SELECT
  user_id,
  (pg_catalog.timezone('UTC', pg_catalog.now()))::date,
  greatest(used_today, 0),
  pg_catalog.now()
FROM public.user_quotas
WHERE last_reset_date = (pg_catalog.timezone('UTC', pg_catalog.now()))::date
  AND used_today > 0
ON CONFLICT (user_id, quota_date) DO UPDATE
SET consumed_credits = greatest(
      public.ai_quota_daily_usage.consumed_credits,
      EXCLUDED.consumed_credits
    ),
    updated_at = pg_catalog.now();

CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quota_date date := (pg_catalog.timezone('UTC', pg_catalog.now()))::date;
  v_plan text := 'free';
  v_daily_limit integer := 20;
  v_consumed integer := 0;
  v_unlimited boolean := false;
  v_reset_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not authenticated';
  END IF;

  SELECT quota.plan, quota.daily_limit
  INTO v_plan, v_daily_limit
  FROM public.user_quotas AS quota
  WHERE quota.user_id = v_user_id;

  IF NOT FOUND THEN
    v_plan := 'free';
    v_daily_limit := 20;
  END IF;

  SELECT usage.consumed_credits
  INTO v_consumed
  FROM public.ai_quota_daily_usage AS usage
  WHERE usage.user_id = v_user_id
    AND usage.quota_date = v_quota_date;

  v_consumed := coalesce(v_consumed, 0);
  v_unlimited := v_plan = 'root';
  v_reset_at := ((v_quota_date + 1)::timestamp AT TIME ZONE 'UTC');

  RETURN pg_catalog.jsonb_build_object(
    'plan', v_plan,
    'daily_limit', v_daily_limit,
    'used_today', v_consumed,
    'remaining', CASE
      WHEN v_unlimited THEN v_daily_limit
      ELSE greatest(v_daily_limit - v_consumed, 0)
    END,
    'last_reset_date', v_quota_date,
    'quota_date', v_quota_date,
    'reset_at', v_reset_at,
    'unlimited', v_unlimited
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_ai_credits(
  p_user_id uuid,
  p_request_id uuid,
  p_weight integer,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted boolean := false;
  v_request public.ai_credit_requests%ROWTYPE;
  v_quota public.user_quotas%ROWTYPE;
  v_usage public.ai_quota_daily_usage%ROWTYPE;
  v_quota_date date := (pg_catalog.timezone('UTC', pg_catalog.now()))::date;
  v_reset_at timestamptz;
  v_unlimited boolean;
  v_remaining integer;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'user_id and request_id are required';
  END IF;
  IF p_weight NOT IN (1, 3) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'weight must be 1 or 3';
  END IF;
  IF p_action IS NULL OR p_action !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid action';
  END IF;

  v_reset_at := ((v_quota_date + 1)::timestamp AT TIME ZONE 'UTC');

  INSERT INTO public.ai_credit_requests (
    request_id,
    user_id,
    quota_date,
    action,
    reserved_cost,
    quota_debited,
    state,
    delivery_state,
    expires_at
  ) VALUES (
    p_request_id,
    p_user_id,
    v_quota_date,
    p_action,
    p_weight,
    0,
    'pending',
    'none',
    pg_catalog.now() + interval '15 minutes'
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING true INTO v_inserted;

  SELECT *
  INTO v_request
  FROM public.ai_credit_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  -- INSERT .. RETURNING assigns NULL when ON CONFLICT inserts no row. Treat
  -- that as the replay path; plain `NOT v_inserted` would evaluate to NULL
  -- and incorrectly continue into a second quota decision.
  IF NOT coalesce(v_inserted, false) THEN
    IF v_request.user_id IS DISTINCT FROM p_user_id
       OR v_request.action IS DISTINCT FROM p_action
       OR v_request.reserved_cost IS DISTINCT FROM p_weight THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'error', 'idempotency_conflict',
        'state', v_request.state,
        'replayed', true
      );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'error', CASE
        WHEN v_request.state = 'pending' THEN 'request_in_progress'
        ELSE 'request_already_finalized'
      END,
      'state', v_request.state,
      'delivery_state', v_request.delivery_state,
      'replayed', true
    );
  END IF;

  INSERT INTO public.user_quotas (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_quota
  FROM public.user_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  INSERT INTO public.ai_quota_daily_usage (user_id, quota_date)
  VALUES (p_user_id, v_quota_date)
  ON CONFLICT (user_id, quota_date) DO NOTHING;

  SELECT *
  INTO v_usage
  FROM public.ai_quota_daily_usage
  WHERE user_id = p_user_id
    AND quota_date = v_quota_date
  FOR UPDATE;

  v_unlimited := v_quota.plan = 'root';

  IF NOT v_unlimited AND v_usage.consumed_credits + p_weight > v_quota.daily_limit THEN
    UPDATE public.ai_credit_requests
    SET state = 'rejected',
        failure_code = 'quota_exceeded',
        finalized_at = pg_catalog.now()
    WHERE request_id = p_request_id;

    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'state', 'rejected',
      'remaining', greatest(v_quota.daily_limit - v_usage.consumed_credits, 0),
      'daily_limit', v_quota.daily_limit,
      'reset_at', v_reset_at,
      'unlimited', false,
      'replayed', false
    );
  END IF;

  IF NOT v_unlimited THEN
    UPDATE public.ai_quota_daily_usage
    SET consumed_credits = consumed_credits + p_weight,
        updated_at = pg_catalog.now()
    WHERE user_id = p_user_id
      AND quota_date = v_quota_date
    RETURNING * INTO v_usage;

    UPDATE public.ai_credit_requests
    SET quota_debited = p_weight
    WHERE request_id = p_request_id;
  END IF;

  v_remaining := CASE
    WHEN v_unlimited THEN v_quota.daily_limit
    ELSE greatest(v_quota.daily_limit - v_usage.consumed_credits, 0)
  END;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'state', 'pending',
    'delivery_state', 'none',
    'remaining', v_remaining,
    'daily_limit', v_quota.daily_limit,
    'reset_at', v_reset_at,
    'unlimited', v_unlimited,
    'replayed', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_ai_request_delivery_started(
  p_request_id uuid,
  p_user_id uuid,
  p_upstream_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.ai_credit_requests%ROWTYPE;
BEGIN
  IF p_upstream_request_id IS NOT NULL
     AND pg_catalog.length(p_upstream_request_id) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'upstream request id is too long';
  END IF;

  SELECT *
  INTO v_request
  FROM public.ai_credit_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id IS DISTINCT FROM p_user_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;
  IF v_request.state <> 'pending' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'request_already_finalized');
  END IF;

  IF v_request.delivery_state IN ('none', 'upstream_accepted') THEN
    UPDATE public.ai_credit_requests
    SET delivery_state = 'started',
        upstream_request_id = coalesce(p_upstream_request_id, upstream_request_id),
        upstream_accepted_at = coalesce(upstream_accepted_at, pg_catalog.now()),
        delivery_started_at = coalesce(delivery_started_at, pg_catalog.now())
    WHERE request_id = p_request_id
    RETURNING * INTO v_request;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'state', v_request.state,
    'delivery_state', v_request.delivery_state
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_ai_credit_request(
  p_request_id uuid,
  p_user_id uuid,
  p_delivery_state text,
  p_prompt_tokens integer DEFAULT NULL,
  p_completion_tokens integer DEFAULT NULL,
  p_total_tokens integer DEFAULT NULL,
  p_finish_reason text DEFAULT NULL,
  p_upstream_request_id text DEFAULT NULL,
  p_failure_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.ai_credit_requests%ROWTYPE;
BEGIN
  IF p_delivery_state NOT IN ('completed', 'partial') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid settlement delivery state';
  END IF;
  IF (p_prompt_tokens IS NOT NULL AND p_prompt_tokens < 0)
     OR (p_completion_tokens IS NOT NULL AND p_completion_tokens < 0)
     OR (p_total_tokens IS NOT NULL AND p_total_tokens < 0) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'usage must be non-negative';
  END IF;
  IF p_finish_reason IS NOT NULL AND pg_catalog.length(p_finish_reason) > 64 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'finish reason is too long';
  END IF;
  IF p_upstream_request_id IS NOT NULL AND pg_catalog.length(p_upstream_request_id) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'upstream request id is too long';
  END IF;
  IF p_failure_code IS NOT NULL AND p_failure_code !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid failure code';
  END IF;

  SELECT *
  INTO v_request
  FROM public.ai_credit_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id IS DISTINCT FROM p_user_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;
  IF v_request.state = 'settled' THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'state', v_request.state,
      'delivery_state', v_request.delivery_state,
      'replayed', true
    );
  END IF;
  IF v_request.state <> 'pending' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_request_state');
  END IF;
  IF p_delivery_state = 'completed' AND v_request.delivery_state <> 'started' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'delivery_not_started');
  END IF;

  UPDATE public.ai_credit_requests
  SET state = 'settled',
      delivery_state = p_delivery_state,
      upstream_request_id = coalesce(p_upstream_request_id, upstream_request_id),
      upstream_accepted_at = coalesce(upstream_accepted_at, pg_catalog.now()),
      delivery_started_at = CASE
        WHEN p_delivery_state IN ('completed', 'partial')
          THEN coalesce(delivery_started_at, pg_catalog.now())
        ELSE delivery_started_at
      END,
      prompt_tokens = p_prompt_tokens,
      completion_tokens = p_completion_tokens,
      total_tokens = p_total_tokens,
      finish_reason = p_finish_reason,
      failure_code = p_failure_code,
      finalized_at = pg_catalog.now()
  WHERE request_id = p_request_id
  RETURNING * INTO v_request;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'state', v_request.state,
    'delivery_state', v_request.delivery_state,
    'replayed', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_credit_request(
  p_request_id uuid,
  p_user_id uuid,
  p_failure_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.ai_credit_requests%ROWTYPE;
BEGIN
  IF p_failure_code IS NULL OR p_failure_code !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid failure code';
  END IF;

  SELECT *
  INTO v_request
  FROM public.ai_credit_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id IS DISTINCT FROM p_user_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;
  IF v_request.state = 'released' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'state', 'released', 'replayed', true);
  END IF;
  IF v_request.state <> 'pending' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_request_state');
  END IF;
  IF v_request.delivery_state IN ('started', 'completed', 'partial') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'delivery_already_started');
  END IF;

  IF v_request.quota_debited > 0 THEN
    UPDATE public.ai_quota_daily_usage
    SET consumed_credits = greatest(
          consumed_credits - v_request.quota_debited,
          0
        ),
        updated_at = pg_catalog.now()
    WHERE user_id = v_request.user_id
      AND quota_date = v_request.quota_date;
  END IF;

  UPDATE public.ai_credit_requests
  SET state = 'released',
      failure_code = p_failure_code,
      finalized_at = pg_catalog.now()
  WHERE request_id = p_request_id;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'state', 'released', 'replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_expired_ai_credit_requests(
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.ai_credit_requests%ROWTYPE;
  v_settled integer := 0;
  v_released integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'limit must be between 1 and 1000';
  END IF;

  FOR v_request IN
    SELECT request.*
    FROM public.ai_credit_requests AS request
    WHERE request.state = 'pending'
      AND request.expires_at <= pg_catalog.now()
    ORDER BY request.expires_at, request.request_id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_request.delivery_state IN ('started', 'completed', 'partial') THEN
      UPDATE public.ai_credit_requests
      SET state = 'settled',
          delivery_state = 'partial',
          failure_code = coalesce(failure_code, 'reservation_expired_after_delivery'),
          finalized_at = pg_catalog.now()
      WHERE request_id = v_request.request_id;
      v_settled := v_settled + 1;
    ELSE
      IF v_request.quota_debited > 0 THEN
        UPDATE public.ai_quota_daily_usage
        SET consumed_credits = greatest(
              consumed_credits - v_request.quota_debited,
              0
            ),
            updated_at = pg_catalog.now()
        WHERE user_id = v_request.user_id
          AND quota_date = v_request.quota_date;
      END IF;

      UPDATE public.ai_credit_requests
      SET state = 'released',
          failure_code = coalesce(failure_code, 'reservation_expired_before_delivery'),
          finalized_at = pg_catalog.now()
      WHERE request_id = v_request.request_id;
      v_released := v_released + 1;
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'processed', v_settled + v_released,
    'settled', v_settled,
    'released', v_released
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reserve_ai_credits(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_ai_request_delivery_started(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_ai_credit_request(uuid, uuid, text, integer, integer, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ai_credit_request(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_expired_ai_credit_requests(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_ai_credits(uuid, uuid, integer, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_ai_request_delivery_started(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_ai_credit_request(uuid, uuid, text, integer, integer, integer, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_credit_request(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_ai_credit_requests(integer)
  TO service_role;
