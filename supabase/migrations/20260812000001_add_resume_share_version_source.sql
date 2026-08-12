-- 20260812000001_add_resume_share_version_source.sql
-- 为只读分享记录发布来源。分享内容仍保存独立快照；来源字段仅用于 owner 管理。

ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS source_version_id bigint,
  ADD COLUMN IF NOT EXISTS source_version_no integer,
  ADD COLUMN IF NOT EXISTS source_version_label text,
  ADD COLUMN IF NOT EXISTS source_version_created_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_source_kind_check'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_source_kind_check
      CHECK (source_kind IN ('current', 'history'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_source_consistency_check'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_source_consistency_check
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
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_source_version_id_fkey'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_source_version_id_fkey
      FOREIGN KEY (source_version_id)
      REFERENCES public.resume_config_versions (id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- authenticated 仍只能通过 owner RLS 管理自己的记录；这里只补充新增列权限。
GRANT SELECT (
  source_kind,
  source_version_id,
  source_version_no,
  source_version_label,
  source_version_created_at
) ON TABLE public.resume_shares TO authenticated;

GRANT INSERT (
  source_kind,
  source_version_id,
  source_version_no,
  source_version_label,
  source_version_created_at
) ON TABLE public.resume_shares TO authenticated;

GRANT UPDATE (
  source_kind,
  source_version_id,
  source_version_no,
  source_version_label,
  source_version_created_at
) ON TABLE public.resume_shares TO authenticated;
