-- 修复「快速保存版本」名称错位（延迟一代）问题。
--
-- 原 create_next_resume_version 的逻辑把用户填写的 p_version_name 写到了
-- 新建的 active（当前工作版本，不进历史列表），而被冻结进历史列表的旧版本
-- 没有拿到本次的名字。由于历史列表只展示 status='frozen' 的版本，用户填写的
-- 名字总是比历史快照晚一代落库，表现为「这次填的名字，下次保存才显示」的串名。
--
-- 修复：把 p_version_name 写到「本次被冻结进历史的版本」上；新建的 active
-- 工作版本 version_name 置 NULL（该字段在任何 UI 都不展示，留空可让历史列表
-- 的「版本 Vx」兜底名正确生效，避免继承旧名造成陈旧名污染）。
-- 仅重写函数体，其余逻辑（快照刷新、评论作用域复制、current_version_id 更新）保持不变。

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

  -- 冻结当前版本进入历史列表，并写入本次用户填写的版本名（这一版才是进历史的快照）。
  UPDATE public.resume_config_versions
  SET status = 'frozen',
      version_name = nullif(btrim(p_version_name), '')
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

-- 沿用原有权限与锁超时设置（CREATE OR REPLACE 不会改变已有 ACL，此处显式重申以防重建后丢失）。
ALTER FUNCTION public.create_next_resume_version(uuid, text)
  SET lock_timeout = '3s';
REVOKE ALL ON FUNCTION public.create_next_resume_version(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_next_resume_version(uuid, text)
  TO authenticated;
