WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'ops_monitor_dispatch', 'queued', '{"requestId":900000000001}'::jsonb,
    pg_catalog.now(), pg_catalog.now(), 0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000001, run.id, 'backend-ops-monitor', pg_catalog.now()
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'ops_monitor_dispatch', 'queued', '{"requestId":900000000002}'::jsonb,
    pg_catalog.now(), pg_catalog.now(), 0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000002, run.id, 'backend-ops-monitor', pg_catalog.now()
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'github_refresh_dispatch', 'queued', '{"requestId":900000000003}'::jsonb,
    pg_catalog.now(), pg_catalog.now(), 0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000003, run.id, 'github-stars-refresh', pg_catalog.now()
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'github_refresh_dispatch', 'queued', '{"requestId":900000000004}'::jsonb,
    pg_catalog.now() - interval '3 minutes',
    pg_catalog.now() - interval '3 minutes',
    0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000004, run.id, 'github-stars-refresh', pg_catalog.now() - interval '3 minutes'
FROM run;

WITH run AS (
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, details, started_at, finished_at, duration_ms
  ) VALUES (
    'github_refresh_dispatch', 'queued', '{"requestId":900000000005}'::jsonb,
    pg_catalog.now() - interval '3 minutes',
    pg_catalog.now() - interval '3 minutes',
    0
  ) RETURNING id
)
INSERT INTO private.backend_edge_dispatches (
  request_id, maintenance_run_id, function_name, dispatched_at
)
SELECT 900000000005, run.id, 'github-stars-refresh', pg_catalog.now() - interval '3 minutes'
FROM run;

INSERT INTO net.http_request_queue (
  id, method, url, headers, body, timeout_milliseconds
) VALUES (
  900000000005,
  'POST',
  'https://example.invalid/functions/v1/github-stars-refresh',
  '{}'::jsonb,
  pg_catalog.convert_to('{}', 'UTF8'),
  10000
);

INSERT INTO net._http_response (
  id, status_code, content_type, headers, content, timed_out, error_msg
) VALUES
  (900000000001, 204, 'application/json', '{}'::jsonb, '', false, NULL),
  (900000000002, 401, 'application/json', '{}'::jsonb, '', false, NULL),
  (900000000003, NULL, NULL, '{}'::jsonb, NULL, true, 'Timeout was reached');

SELECT extensions.is(
  private.reconcile_backend_edge_dispatches_v1(20) ->> 'processed',
  '4',
  'edge dispatch reconciliation consumes success, HTTP error, timeout and missing responses'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches AS dispatches
    JOIN private.backend_maintenance_runs AS runs
      ON runs.id = dispatches.maintenance_run_id
    WHERE dispatches.request_id = 900000000001
      AND dispatches.state = 'succeeded'
      AND dispatches.status_code = 204
      AND runs.outcome = 'success'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches AS dispatches
    JOIN private.backend_maintenance_runs AS runs
      ON runs.id = dispatches.maintenance_run_id
    WHERE dispatches.request_id = 900000000002
      AND dispatches.state = 'failed'
      AND dispatches.status_code = 401
      AND dispatches.error_code = 'edge_http_status'
      AND runs.outcome = 'failed'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches
    WHERE request_id = 900000000003
      AND state = 'failed'
      AND error_code = 'edge_response_timeout'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches
    WHERE request_id = 900000000004
      AND state = 'failed'
      AND error_code = 'edge_response_missing'
  )
  AND EXISTS (
    SELECT 1
    FROM private.backend_edge_dispatches
    WHERE request_id = 900000000005
      AND state = 'queued'
      AND completed_at IS NULL
  ),
  'edge dispatch outcomes wait for responses and never finalize a request still in the pg_net queue'
);

