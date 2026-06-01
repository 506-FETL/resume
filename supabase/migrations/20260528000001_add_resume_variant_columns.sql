-- 20260528000001_add_resume_variant_columns.sql
-- 为 JD 派生变体功能增加 4 列；所有列均 nullable + 默认 null，老简历不受影响

ALTER TABLE public.resume_config
  ADD COLUMN IF NOT EXISTS parent_resume_id uuid NULL,
  ADD COLUMN IF NOT EXISTS linked_jd_text text NULL,
  ADD COLUMN IF NOT EXISTS derived_metadata jsonb NULL,
  ADD COLUMN IF NOT EXISTS derived_status text NULL;

ALTER TABLE public.resume_config
  ADD CONSTRAINT resume_config_parent_resume_id_fkey
    FOREIGN KEY (parent_resume_id)
    REFERENCES public.resume_config (resume_id)
    ON DELETE SET NULL;

ALTER TABLE public.resume_config
  ADD CONSTRAINT resume_config_derived_status_check
    CHECK (
      derived_status IS NULL
      OR derived_status IN ('generating', 'ready', 'failed')
    );

ALTER TABLE public.resume_config
  ADD CONSTRAINT resume_config_derived_metadata_is_object_check
    CHECK (
      derived_metadata IS NULL
      OR jsonb_typeof(derived_metadata) = 'object'
    );

CREATE INDEX IF NOT EXISTS idx_resume_config_parent_resume_id
  ON public.resume_config USING btree (parent_resume_id)
  WHERE parent_resume_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resume_config_derived_status
  ON public.resume_config USING btree (derived_status)
  WHERE derived_status IS NOT NULL;
