-- 修复历史版本的两个问题（均源于「冻结旧 active 版本」模型的派生语义）：
--
-- 问题 A：快速保存后，历史列表里刚保存的版本时间显示为「N 分钟前」而非「刚刚」。
--   根因：历史卡片展示 created_at，而被冻结进历史的那条行的 created_at 是它
--   「上一次作为 active 被创建」的时刻（上次保存时），并非本次冻结（保存）时刻。
--   修复：冻结进历史时把 created_at 刷成 now()，与「保存当前版本」链路（纯 INSERT，
--   created_at 默认 now()）语义对齐。
--
-- 问题 B：删除被分享链接引用的历史版本报错 23503
--   （resume_shares.version_id 外键 ON DELETE RESTRICT）。
--   根因：delete_resume_history_version_with_comments 只删版本行、未处理指向它的分享。
--   修复：按产品决策「删版本连同其分享一起删除」，删除版本前先永久删除引用该版本的
--   resume_shares 行（其 releases / 权限 / 评论关联走 CASCADE，匿名身份 share_id 走 SET NULL）。

-- ── 问题 A：冻结进历史时刷新 created_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_next_resume_version(
  p_resume_id uuid,
  p_version_name text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config public.resume_config%ROWTYPE;
  v_current public.resume_config_versions%ROWTYPE;
  v_current_scope public.resume_comment_scopes%ROWTYPE;
  v_new_version_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT * INTO v_config
  FROM public.resume_config
  WHERE resume_id = p_resume_id
    AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND OR v_config.current_version_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'active resume version not found';
  END IF;

  SELECT * INTO v_current
  FROM public.resume_config_versions
  WHERE id = v_config.current_version_id
    AND resume_id = p_resume_id
    AND user_id = auth.uid()
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'active resume version not found';
  END IF;

  SELECT * INTO v_current_scope
  FROM public.resume_comment_scopes
  WHERE version_id = v_current.id
    AND kind = 'version'
    AND archived_at IS NULL
  FOR UPDATE;

  -- manualSync 已先把表单写入 resume_config；分叉事务再次从云端配置
  -- 刷新活动快照，避免复制浏览器尚未持久化的本地状态。
  UPDATE public.resume_config_versions
  SET snapshot = to_jsonb(v_config)
        - 'id'
        - 'created_at'
        - 'user_id'
        - 'updated_at'
        - 'resume_id'
        - 'display_name'
        - 'description'
        - 'automerge_enabled'
        - 'document_version'
        - 'current_version_id',
      base_updated_at = v_config.updated_at
  WHERE id = v_current.id
  RETURNING * INTO v_current;

  -- 冻结当前版本进入历史列表：写入本次版本名，并把 created_at 刷为 now()，
  -- 使历史卡片的相对时间与「本次保存时刻」一致（这一版才是本次进历史的快照）。
  UPDATE public.resume_config_versions
  SET status = 'frozen',
      version_name = nullif(btrim(p_version_name), ''),
      created_at = now()
  WHERE id = v_current.id;

  -- 新建 active 工作版本继续编辑：version_name 置 NULL（工作版本名不展示、不承接历史命名）。
  INSERT INTO public.resume_config_versions (
    user_id,
    resume_id,
    version_name,
    description,
    milestone_name,
    source_type,
    tags,
    snapshot,
    content_hash,
    base_updated_at,
    status,
    document_revision,
    projection_reference_date
  ) VALUES (
    v_current.user_id,
    v_current.resume_id,
    NULL,
    v_current.description,
    v_current.milestone_name,
    'manual',
    v_current.tags,
    v_current.snapshot,
    v_current.content_hash,
    v_current.updated_at,
    'active',
    1,
    current_date
  ) RETURNING id INTO v_new_version_id;

  IF v_current_scope.id IS NOT NULL THEN
    INSERT INTO public.resume_comment_scopes (
      kind,
      owner_user_id,
      resume_id,
      version_id,
      anchor_document,
      document_hash,
      document_revision,
      projection_reference_date,
      next_event_seq
    ) VALUES (
      'version',
      v_current_scope.owner_user_id,
      v_current_scope.resume_id,
      v_new_version_id,
      v_current_scope.anchor_document,
      v_current_scope.document_hash,
      1,
      current_date,
      0
    );
  END IF;

  UPDATE public.resume_config
  SET current_version_id = v_new_version_id
  WHERE resume_id = p_resume_id;

  RETURN v_new_version_id;
END;
$$;

ALTER FUNCTION public.create_next_resume_version(uuid, text)
  SET lock_timeout = '3s';
REVOKE ALL ON FUNCTION public.create_next_resume_version(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_next_resume_version(uuid, text)
  TO authenticated;

-- ── 问题 B：删除版本前先清理引用它的分享 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_resume_history_version_with_comments(
  p_history_version_id bigint,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  IF v_actor_user_id IS NULL THEN
    PERFORM public.assert_resume_comment_service_role();
    v_actor_user_id := p_owner_user_id;
  END IF;

  -- 先删除锚定到该版本的分享（version_id 外键为 ON DELETE RESTRICT，会阻塞版本删除）。
  -- 产品语义：删除版本即连同其对外分享一并删除。分享的 releases / 权限 / 评论关联
  -- 随 resume_shares 行走 CASCADE 自动清理，匿名身份 share_id 走 SET NULL。
  DELETE FROM public.resume_shares
  WHERE version_id = p_history_version_id
    AND user_id = v_actor_user_id;

  DELETE FROM public.resume_config_versions
  WHERE id = p_history_version_id
    AND user_id = v_actor_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'history version not found';
  END IF;
END;
$$;

ALTER FUNCTION public.delete_resume_history_version_with_comments(bigint, uuid)
  SET lock_timeout = '3s';
REVOKE ALL ON FUNCTION public.delete_resume_history_version_with_comments(bigint, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_resume_history_version_with_comments(bigint, uuid)
  TO authenticated;
