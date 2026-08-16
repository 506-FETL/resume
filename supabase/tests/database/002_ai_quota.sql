BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(22);

INSERT INTO auth.users (id, email)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'quota-a@example.invalid'),
  ('40000000-0000-0000-0000-000000000002', 'quota-b@example.invalid'),
  ('40000000-0000-0000-0000-000000000003', 'quota-root@example.invalid');

INSERT INTO public.user_quotas (user_id, plan, daily_limit, used_today, last_reset_date)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'free', 3, 0, (timezone('UTC', now()))::date),
  ('40000000-0000-0000-0000-000000000002', 'free', 3, 0, (timezone('UTC', now()))::date),
  ('40000000-0000-0000-0000-000000000003', 'root', 3, 0, (timezone('UTC', now()))::date);

SELECT extensions.is(
  (public.reserve_ai_credits(
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    3,
    'ats'
  ) ->> 'ok')::boolean,
  true,
  'a reservation succeeds when the daily bucket has capacity'
);

SELECT extensions.is(
  (SELECT consumed_credits
   FROM public.ai_quota_daily_usage
   WHERE user_id = '40000000-0000-0000-0000-000000000001'
     AND quota_date = (timezone('UTC', now()))::date),
  3,
  'reservation debits the UTC bucket before the upstream call'
);

SELECT extensions.is(
  public.reserve_ai_credits(
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    3,
    'ats'
  ) ->> 'error',
  'request_in_progress',
  'same request id cannot trigger a second upstream call'
);

SELECT extensions.is(
  (SELECT consumed_credits
   FROM public.ai_quota_daily_usage
   WHERE user_id = '40000000-0000-0000-0000-000000000001'
     AND quota_date = (timezone('UTC', now()))::date),
  3,
  'same request id does not debit twice'
);

SELECT extensions.is(
  public.reserve_ai_credits(
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    1,
    'chat'
  ) ->> 'error',
  'idempotency_conflict',
  'same request id with different parameters is rejected'
);

SELECT extensions.is(
  public.reserve_ai_credits(
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    1,
    'chat'
  ) ->> 'error',
  'quota_exceeded',
  'a second request cannot exceed the daily limit'
);

SELECT extensions.is(
  (SELECT state FROM public.ai_credit_requests
   WHERE request_id = '50000000-0000-0000-0000-000000000002'),
  'rejected',
  'quota rejection is persisted for idempotent replay'
);

SELECT extensions.is(
  (public.mark_ai_request_delivery_started(
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'upstream-1'
  ) ->> 'ok')::boolean,
  true,
  'delivery start is persisted before content is emitted'
);

SELECT extensions.is(
  (public.settle_ai_credit_request(
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'completed',
    10,
    20,
    30,
    'stop',
    'upstream-1',
    NULL
  ) ->> 'ok')::boolean,
  true,
  'completed delivery settles the request'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.ai_credit_requests
    WHERE request_id = '50000000-0000-0000-0000-000000000001'
      AND state = 'settled'
      AND delivery_state = 'completed'
      AND prompt_tokens = 10
      AND completion_tokens = 20
      AND total_tokens = 30
  ),
  'settlement stores usage without another quota debit'
);

SELECT extensions.is(
  (public.settle_ai_credit_request(
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'completed',
    10,
    20,
    30,
    'stop',
    'upstream-1',
    NULL
  ) ->> 'replayed')::boolean,
  true,
  'settlement replay is idempotent'
);

SELECT extensions.is(
  public.release_ai_credit_request(
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'client_cancelled'
  ) ->> 'error',
  'invalid_request_state',
  'a settled request cannot be released'
);

SELECT extensions.is(
  (public.reserve_ai_credits(
    '40000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000003',
    1,
    'chat'
  ) ->> 'ok')::boolean,
  true,
  'a second user can reserve independently'
);

SELECT extensions.is(
  (public.release_ai_credit_request(
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000002',
    'upstream_503'
  ) ->> 'ok')::boolean,
  true,
  'a pre-delivery upstream failure releases the reservation'
);

SELECT extensions.is(
  (SELECT consumed_credits
   FROM public.ai_quota_daily_usage
   WHERE user_id = '40000000-0000-0000-0000-000000000002'
     AND quota_date = (timezone('UTC', now()))::date),
  0,
  'release credits the same UTC bucket exactly once'
);

SELECT extensions.is(
  (public.release_ai_credit_request(
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000002',
    'upstream_503'
  ) ->> 'replayed')::boolean,
  true,
  'release replay is idempotent'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'anon',
    'public.reserve_ai_credits(uuid,uuid,integer,text)',
    'EXECUTE'
  ),
  'anon cannot reserve credits'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'authenticated',
    'public.release_ai_credit_request(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot release arbitrary requests'
);

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000001',
  true
);

SELECT extensions.is(
  (public.get_ai_quota() ->> 'used_today')::integer,
  3,
  'quota read returns the current UTC bucket without mutation'
);

SELECT extensions.ok(
  public.get_ai_quota() ->> 'reset_at' IS NOT NULL,
  'quota read returns the SQL-owned UTC reset timestamp'
);

RESET ROLE;

SELECT extensions.is(
  (public.reserve_ai_credits(
    '40000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000004',
    3,
    'ats'
  ) ->> 'unlimited')::boolean,
  true,
  'root requests still create a ledger entry with unlimited quota'
);

SELECT extensions.is(
  (SELECT quota_debited
   FROM public.ai_credit_requests
   WHERE request_id = '50000000-0000-0000-0000-000000000004'),
  0,
  'root request ledger does not debit the daily bucket'
);

SELECT * FROM extensions.finish();

ROLLBACK;
