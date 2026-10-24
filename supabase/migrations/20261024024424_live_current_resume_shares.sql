-- 当前分享跟随工作版本；历史分享继续绑定原版本与发布快照。
CREATE OR REPLACE FUNCTION public.follow_current_resume_share_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.current_version_id IS DISTINCT FROM OLD.current_version_id THEN
    UPDATE public.resume_shares
    SET version_id = NEW.current_version_id
    WHERE resume_id = NEW.resume_id
      AND user_id = NEW.user_id
      AND source_kind = 'current'
      AND version_id IS DISTINCT FROM NEW.current_version_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.follow_current_resume_share_version() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER follow_current_resume_share_version
AFTER UPDATE OF current_version_id ON public.resume_config
FOR EACH ROW EXECUTE FUNCTION public.follow_current_resume_share_version();

UPDATE public.resume_shares AS shares
SET version_id = configs.current_version_id
FROM public.resume_config AS configs
WHERE shares.resume_id = configs.resume_id
  AND shares.user_id = configs.user_id
  AND shares.source_kind = 'current'
  AND configs.current_version_id IS NOT NULL
  AND shares.version_id IS DISTINCT FROM configs.current_version_id;

-- 服务端读取时补齐评论投影。先锁配置并比较读取时间，防止较旧请求覆盖较新正文。
CREATE OR REPLACE FUNCTION public.sync_live_resume_share_document(
  p_resume_id uuid,
  p_config_updated_at timestamptz,
  p_scope_id uuid,
  p_version_id bigint,
  p_owner_user_id uuid,
  p_snapshot jsonb,
  p_anchor_document jsonb,
  p_document_hash text,
  p_expected_document_revision integer,
  p_projection_reference_date date,
  p_relocations jsonb,
  p_actor_key text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
BEGIN
  PERFORM public.assert_resume_comment_service_role();
  PERFORM 1 FROM public.resume_config
  WHERE resume_id = p_resume_id AND user_id = p_owner_user_id
    AND current_version_id = p_version_id AND updated_at = p_config_updated_at
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'stale_document';
  END IF;

  RETURN public.sync_resume_version_comment_document_v3(
    p_scope_id, p_version_id, p_owner_user_id, p_snapshot, p_anchor_document,
    p_document_hash, p_expected_document_revision, p_projection_reference_date,
    p_relocations, p_actor_key, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.sync_live_resume_share_document(uuid,timestamptz,uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_live_resume_share_document(uuid,timestamptz,uuid,bigint,uuid,jsonb,jsonb,text,integer,date,jsonb,text,uuid) TO service_role;

-- 发布必须检查当前指向，不能让冻结前发起的迟到请求重新绑定旧版本。
CREATE OR REPLACE FUNCTION public.publish_resume_share_release(
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
  v_current_version_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT * INTO v_share
  FROM public.resume_shares
  WHERE id = p_share_id;
  IF NOT FOUND OR v_share.user_id <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume share not found';
  END IF;
  IF v_share.archived_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'archived resume share cannot be published';
  END IF;

  -- 与创建工作版本、评论同步一致：config -> version -> share。
  SELECT current_version_id INTO v_current_version_id
  FROM public.resume_config
  WHERE resume_id = v_share.resume_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume not found';
  END IF;
  IF p_source_kind = 'current' AND p_version_id IS DISTINCT FROM v_current_version_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'stale_document';
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
  IF p_source_kind = 'current' AND v_version.status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'stale_document';
  END IF;
  IF p_source_kind = 'history' AND v_version.status <> 'frozen' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'history source must be frozen';
  END IF;

  SELECT * INTO v_share FROM public.resume_shares WHERE id = p_share_id FOR UPDATE;
  IF NOT FOUND OR v_share.user_id <> auth.uid() OR v_share.resume_id <> v_version.resume_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume share not found';
  END IF;
  IF v_share.archived_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'archived resume share cannot be published';
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


-- 历史删除也遵循 config -> version -> share，避免与发布发生反向锁序。
CREATE OR REPLACE FUNCTION public.delete_resume_history_version_with_comments(
  p_history_version_id bigint,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_resume_id uuid;
BEGIN
  IF v_actor_user_id IS NULL THEN
    PERFORM public.assert_resume_comment_service_role();
    v_actor_user_id := p_owner_user_id;
  END IF;
  SELECT resume_id INTO v_resume_id FROM public.resume_config_versions
  WHERE id = p_history_version_id AND user_id = v_actor_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'history version not found';
  END IF;
  PERFORM 1 FROM public.resume_config
  WHERE resume_id = v_resume_id AND user_id = v_actor_user_id FOR UPDATE;
  PERFORM 1 FROM public.resume_config_versions
  WHERE id = p_history_version_id AND user_id = v_actor_user_id AND status = 'frozen'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'history version not found';
  END IF;
  DELETE FROM public.resume_shares
  WHERE version_id = p_history_version_id AND user_id = v_actor_user_id;
  DELETE FROM public.resume_config_versions
  WHERE id = p_history_version_id AND user_id = v_actor_user_id;
END;
$$;
