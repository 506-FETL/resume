CREATE FUNCTION public.create_resume_share_release(
  p_resume_id uuid,
  p_token text,
  p_version_id bigint,
  p_snapshot jsonb,
  p_template_manifest jsonb,
  p_display_name text,
  p_source_kind text,
  p_source_version_id bigint,
  p_source_version_no integer,
  p_source_version_label text,
  p_source_version_created_at timestamptz,
  p_anchor_document jsonb,
  p_document_hash text,
  p_projection_reference_date date,
  p_expected_document_revision bigint,
  p_label text,
  p_expires_at timestamptz,
  p_purpose text,
  p_show_phone boolean,
  p_show_email boolean,
  p_allow_comments boolean,
  p_activate boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_share_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  -- 插入的外键也会加锁；必须先遵守发布事务的 config -> version -> share 顺序。
  PERFORM 1
  FROM public.resume_config
  WHERE resume_id = p_resume_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume not found';
  END IF;

  PERFORM 1
  FROM public.resume_config_versions
  WHERE id = p_version_id
    AND resume_id = p_resume_id
    AND user_id = v_user_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume version not found';
  END IF;

  INSERT INTO public.resume_shares (
    resume_id, user_id, token, label, display_name, snapshot,
    template_manifest, expires_at, purpose, show_phone, show_email,
    allow_comments, version_id, source_kind, source_version_id,
    source_version_no, source_version_label, source_version_created_at,
    is_active
  ) VALUES (
    p_resume_id, v_user_id, p_token, p_label, p_display_name, p_snapshot,
    p_template_manifest, p_expires_at, p_purpose, p_show_phone, p_show_email,
    p_allow_comments, p_version_id, p_source_kind, p_source_version_id,
    p_source_version_no, p_source_version_label, p_source_version_created_at,
    false
  ) RETURNING id INTO v_share_id;

  PERFORM public.publish_resume_share_release(
    v_share_id, p_version_id, p_snapshot, p_template_manifest,
    p_display_name, p_source_kind, p_source_version_id, p_source_version_no,
    p_source_version_label, p_source_version_created_at, p_anchor_document,
    p_document_hash, p_projection_reference_date, p_expected_document_revision
  );

  IF p_activate THEN
    UPDATE public.resume_shares
    SET is_active = true
    WHERE id = v_share_id;
  END IF;

  RETURN v_share_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_resume_share_release(
  uuid, text, bigint, jsonb, jsonb, text, text, bigint, integer, text,
  timestamptz, jsonb, text, date, bigint, text, timestamptz, text,
  boolean, boolean, boolean, boolean
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_resume_share_release(
  uuid, text, bigint, jsonb, jsonb, text, text, bigint, integer, text,
  timestamptz, jsonb, text, date, bigint, text, timestamptz, text,
  boolean, boolean, boolean, boolean
) TO authenticated;
