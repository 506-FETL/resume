-- 20260813000001_add_resume_share_releases.sql
-- 将可变的分享快照拆分为不可变发布批次。resume_shares 保留旧快照列作为
-- 回滚兼容，但 current_release_id 指向公开读取的唯一真源。

ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS current_release_id uuid,
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.resume_share_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL,
  release_no integer NOT NULL,
  snapshot jsonb NOT NULL,
  template_manifest jsonb NOT NULL,
  display_name text,
  source_kind text NOT NULL,
  source_version_id bigint,
  source_version_no integer,
  source_version_label text,
  source_version_created_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_share_releases_share_id_fkey
    FOREIGN KEY (share_id)
    REFERENCES public.resume_shares (id)
    ON DELETE CASCADE,
  CONSTRAINT resume_share_releases_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users (id)
    ON DELETE CASCADE,
  CONSTRAINT resume_share_releases_share_release_no_key
    UNIQUE (share_id, release_no),
  CONSTRAINT resume_share_releases_release_no_check
    CHECK (release_no > 0),
  CONSTRAINT resume_share_releases_snapshot_is_object_check
    CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT resume_share_releases_template_manifest_is_object_check
    CHECK (jsonb_typeof(template_manifest) = 'object'),
  CONSTRAINT resume_share_releases_source_kind_check
    CHECK (source_kind IN ('current', 'history')),
  CONSTRAINT resume_share_releases_source_consistency_check
    CHECK (
      (
        source_kind = 'current'
        AND source_version_id IS NULL
        AND source_version_no IS NULL
        AND source_version_label IS NULL
        AND source_version_created_at IS NULL
      )
      OR
      (
        source_kind = 'history'
        AND source_version_no IS NOT NULL
        AND source_version_label IS NOT NULL
        AND source_version_created_at IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_resume_share_releases_share_created
  ON public.resume_share_releases USING btree (share_id, created_at DESC);

ALTER TABLE public.resume_share_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resume_share_releases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.resume_share_releases TO authenticated;

DROP POLICY IF EXISTS "resume_share_releases_select_own" ON public.resume_share_releases;
CREATE POLICY "resume_share_releases_select_own" ON public.resume_share_releases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.resume_shares
      WHERE resume_shares.id = resume_share_releases.share_id
        AND resume_shares.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_resume_share_release_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'resume share releases are immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_resume_share_release_update
  ON public.resume_share_releases;
CREATE TRIGGER prevent_resume_share_release_update
  BEFORE UPDATE ON public.resume_share_releases
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_resume_share_release_update();

-- 每条迁移前已存在的分享稳定回填 release_no = 1。唯一约束和 NOT EXISTS
-- 共同保证迁移重跑不会创建第二条首发记录。
INSERT INTO public.resume_share_releases (
  share_id,
  release_no,
  snapshot,
  template_manifest,
  display_name,
  source_kind,
  source_version_id,
  source_version_no,
  source_version_label,
  source_version_created_at,
  created_by,
  created_at
)
SELECT
  shares.id,
  1,
  shares.snapshot,
  shares.template_manifest,
  shares.display_name,
  shares.source_kind,
  shares.source_version_id,
  shares.source_version_no,
  shares.source_version_label,
  shares.source_version_created_at,
  shares.user_id,
  shares.created_at
FROM public.resume_shares AS shares
WHERE NOT EXISTS (
  SELECT 1
  FROM public.resume_share_releases AS releases
  WHERE releases.share_id = shares.id
    AND releases.release_no = 1
)
ON CONFLICT (share_id, release_no) DO NOTHING;

UPDATE public.resume_shares AS shares
SET current_release_id = releases.id
FROM public.resume_share_releases AS releases
WHERE shares.current_release_id IS NULL
  AND releases.share_id = shares.id
  AND releases.release_no = 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.resume_shares
    WHERE archived_at IS NULL
      AND current_release_id IS NULL
  ) THEN
    RAISE EXCEPTION 'resume share release backfill is incomplete';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_current_release_id_fkey'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_current_release_id_fkey
      FOREIGN KEY (current_release_id)
      REFERENCES public.resume_share_releases (id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

GRANT SELECT (
  current_release_id,
  allow_comments,
  archived_at
) ON TABLE public.resume_shares TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_resume_share_release(
  p_share_id uuid,
  p_snapshot jsonb,
  p_template_manifest jsonb,
  p_display_name text,
  p_source_kind text,
  p_source_version_id bigint DEFAULT NULL,
  p_source_version_no integer DEFAULT NULL,
  p_source_version_label text DEFAULT NULL,
  p_source_version_created_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  release_id uuid,
  release_no integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_share public.resume_shares%ROWTYPE;
  v_release_id uuid;
  v_release_no integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT *
  INTO v_share
  FROM public.resume_shares
  WHERE id = p_share_id
  FOR UPDATE;

  IF NOT FOUND OR v_share.user_id <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'resume share not found';
  END IF;

  IF v_share.archived_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'archived resume share cannot be published';
  END IF;

  IF p_snapshot IS NULL
    OR jsonb_typeof(p_snapshot) <> 'object'
    OR p_template_manifest IS NULL
    OR jsonb_typeof(p_template_manifest) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'snapshot and template manifest must be objects';
  END IF;

  IF p_source_kind = 'current' THEN
    IF p_source_version_id IS NOT NULL
      OR p_source_version_no IS NOT NULL
      OR p_source_version_label IS NOT NULL
      OR p_source_version_created_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'current source cannot include history metadata';
    END IF;
  ELSIF p_source_kind = 'history' THEN
    IF p_source_version_id IS NULL
      OR p_source_version_no IS NULL
      OR p_source_version_label IS NULL
      OR p_source_version_created_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'history source metadata is incomplete';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid source kind';
  END IF;

  SELECT COALESCE(MAX(releases.release_no), 0) + 1
  INTO v_release_no
  FROM public.resume_share_releases AS releases
  WHERE releases.share_id = p_share_id;

  INSERT INTO public.resume_share_releases (
    share_id,
    release_no,
    snapshot,
    template_manifest,
    display_name,
    source_kind,
    source_version_id,
    source_version_no,
    source_version_label,
    source_version_created_at,
    created_by
  )
  VALUES (
    p_share_id,
    v_release_no,
    p_snapshot,
    p_template_manifest,
    p_display_name,
    p_source_kind,
    p_source_version_id,
    p_source_version_no,
    p_source_version_label,
    p_source_version_created_at,
    auth.uid()
  )
  RETURNING id INTO v_release_id;

  -- 旧列保留为回滚副本，但公开读取和 owner 展示均以 current release 为准。
  UPDATE public.resume_shares
  SET current_release_id = v_release_id,
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

  RETURN QUERY SELECT v_release_id, v_release_no;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_resume_share_release(
  uuid,
  jsonb,
  jsonb,
  text,
  text,
  bigint,
  integer,
  text,
  timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_resume_share_release(
  uuid,
  jsonb,
  jsonb,
  text,
  text,
  bigint,
  integer,
  text,
  timestamptz
) TO authenticated;
