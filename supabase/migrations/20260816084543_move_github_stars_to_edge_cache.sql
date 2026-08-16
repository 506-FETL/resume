-- GitHub Stars is public display data, but its refresh path is maintenance-only.
-- Keep one fixed cache row and move all network I/O out of PostgreSQL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.github_stars
    WHERE lower(repo) <> '506-fetl/resume'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'github_stars contains an unsupported repository';
  END IF;
END;
$$;

UPDATE public.github_stars
SET repo = '506-fetl/resume'
WHERE lower(repo) = '506-fetl/resume'
  AND repo <> '506-fetl/resume';

ALTER TABLE public.github_stars
  ADD COLUMN IF NOT EXISTS etag text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text;

ALTER TABLE public.github_stars
  DROP CONSTRAINT IF EXISTS github_stars_repo_fixed_check,
  DROP CONSTRAINT IF EXISTS github_stars_stars_nonnegative_check,
  DROP CONSTRAINT IF EXISTS github_stars_etag_length_check,
  DROP CONSTRAINT IF EXISTS github_stars_failure_count_check,
  DROP CONSTRAINT IF EXISTS github_stars_error_code_length_check;

ALTER TABLE public.github_stars
  ADD CONSTRAINT github_stars_repo_fixed_check
    CHECK (repo = '506-fetl/resume'),
  ADD CONSTRAINT github_stars_stars_nonnegative_check
    CHECK (stars >= 0),
  ADD CONSTRAINT github_stars_etag_length_check
    CHECK (etag IS NULL OR pg_catalog.length(etag) <= 256),
  ADD CONSTRAINT github_stars_failure_count_check
    CHECK (consecutive_failures >= 0),
  ADD CONSTRAINT github_stars_error_code_length_check
    CHECK (last_error_code IS NULL OR pg_catalog.length(last_error_code) <= 64);

ALTER TABLE public.github_stars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS github_stars_select_public ON public.github_stars;
CREATE POLICY github_stars_read_fixed_cache
  ON public.github_stars
  FOR SELECT
  TO anon, authenticated
  USING (repo = '506-fetl/resume');

REVOKE ALL ON TABLE public.github_stars FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.github_stars TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.github_stars TO service_role;

DROP FUNCTION IF EXISTS public.get_github_stars(text, text);
DROP FUNCTION IF EXISTS public.set_github_stars(text, text, integer);

CREATE OR REPLACE FUNCTION public.get_app_github_stars()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'repo', cache.repo,
    'stars', cache.stars,
    'fetched_at', cache.fetched_at,
    'stale', cache.fetched_at < pg_catalog.now() - interval '24 hours'
  )
  FROM public.github_stars AS cache
  WHERE cache.repo = '506-fetl/resume'
$$;

REVOKE ALL ON FUNCTION public.get_app_github_stars()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_app_github_stars()
  TO anon, authenticated, service_role;

-- Default DROP behavior is RESTRICT. If an unexpected dependency still uses
-- pgsql-http this migration must fail instead of deleting it with CASCADE.
DROP EXTENSION IF EXISTS http;
