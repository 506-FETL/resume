INSERT INTO private.backend_error_events (
  request_id,
  function_name,
  operation,
  error_code,
  status,
  duration_ms,
  created_at
)
SELECT
  gen_random_uuid(),
  'maintenance-test',
  'cleanup',
  'maintenance_test_old',
  500,
  1,
  pg_catalog.now() - interval '8 days' - (series.value * interval '1 second')
FROM pg_catalog.generate_series(1, 101) AS series(value);

INSERT INTO private.backend_error_events (
  request_id,
  function_name,
  operation,
  error_code,
  status,
  duration_ms,
  created_at
) VALUES (
  gen_random_uuid(),
  'maintenance-test',
  'cleanup',
  'maintenance_test_live',
  500,
  1,
  pg_catalog.now()
);

INSERT INTO auth.users (id, email)
VALUES ('70000000-0000-4000-8000-000000000001', 'maintenance@example.invalid');

INSERT INTO auth.users (id, email)
SELECT
  ('72000000-0000-4000-8001-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
  'maintenance-member-' || series.value::text || '@example.invalid'
FROM pg_catalog.generate_series(1, 101) AS series(value);

INSERT INTO public.resume_config (
  resume_id, user_id, display_name, basics, "order"
) VALUES (
  '73000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'maintenance-collaboration',
  '{"name":"maintenance"}'::jsonb,
  '["basics"]'::jsonb
);

INSERT INTO public.resume_comment_scopes (
  id,
  kind,
  owner_user_id,
  resume_id,
  anchor_document,
  document_hash,
  projection_reference_date
) VALUES (
  '74000000-0000-4000-8000-000000000001',
  'working',
  '70000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  '{"nodes":[]}'::jsonb,
  pg_catalog.repeat('0', 64),
  (pg_catalog.timezone('UTC', pg_catalog.now()))::date
);

INSERT INTO public.resume_comment_collaboration_sessions (
  session_id,
  resume_id,
  scope_id,
  owner_user_id,
  default_role,
  expires_at,
  created_at,
  updated_at
) VALUES
  (
    'maintenance-active-session',
    '73000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'editor',
    pg_catalog.now() + interval '1 day',
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    'maintenance-expired-many',
    '73000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'editor',
    pg_catalog.now() - interval '2 days',
    pg_catalog.now() - interval '4 days',
    pg_catalog.now() - interval '2 days'
  ),
  (
    'maintenance-expired-empty',
    '73000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'editor',
    pg_catalog.now() - interval '2 days',
    pg_catalog.now() - interval '4 days',
    pg_catalog.now() - interval '2 days'
  );

INSERT INTO public.resume_comment_collaboration_members (
  session_id, user_id, role, expires_at, created_at, last_seen_at
) VALUES (
  'maintenance-active-session',
  '70000000-0000-4000-8000-000000000001',
  'editor',
  pg_catalog.now() + interval '1 day',
  pg_catalog.now(),
  pg_catalog.now()
);

INSERT INTO public.resume_comment_collaboration_members (
  session_id, user_id, role, expires_at, created_at, last_seen_at
)
SELECT
  'maintenance-expired-many',
  ('72000000-0000-4000-8001-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
  'editor',
  pg_catalog.now() - interval '2 days',
  pg_catalog.now() - interval '4 days',
  pg_catalog.now() - interval '2 days'
FROM pg_catalog.generate_series(1, 101) AS series(value);

INSERT INTO public.resume_comment_rate_limits (
  bucket_key,
  window_started_at,
  window_seconds,
  attempt_count,
  blocked_until,
  updated_at
) VALUES
  (
    'maintenance-expired-rate-limit',
    pg_catalog.now() - interval '3 days',
    60,
    1,
    NULL,
    pg_catalog.now() - interval '3 days'
  ),
  (
    'maintenance-blocked-rate-limit',
    pg_catalog.now() - interval '3 days',
    60,
    1,
    pg_catalog.now() + interval '1 day',
    pg_catalog.now() - interval '3 days'
  ),
  (
    'maintenance-boundary-rate-limit',
    pg_catalog.now() - interval '3 days',
    60,
    1,
    NULL,
    pg_catalog.now() - interval '47 hours'
  );

INSERT INTO public.ai_credit_requests (
  request_id,
  user_id,
  quota_date,
  action,
  reserved_cost,
  quota_debited,
  state,
  delivery_state,
  reserved_at,
  finalized_at,
  expires_at,
  failure_code
) VALUES
  (
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    (pg_catalog.timezone('UTC', pg_catalog.now()))::date - 200,
    'chat',
    1,
    0,
    'pending',
    'none',
    pg_catalog.now() - interval '200 days',
    NULL,
    pg_catalog.now() - interval '199 days',
    NULL
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000001',
    (pg_catalog.timezone('UTC', pg_catalog.now()))::date - 200,
    'chat',
    1,
    0,
    'released',
    'none',
    pg_catalog.now() - interval '200 days',
    pg_catalog.now() - interval '181 days',
    pg_catalog.now() - interval '199 days',
    'maintenance_test'
  );

