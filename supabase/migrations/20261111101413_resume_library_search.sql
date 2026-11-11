CREATE OR REPLACE FUNCTION public.search_resume_library_counts(
  p_owner_id uuid,
  p_query text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'all', count(*),
    'roots', count(*) FILTER (WHERE config.parent_resume_id IS NULL),
    'variants', count(*) FILTER (WHERE config.parent_resume_id IS NOT NULL),
    'readyVariants', count(*) FILTER (
      WHERE config.parent_resume_id IS NOT NULL
        AND config.derived_status = 'ready'
    ),
    'pending', count(*) FILTER (
      WHERE config.derived_status IN ('generating', 'failed')
    )
  )
  FROM public.resume_config AS config
  WHERE config.user_id = p_owner_id
    AND config.user_id = (SELECT auth.uid())
    AND (
      pg_catalog.strpos(
        pg_catalog.lower(COALESCE(config.display_name, '')),
        pg_catalog.lower(p_query)
      ) > 0
      OR pg_catalog.strpos(
        pg_catalog.lower(COALESCE(config.description, '')),
        pg_catalog.lower(p_query)
      ) > 0
    );
$$;

CREATE OR REPLACE FUNCTION public.search_resume_library_page(
  p_owner_id uuid,
  p_query text,
  p_filter text,
  p_offset integer,
  p_limit integer
)
RETURNS TABLE (
  resume_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  type text,
  display_name text,
  description text,
  parent_resume_id uuid,
  linked_jd_excerpt text,
  derived_match_rate jsonb,
  derived_status text,
  template_binding jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT config.resume_id,
    config.created_at,
    config.updated_at,
    config.type,
    config.display_name,
    config.description,
    config.parent_resume_id,
    pg_catalog.left(config.linked_jd_text, 80),
    config.derived_metadata -> 'matchRate',
    config.derived_status,
    config.template_binding
  FROM public.resume_config AS config
  WHERE config.user_id = p_owner_id
    AND config.user_id = (SELECT auth.uid())
    AND (
      p_filter = 'all'
      OR (p_filter = 'roots' AND config.parent_resume_id IS NULL)
      OR (
        p_filter = 'variants'
        AND config.parent_resume_id IS NOT NULL
        AND config.derived_status = 'ready'
      )
    )
    AND (
      pg_catalog.strpos(
        pg_catalog.lower(COALESCE(config.display_name, '')),
        pg_catalog.lower(p_query)
      ) > 0
      OR pg_catalog.strpos(
        pg_catalog.lower(COALESCE(config.description, '')),
        pg_catalog.lower(p_query)
      ) > 0
    )
  ORDER BY config.updated_at DESC NULLS LAST, config.resume_id DESC
  OFFSET GREATEST(0, p_offset)
  LIMIT LEAST(10, GREATEST(1, p_limit));
$$;

REVOKE ALL ON FUNCTION public.search_resume_library_counts(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.search_resume_library_page(uuid, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.search_resume_library_counts(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_resume_library_page(uuid, text, text, integer, integer)
  TO authenticated;
