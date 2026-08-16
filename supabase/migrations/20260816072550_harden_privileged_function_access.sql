-- Prevent future public-schema functions from silently inheriting browser EXECUTE.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- The quota check and mutation functions accept an explicit user id and are Edge-only.
REVOKE ALL ON FUNCTION public.check_ai_quota(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_quota(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer, text) TO service_role;

-- The read function derives its subject from auth.uid(), so authenticated callers remain valid.
REVOKE ALL ON FUNCTION public.get_ai_quota()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota() TO authenticated, service_role;

ALTER FUNCTION public.check_ai_quota(uuid, integer) SET search_path = '';
ALTER FUNCTION public.consume_ai_credits(uuid, integer, text) SET search_path = '';
ALTER FUNCTION public.get_ai_quota() SET search_path = '';

-- These legacy template functions have no repository call sites or database dependants.
-- Keep the objects for compatibility diagnosis, but expose them only to the service role.
REVOKE ALL ON FUNCTION public.decrement_template_likes(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_resume_template(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_liked_template(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_template_likes(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_template_usage(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.switch_resume_template(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_template_to_resume_config()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_template_custom_config(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrement_template_likes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_resume_template(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_liked_template(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_template_likes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_template_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.switch_resume_template(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_template_to_resume_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_template_custom_config(uuid, jsonb) TO service_role;

-- Until the Edge cache replacement lands, keep the current signature but hard-code the only
-- product repository before any database HTTP call or cache lookup.
CREATE OR REPLACE FUNCTION public.get_github_stars(p_owner text, p_repo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_repo constant text := '506-fetl/resume';
  v_row public.github_stars%ROWTYPE;
  v_stars integer;
BEGIN
  IF lower(btrim(coalesce(p_owner, ''))) <> '506-fetl'
     OR lower(btrim(coalesce(p_repo, ''))) <> 'resume' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'unsupported repository';
  END IF;

  SELECT *
  INTO v_row
  FROM public.github_stars
  WHERE repo = v_repo;

  IF FOUND AND v_row.fetched_at > pg_catalog.now() - interval '1 day' THEN
    RETURN pg_catalog.jsonb_build_object(
      'repo', v_row.repo,
      'stars', v_row.stars,
      'fetched_at', v_row.fetched_at,
      'stale', false
    );
  END IF;

  BEGIN
    SELECT (response.content::jsonb ->> 'stargazers_count')::integer
    INTO v_stars
    FROM extensions.http((
      'GET',
      'https://api.github.com/repos/506-FETL/resume',
      ARRAY[extensions.http_header('User-Agent', 'gresume-app')],
      NULL,
      NULL
    )::extensions.http_request) AS response;

    IF v_stars IS NULL OR v_stars < 0 THEN
      RAISE EXCEPTION 'invalid GitHub stars response';
    END IF;

    INSERT INTO public.github_stars (repo, stars, fetched_at)
    VALUES (v_repo, v_stars, pg_catalog.now())
    ON CONFLICT (repo) DO UPDATE
      SET stars = EXCLUDED.stars,
          fetched_at = EXCLUDED.fetched_at
    RETURNING * INTO v_row;

    RETURN pg_catalog.jsonb_build_object(
      'repo', v_row.repo,
      'stars', v_row.stars,
      'fetched_at', v_row.fetched_at,
      'stale', false
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object(
      'repo', v_repo,
      'stars', coalesce(v_row.stars, 0),
      'fetched_at', v_row.fetched_at,
      'stale', true
    );
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_github_stars(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_github_stars(text, text)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_github_stars(text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_github_stars(text, text, integer)
  TO service_role;

-- The old AFTER trigger returned a modified NEW row that PostgreSQL ignored.
DROP TRIGGER IF EXISTS resume_config_updated ON public.resume_config;
