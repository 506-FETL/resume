CREATE OR REPLACE FUNCTION public.get_resume_library_counts(p_owner_id uuid)
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
    AND config.user_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_resume_library_counts(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_resume_library_counts(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_resume_comment_access_v2(
  p_protocol_version integer,
  p_access_kind text,
  p_user_id uuid DEFAULT NULL,
  p_scope_id uuid DEFAULT NULL,
  p_resume_id uuid DEFAULT NULL,
  p_version_id bigint DEFAULT NULL,
  p_share_id uuid DEFAULT NULL,
  p_release_id uuid DEFAULT NULL,
  p_password_generation text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_collaborator_role text DEFAULT NULL,
  p_anonymous_id uuid DEFAULT NULL,
  p_anonymous_secret_hash text DEFAULT NULL,
  p_collaboration_protocol_version smallint DEFAULT NULL,
  p_member_lease_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.resolve_resume_comment_access_v1(
    p_protocol_version,
    p_access_kind,
    p_user_id,
    p_scope_id,
    p_resume_id,
    p_version_id,
    p_share_id,
    p_release_id,
    p_password_generation,
    p_session_id,
    p_collaborator_role,
    p_anonymous_id,
    p_anonymous_secret_hash,
    p_collaboration_protocol_version,
    p_member_lease_id
  ) #- '{scope,anchor_document}';
$$;

REVOKE ALL ON FUNCTION public.resolve_resume_comment_access_v2(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text, smallint, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_resume_comment_access_v2(
  integer, text, uuid, uuid, uuid, bigint, uuid, uuid, text, text, text, uuid, text, smallint, uuid
) TO service_role;
