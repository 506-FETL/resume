-- 公开分享必须保存脱敏后的 release snapshot；完整版本只用于归属和评论版本校验。
DROP FUNCTION IF EXISTS public.publish_resume_share_release(
  uuid, bigint, jsonb, jsonb, text, text, bigint, integer, text,
  timestamptz, jsonb, text, date
);

CREATE FUNCTION public.publish_resume_share_release(
  p_share_id uuid,
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
  p_expected_document_revision bigint
)
RETURNS TABLE (
  release_id uuid,
  release_no integer,
  scope_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
DECLARE
  v_share public.resume_shares%ROWTYPE;
  v_version public.resume_config_versions%ROWTYPE;
  v_release_id uuid;
  v_release_no integer;
  v_scope_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT * INTO v_share
  FROM public.resume_shares
  WHERE id = p_share_id
  FOR UPDATE;
  IF NOT FOUND OR v_share.user_id <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume share not found';
  END IF;
  IF v_share.archived_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'archived resume share cannot be published';
  END IF;

  SELECT * INTO v_version
  FROM public.resume_config_versions
  WHERE id = p_version_id
    AND resume_id = v_share.resume_id
    AND user_id = auth.uid()
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume version not found';
  END IF;
  IF p_snapshot IS NULL
    OR jsonb_typeof(p_snapshot) <> 'object'
    OR p_template_manifest IS NULL
    OR jsonb_typeof(p_template_manifest) <> 'object'
    OR NOT public.is_valid_resume_comment_anchor_document(p_anchor_document, p_document_hash)
    OR p_expected_document_revision IS NULL
    OR p_expected_document_revision <= 0
    OR p_expected_document_revision IS DISTINCT FROM v_version.document_revision
    OR p_projection_reference_date IS DISTINCT FROM v_version.projection_reference_date THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid version release document';
  END IF;
  IF p_source_kind NOT IN ('current', 'history') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid source kind';
  END IF;
  IF p_source_kind = 'current' AND (
    p_source_version_id IS NOT NULL
    OR p_source_version_no IS NOT NULL
    OR p_source_version_label IS NOT NULL
    OR p_source_version_created_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'current source cannot include history metadata';
  END IF;
  IF p_source_kind = 'history' AND (
    p_source_version_id IS NULL
    OR p_source_version_id <> p_version_id
    OR p_source_version_no IS NULL
    OR p_source_version_label IS NULL
    OR p_source_version_created_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'history source metadata is incomplete';
  END IF;

  SELECT coalesce(max(releases.release_no), 0) + 1 INTO v_release_no
  FROM public.resume_share_releases AS releases
  WHERE releases.share_id = p_share_id;

  INSERT INTO public.resume_share_releases (
    share_id, release_no, snapshot, template_manifest, display_name,
    source_kind, source_version_id, source_version_no, source_version_label,
    source_version_created_at, created_by
  ) VALUES (
    p_share_id, v_release_no, p_snapshot, p_template_manifest, p_display_name,
    p_source_kind, p_source_version_id, p_source_version_no, p_source_version_label,
    p_source_version_created_at, auth.uid()
  ) RETURNING id INTO v_release_id;

  INSERT INTO public.resume_comment_scopes (
    kind, owner_user_id, resume_id, version_id, anchor_document,
    document_hash, document_revision, projection_reference_date
  ) VALUES (
    'version', auth.uid(), v_share.resume_id, v_version.id, p_anchor_document,
    p_document_hash, v_version.document_revision, p_projection_reference_date
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_scope_id
  FROM public.resume_comment_scopes
  WHERE kind = 'version'
    AND version_id = v_version.id
    AND archived_at IS NULL;

  UPDATE public.resume_shares
  SET version_id = v_version.id,
      current_release_id = v_release_id,
      snapshot = p_snapshot,
      template_manifest = p_template_manifest,
      display_name = p_display_name,
      source_kind = p_source_kind,
      source_version_id = p_source_version_id,
      source_version_no = p_source_version_no,
      source_version_label = p_source_version_label,
      source_version_created_at = p_source_version_created_at,
      updated_at = now()
  WHERE id = p_share_id;

  RETURN QUERY SELECT v_release_id, v_release_no, v_scope_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_resume_share_release(
  uuid, bigint, jsonb, jsonb, text, text, bigint, integer, text,
  timestamptz, jsonb, text, date, bigint
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_resume_share_release(
  uuid, bigint, jsonb, jsonb, text, text, bigint, integer, text,
  timestamptz, jsonb, text, date, bigint
) TO authenticated;
