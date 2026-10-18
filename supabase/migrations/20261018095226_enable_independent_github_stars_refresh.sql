-- Allow GitHub star refreshes without enabling monitoring or cleanup jobs.
-- Keep the new switch opt-in; configure it after the protected refresh is verified.
ALTER TABLE private.backend_maintenance_config
  ADD COLUMN github_stars_refresh_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.invoke_backend_edge_job_v1(
  p_function_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '15s'
AS $$
DECLARE
  v_started_at timestamptz := pg_catalog.clock_timestamp();
  v_enabled boolean;
  v_project_url text;
  v_maintenance_token text;
  v_request_id bigint;
  v_duration integer;
  v_job_name text;
  v_maintenance_run_id bigint;
  v_sql_state text;
  v_error_code text;
BEGIN
  IF p_function_name NOT IN ('github-stars-refresh', 'backend-ops-monitor') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'unsupported backend edge job';
  END IF;
  v_job_name := CASE p_function_name
    WHEN 'github-stars-refresh' THEN 'github_refresh_dispatch'
    ELSE 'ops_monitor_dispatch'
  END;

  SELECT config.edge_jobs_enabled
    OR (p_function_name = 'github-stars-refresh' AND config.github_stars_refresh_enabled)
  INTO v_enabled
  FROM private.backend_maintenance_config AS config
  WHERE config.singleton;
  IF NOT coalesce(v_enabled, false) THEN
    v_duration := greatest(
      0,
      pg_catalog.round(
        extract(epoch FROM (pg_catalog.clock_timestamp() - v_started_at)) * 1000
      )::integer
    );
    INSERT INTO private.backend_maintenance_runs (
      job_name, outcome, started_at, finished_at, duration_ms
    ) VALUES (
      v_job_name, 'skipped', v_started_at,
      pg_catalog.clock_timestamp(), v_duration
    );
    RETURN pg_catalog.jsonb_build_object('outcome', 'skipped', 'reason', 'disabled');
  END IF;

  BEGIN
    SELECT secrets.decrypted_secret
    INTO STRICT v_project_url
    FROM vault.decrypted_secrets AS secrets
    WHERE secrets.name = 'resume_backend_project_url';

    SELECT secrets.decrypted_secret
    INTO STRICT v_maintenance_token
    FROM vault.decrypted_secrets AS secrets
    WHERE secrets.name = 'resume_backend_maintenance_token';

    IF v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$'
       OR pg_catalog.length(v_maintenance_token) < 32 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid backend edge secrets';
    END IF;

    SELECT net.http_post(
      url => pg_catalog.rtrim(v_project_url, '/') || '/functions/v1/' || p_function_name,
      body => '{}'::jsonb,
      headers => pg_catalog.jsonb_build_object(
        'Authorization', 'Bearer ' || v_maintenance_token,
        'Content-Type', 'application/json'
      ),
      timeout_milliseconds => 10000
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sql_state = RETURNED_SQLSTATE;
    v_error_code := CASE
      WHEN v_sql_state = 'P0002' THEN 'maintenance_secret_missing'
      ELSE 'edge_dispatch_failed'
    END;
    v_duration := greatest(
      0,
      pg_catalog.round(
        extract(epoch FROM (pg_catalog.clock_timestamp() - v_started_at)) * 1000
      )::integer
    );
    INSERT INTO private.backend_maintenance_runs (
      job_name, outcome, error_code, started_at, finished_at, duration_ms
    ) VALUES (
      v_job_name, 'failed', v_error_code, v_started_at,
      pg_catalog.clock_timestamp(), v_duration
    );
    RETURN pg_catalog.jsonb_build_object('outcome', 'failed', 'errorCode', v_error_code);
  END;

  v_duration := greatest(
    0,
    pg_catalog.round(
      extract(epoch FROM (pg_catalog.clock_timestamp() - v_started_at)) * 1000
    )::integer
  );
  INSERT INTO private.backend_maintenance_runs (
    job_name, outcome, processed_count, details,
    started_at, finished_at, duration_ms
  ) VALUES (
    v_job_name, 'queued', 0,
    pg_catalog.jsonb_build_object('requestId', v_request_id),
    v_started_at, pg_catalog.clock_timestamp(), v_duration
  ) RETURNING id INTO v_maintenance_run_id;

  INSERT INTO private.backend_edge_dispatches (
    request_id, maintenance_run_id, function_name, dispatched_at
  ) VALUES (
    v_request_id, v_maintenance_run_id, p_function_name, v_started_at
  );

  RETURN pg_catalog.jsonb_build_object('outcome', 'queued', 'requestId', v_request_id);
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_backend_edge_job_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;
